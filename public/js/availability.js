async function loadAvailability() {
  const res = await fetch("/api/public-availability");
  const data = await res.json();

  const container = document.getElementById("list");
  container.innerHTML = "";

  data.sponsors.forEach(s => {
    const div = document.createElement("div");
    div.style.marginBottom = "8px";
    div.textContent = `${s.name} (${s.type}) – disponibilità: ${s.remaining_uses}`;
    container.appendChild(div);
  });
}

loadAvailability();