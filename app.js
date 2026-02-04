// --- Map setup (Cambridge-ish) ---
const map = L.map("map").setView([52.2053, 0.1218], 13);

// OpenStreetMap tiles
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const statusEl = document.getElementById("status");

// Small helper: escape HTML in popup text (basic safety)
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

async function loadTrees() {
  try {
    const res = await fetch("trees.geojson", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load trees.geojson (${res.status})`);
    const geojson = await res.json();

    let shown = 0;
    let total = 0;

    const layer = L.geoJSON(geojson, {
      filter: (feature) => {
        total += 1;
        const status = feature?.properties?.status?.toLowerCase();
        const ok = status === "verified";
        if (ok) shown += 1;
        return ok;
      },
      pointToLayer: (feature, latlng) => L.marker(latlng),
      onEachFeature: (feature, leafletLayer) => {
        const p = feature.properties || {};
        const name = esc(p.name || "Unnamed tree");
        const access = esc(p.access || "unknown");
        const notes = esc(p.notes || "");
        const photoUrl = (p.photo_url || "").trim();

        const photoHtml = photoUrl
          ? `<div style="margin-top:8px"><img src="${esc(photoUrl)}" alt="${name}" style="max-width:220px;border-radius:8px"/></div>`
          : "";

        const html = `
          <div style="min-width:220px">
            <div style="font-weight:700;margin-bottom:6px">${name}</div>
            <div><b>Access:</b> ${access}</div>
            ${notes ? `<div style="margin-top:6px">${notes}</div>` : ""}
            ${photoHtml}
          </div>
        `;

        leafletLayer.bindPopup(html);
      }
    }).addTo(map);

    // Fit map view to markers if any are shown
    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));

    statusEl.textContent = `Showing ${shown} verified trees (out of ${total} total records).`;
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Could not load tree data. Check console for details.";
  }
}

loadTrees();
