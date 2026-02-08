let token = null;

document.getElementById("login-btn").addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  if (res.ok && data.role === "admin") {
    token = data.token;
    document.getElementById("login-msg").textContent = "Login admin ok";
    document.getElementById("login").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    loadDashboard();
  } else {
    document.getElementById("login-msg").textContent = data.error || "Errore login";
  }
});

async function loadDashboard() {
  const res = await fetch("/api/dashboard", {
    headers: { "Authorization": `Bearer ${token}` },
  });
  const data = await res.json();

  document.getElementById("totals").textContent =
    JSON.stringify(data.totals, null, 2);
  document.getElementById("per-sponsor").textContent =
    JSON.stringify(data.perSponsor, null, 2);
  document.getElementById("scans").textContent =
    JSON.stringify(data.scans, null, 2);
}