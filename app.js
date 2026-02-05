// --- Map setup (Cambridge-ish) ---
const map = L.map("map").setView([52.2053, 0.1218], 13);

// OpenStreetMap tiles
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
});

const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 19,
    attribution: "&copy; Esri"
  }
);

const light = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap & Carto"
  }
);

// Add light theme map as default basemap
light.addTo(map);

// Basemap switching functionality
const baseMaps = {
  "Standard map": osm,
  "Satellite": satellite,
  "Light map": light
};

// Add two arker groups and overlay control (for trees pending approval)
const approvedLayer = L.layerGroup().addTo(map);
const pendingLayer = L.layerGroup(); // don't add by default (optional)

L.control.layers(baseMaps, {
  "Approved trees": approvedLayer,
  "Pending submissions": pendingLayer
}, { position: "topright", collapsed: true }).addTo(map);



const statusEl = document.getElementById("status");

// Add sequoia icon for map
const sequoiaIcon = L.icon({
  iconUrl: "icons/sequoia-marker.png",
  iconSize: [36, 36],        // size of the icon
  iconAnchor: [18, 34],      // point of the icon which corresponds to marker's location
  popupAnchor: [0, -30],     // where the popup opens relative to the icon
});

// Add pending icon
const pendingIcon = L.icon({
  iconUrl: "icons/sequoia-marker-grey.png",
  iconSize: [36, 36],
  iconAnchor: [18, 34],
  popupAnchor: [0, -30],
});


// Small helper: escape HTML in popup text (basic safety)
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

// Put your published Google Sheet CSV URL here:
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT8eU3aMyb4r8CzgzSENw67McR_ljvxOW08LmBGC5akvChhzJ-HWII0GEYQxWp9WE2W9pnMAN8wWR-x/pub?gid=1748402674&single=true&output=csv";


function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

async function loadTreesFromSheet() {
  statusEl.textContent = "Loading trees…";

  // Cache-bust so edits in Sheets appear immediately
  const urlWithBust =
    SHEET_CSV_URL + (SHEET_CSV_URL.includes("?") ? "&" : "?") + "v=" + Date.now();

  Papa.parse(urlWithBust, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const rows = results.data || [];

      let total = 0;
      let shown = 0;

      const markers = [];

      for (const r of rows) {
        total += 1;

        // Prefer review_status=approved (your moderation flow)
        const review = (r.review_status ?? r["review_status"] ?? r["Review status"] ?? r["Review Status"] ?? "")
          .toString()
          .trim()
          .toLowerCase();

        // Fallback to status=verified if you still have that older column
        const status = (r.status ?? r["status"] ?? "").toString().trim().toLowerCase();

        // Normalize moderation states
        // - approved => show as approved
        // - pending/blank => show as pending
        // - rejected => don't show
        let state = "pending";

        if (review) {
          if (review === "approved") state = "approved";
          else if (review === "rejected") state = "rejected";
          else state = "pending";
        } else {
          // fallback legacy column
          if (status === "verified") state = "approved";
          else state = "pending";
        }

        if (state === "rejected") continue;


        // Handle Google Forms headers: "Latitude", "Longitude"
        const lat = toNum(r.lat ?? r["lat"] ?? r["Latitude"] ?? r["latitude"]);
        const lng = toNum(r.lng ?? r["lng"] ?? r["Longitude"] ?? r["longitude"]);
        if (lat === null || lng === null) continue;

        shown += 1;

        const name = esc(
          r.name ??
          r["name"] ??
          r["Tree name / label"] ??
          r["Tree name"] ??
          "Unnamed tree"
        );

        const access = esc(
          r.access ??
          r["access"] ??
          r["Access"] ??
          "unknown"
        );

        const notes = esc(
          r.notes ??
          r["notes"] ??
          r["Notes / how to find it"] ??
          r["Notes"] ??
          ""
        );

        const photoUrl = (r.photo_url ?? r["photo_url"] ?? r["Photo URL"] ?? r["photo"] ?? "").toString().trim();

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

        const icon = (state === "approved") ? sequoiaIcon : pendingIcon;
        const layer = (state === "approved") ? approvedLayer : pendingLayer;

        // Add a label to the popup so people understand it's pending
        const statusLabel = (state === "approved")
          ? `<div style="margin-top:6px; font-size:12px;"><b>Status:</b> Approved</div>`
          : `<div style="margin-top:6px; font-size:12px;"><b>Status:</b> Pending (not yet verified)</div>`;

        const m = L.marker([lat, lng], { icon }).bindPopup(html + statusLabel);
        m.addTo(layer);

      }

      const group = L.featureGroup(markers).addTo(map);
      if (markers.length) map.fitBounds(group.getBounds().pad(0.2));

      statusEl.textContent = `Showing ${shown} approved/verified trees (out of ${total} total rows).`;
    },
    error: (err) => {
      console.error(err);
      statusEl.textContent = "Could not load trees from Google Sheets.";
    }
  });
}


loadTreesFromSheet();

const bounds = approvedLayer.getBounds();
if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));


