// Uses the same published CSV as your map
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vT8eU3aMyb4r8CzgzSENw67McR_ljvxOW08LmBGC5akvChhzJ-HWII0GEYQxWp9WE2W9pnMAN8wWR-x/pub?gid=1748402674&single=true&output=csv";

// Helpers
function toLower(x) {
  return (x ?? "").toString().trim().toLowerCase();
}

function parseTimestamp(ts) {
  // Google Forms timestamps often look like: "02/05/2026 14:03:21"
  // new Date(...) can be locale-sensitive; this tries a couple approaches.
  const s = (ts ?? "").toString().trim();
  if (!s) return null;

  // Try native parse first
  let d = new Date(s);
  if (!isNaN(d)) return d;

  // Fallback: mm/dd/yyyy hh:mm:ss (common for Google Forms)
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const [_, mm, dd, yyyy, hh="0", mi="0", ss="0"] = m;
  d = new Date(Number(yyyy), Number(mm)-1, Number(dd), Number(hh), Number(mi), Number(ss));
  return isNaN(d) ? null : d;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function fmtMonth(d) {
  // e.g. "2026-02"
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function drawGrowthChart() {
  const note = document.getElementById("chartNote");
  const canvas = document.getElementById("growthChart");
  if (!canvas) return;

  note.textContent = "Loading chart…";

  const urlWithBust = SHEET_CSV_URL + (SHEET_CSV_URL.includes("?") ? "&" : "?") + "v=" + Date.now();

  Papa.parse(urlWithBust, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: ({ data }) => {
      const rows = data || [];

      // Count approved per month (and show cumulative total)
      const countsByMonth = new Map();

      let approvedTotal = 0;
      let timestampHeader = "Timestamp"; // default Google Forms column name

      // If your sheet uses a different header, you can change it here:
      // timestampHeader = "timestamp";

      for (const r of rows) {
        const review = toLower(r.review_status ?? r["Review status"] ?? r["Review Status"]);
        const status = toLower(r.status);
        const isApproved = review ? (review === "approved") : (status === "verified");
        if (!isApproved) continue;

        const d = parseTimestamp(r[timestampHeader]);
        if (!d) continue;

        approvedTotal += 1;
        const m0 = startOfMonth(d);
        const key = fmtMonth(m0);
        countsByMonth.set(key, (countsByMonth.get(key) ?? 0) + 1);
      }

      // Sort months
      const keys = Array.from(countsByMonth.keys()).sort();
      if (keys.length === 0) {
        note.textContent = "No approved trees with timestamps found yet.";
        return;
      }

      // Build monthly + cumulative series
      const labels = [];
      const monthly = [];
      const cumulative = [];
      let running = 0;

      for (const k of keys) {
        labels.push(k);
        const c = countsByMonth.get(k) ?? 0;
        monthly.push(c);
        running += c;
        cumulative.push(running);
      }

      // Bar chart (monthly). If you prefer cumulative, swap datasets.
      new Chart(canvas, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "New approved trees per month",
              data: monthly
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: true },
            tooltip: { enabled: true }
          },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      });

      note.textContent = `Updated automatically from the live submissions sheet. Total approved: ${approvedTotal}.`;
    },
    error: (err) => {
      console.error(err);
      note.textContent = "Could not load chart data.";
    }
  });
}

drawGrowthChart();
