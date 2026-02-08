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
  if (res.ok && data.role === "sponsor") {
    token = data.token;
    document.getElementById("login-msg").textContent = "Login effettuato";
    document.getElementById("login").style.display = "none";
    document.getElementById("use-card").style.display = "block";
  } else {
    document.getElementById("login-msg").textContent = data.error || "Errore login";
  }
});

document.getElementById("use-btn").addEventListener("click", async () => {
  if (!token) return;
  const cardId = document.getElementById("card-id").value.trim();
  if (!cardId) return;

  const res = await fetch("/api/use-card", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ card_id: cardId }),
  });

  const data = await res.json();
  document.getElementById("use-msg").textContent =
    data.message || data.error || JSON.stringify(data);
});