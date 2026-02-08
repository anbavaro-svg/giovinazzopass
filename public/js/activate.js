document.getElementById("activate-btn").addEventListener("click", async () => {
  const cardId = document.getElementById("card-id").value.trim();
  if (!cardId) return;

  const res = await fetch("/api/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ card_id: cardId }),
  });

  const data = await res.json();
  document.getElementById("result").textContent =
    data.message || data.error || JSON.stringify(data);
});