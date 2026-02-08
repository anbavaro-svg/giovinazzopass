function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// JWT minimale con HMAC-SHA256
async function signJWT(payload, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const data = `${header}.${body}`;

  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  return `${data}.${sig}`;
}

async function verifyJWT(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const data = `${header}.${body}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  if (expected !== sig) return null;
  return JSON.parse(atob(body));
}

async function requireAuth(request, env, roles = []) {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return null;
  if (roles.length && !roles.includes(payload.role)) return null;
  return payload;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // LOGIN
    if (path === "/api/login" && method === "POST") {
      const { username, password } = await request.json();

      const user = await env.DB.prepare(
        "SELECT id, username, role, sponsor_id, password FROM users WHERE username = ?"
      ).bind(username).first();

      if (!user || user.password !== password) {
        return jsonResponse({ error: "Credenziali non valide" }, 401);
      }

      const token = await signJWT(
        { id: user.id, role: user.role, sponsor_id: user.sponsor_id },
        env.JWT_SECRET
      );

      return jsonResponse({ token, role: user.role });
    }

    // ATTIVAZIONE CARD (pubblica)
    if (path === "/api/activate" && method === "POST") {
      const { card_id } = await request.json();

      const card = await env.DB.prepare(
        "SELECT id, status FROM cards WHERE id = ?"
      ).bind(card_id).first();

      if (!card) return jsonResponse({ error: "Card non trovata" }, 404);

      if (card.status === "attiva") {
        return jsonResponse({ message: "Card già attiva", status: card.status });
      }
      if (card.status === "utilizzata") {
        return jsonResponse({ message: "Card già utilizzata", status: card.status });
      }

      const now = new Date().toISOString();

      await env.DB.batch([
        env.DB.prepare(
          "UPDATE cards SET status = 'attiva', activated_at = ? WHERE id = ?"
        ).bind(now, card_id),
        env.DB.prepare(
          "INSERT INTO scans (card_id, sponsor_id, timestamp, action) VALUES (?, NULL, ?, 'attivazione')"
        ).bind(card_id, now),
      ]);

      return jsonResponse({ message: "Card attivata", status: "attiva" });
    }

    // UTILIZZO CARD (sponsor)
    if (path === "/api/use-card" && method === "POST") {
      const user = await requireAuth(request, env, ["sponsor"]);
      if (!user) return jsonResponse({ error: "Non autorizzato" }, 401);

      const { card_id } = await request.json();

      const card = await env.DB.prepare(
        "SELECT id, status FROM cards WHERE id = ?"
      ).bind(card_id).first();

      if (!card) return jsonResponse({ error: "Card non trovata" }, 404);
      if (card.status === "non_attiva") {
        return jsonResponse({ error: "Card non attiva" }, 400);
      }
      if (card.status === "utilizzata") {
        return jsonResponse({ error: "Card già utilizzata" }, 400);
      }

      const sponsor = await env.DB.prepare(
        "SELECT id, remaining_uses FROM sponsors WHERE id = ?"
      ).bind(user.sponsor_id).first();

      if (!sponsor) return jsonResponse({ error: "Sponsor non trovato" }, 404);
      if (sponsor.remaining_uses <= 0) {
        return jsonResponse({ error: "Disponibilità sponsor esaurita" }, 400);
      }

      const now = new Date().toISOString();

      await env.DB.batch([
        env.DB.prepare(
          "UPDATE cards SET status = 'utilizzata', used_at = ?, sponsor_id = ? WHERE id = ?"
        ).bind(now, sponsor.id, card_id),
        env.DB.prepare(
          "UPDATE sponsors SET remaining_uses = remaining_uses - 1 WHERE id = ?"
        ).bind(sponsor.id),
        env.DB.prepare(
          "INSERT INTO scans (card_id, sponsor_id, timestamp, action) VALUES (?, ?, ?, 'utilizzo')"
        ).bind(card_id, sponsor.id, now),
      ]);

      return jsonResponse({ message: "Card utilizzata", status: "utilizzata" });
    }

    // DASHBOARD ADMIN
    if (path === "/api/dashboard" && method === "GET") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return jsonResponse({ error: "Non autorizzato" }, 401);

      const totals = await env.DB.prepare(
        `SELECT 
          SUM(CASE WHEN status = 'non_attiva' THEN 1 ELSE 0 END) AS non_attive,
          SUM(CASE WHEN status = 'attiva' THEN 1 ELSE 0 END) AS attive,
          SUM(CASE WHEN status = 'utilizzata' THEN 1 ELSE 0 END) AS utilizzate,
          COUNT(*) AS totale
        FROM cards`
      ).first();

      const perSponsor = await env.DB.prepare(
        `SELECT s.id, s.name, s.type,
                COUNT(c.id) AS cards_utilizzate
         FROM sponsors s
         LEFT JOIN cards c ON c.sponsor_id = s.id AND c.status = 'utilizzata'
         GROUP BY s.id`
      ).all();

      const scans = await env.DB.prepare(
        `SELECT scans.id, scans.card_id, scans.timestamp, scans.action,
                sponsors.name AS sponsor_name
         FROM scans
         LEFT JOIN sponsors ON scans.sponsor_id = sponsors.id
         ORDER BY scans.timestamp DESC
         LIMIT 200`
      ).all();

      return jsonResponse({
        totals,
        perSponsor: perSponsor.results,
        scans: scans.results,
      });
    }

    // CREAZIONE SPONSOR (admin)
    if (path === "/api/sponsors" && method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return jsonResponse({ error: "Non autorizzato" }, 401);

      const { name, type, max_uses } = await request.json();

      const result = await env.DB.prepare(
        "INSERT INTO sponsors (name, type, max_uses, remaining_uses) VALUES (?, ?, ?, ?)"
      ).bind(name, type, max_uses, max_uses).run();

      return jsonResponse({
        id: result.lastRowId,
        name,
        type,
        max_uses,
        remaining_uses: max_uses,
      });
    }

    // DISPONIBILITÀ PUBBLICA
    if (path === "/api/public-availability" && method === "GET") {
      const sponsors = await env.DB.prepare(
        "SELECT id, name, type, remaining_uses FROM sponsors ORDER BY name"
      ).all();

      return jsonResponse({ sponsors: sponsors.results });
    }

    return new Response("Not found", { status: 404 });
  },
};