const ROLE_KEY = "food-bridge-role";
const MSGS_KEY = "food-bridge-messages-v1";

const TYPE_LABELS = {
  food_bank: "Food bank / hub",
  pantry: "Pantry",
  meal_site: "Meals",
  redistribution: "Redistribution",
};

/** @type {{ center: [number, number]; zoom: number; locations: Location[] }} */
let dataset;

/** @typedef {{ id: string; name: string; type: keyof TYPE_LABELS; address: string; coords: [number, number]; hours: string; website: string; phone: string; wishlist: string[]; notes: string }} Location */

const state = {
  role: /** @type {'donor' | 'organization' | 'need'} */ ("donor"),
  filterTypes: new Set(Object.keys(TYPE_LABELS)),
  selectedId: null,
  markers: /** @type {Record<string, L.Marker>} */ ({}),
  /** @type {L.Map | null} */
  map: null,
};

function loadRole() {
  const r = sessionStorage.getItem(ROLE_KEY);
  if (r === "donor" || r === "organization" || r === "need") return r;
  return "donor";
}

function saveRole(role) {
  sessionStorage.setItem(ROLE_KEY, role);
}

function loadMessages() {
  try {
    const raw = localStorage.getItem(MSGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMessages(msgs) {
  localStorage.setItem(MSGS_KEY, JSON.stringify(msgs));
}

function roleLabel(role) {
  if (role === "donor") return "Donor";
  if (role === "organization") return "Organization";
  return "Neighbor seeking food";
}

function roleHintHtml(role) {
  if (role === "donor") {
    return "<strong>Donor view:</strong> See pantries’ wishlists and alerts about what’s needed. Use <em>Messages</em> to coordinate drop-offs (demo).";
  }
  if (role === "organization") {
    return "<strong>Organization view:</strong> Same map and details — in a full app you’d post needs and hours here. For now, alerts are sample text.";
  }
  return "<strong>Seeking food:</strong> Use the map and hours to find sites. Alerts highlight when locations have stock (demo).";
}

function mockAlerts(role) {
  const base = [
    {
      id: "a1",
      donor: "West Side Community Pantry needs canned protein and peanut butter this week.",
      need: "Downtown Meal Program has hot lunch today 11:30am–1pm.",
      org: "Post your updated hours to keep donors aligned (prototype).",
    },
    {
      id: "a2",
      donor: "Produce Rescue has volunteer driver openings Wednesday morning.",
      need: "Regional Food Hub has shelf-stable boxes available — check hours before visiting.",
      org: "Wishlist updated: low-sodium soups in high demand.",
    },
    {
      id: "a3",
      donor: "Downtown Meal Program: to-go containers appreciated.",
      need: "West Side Pantry: open Tue/Thu 10am–2pm.",
      org: "Demo alert: connect this to a real bulletin in a later sprint.",
    },
  ];
  return base.map((a) => {
    let text = a.donor;
    if (role === "need") text = a.need;
    if (role === "organization") text = a.org;
    const stock = role === "need" && a.id === "a2";
    return { id: a.id, text, stock };
  });
}

function filteredLocations() {
  return dataset.locations.filter((loc) => state.filterTypes.has(loc.type));
}

function renderRoleButtons() {
  document.querySelectorAll(".role-btn").forEach((btn) => {
    const role = /** @type {HTMLButtonElement} */ (btn).dataset.role;
    btn.classList.toggle("active", role === state.role);
  });
}

function renderRoleHint() {
  const el = document.getElementById("role-hint");
  el.innerHTML = roleHintHtml(state.role);
  el.hidden = false;
}

function renderFilters() {
  const row = document.getElementById("type-filters");
  row.innerHTML = "";
  Object.entries(TYPE_LABELS).forEach(([key, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (state.filterTypes.has(key) ? " on" : "");
    b.textContent = label;
    b.dataset.type = key;
    b.addEventListener("click", () => {
      if (state.filterTypes.has(key)) state.filterTypes.delete(key);
      else state.filterTypes.add(key);
      if (state.filterTypes.size === 0) state.filterTypes.add(key);
      renderFilters();
      renderList();
      syncMarkersVisibility();
    });
    row.appendChild(b);
  });
}

function renderList() {
  const ul = document.getElementById("loc-list");
  ul.innerHTML = "";
  filteredLocations().forEach((loc) => {
    const li = document.createElement("li");
    li.dataset.id = loc.id;
    if (loc.id === state.selectedId) li.classList.add("selected");
    li.innerHTML = `
      <div class="name">${escapeHtml(loc.name)}</div>
      <div class="meta">${escapeHtml(loc.address)}</div>
      <span class="badge ${loc.type}">${TYPE_LABELS[loc.type]}</span>
    `;
    li.addEventListener("click", () => selectLocation(loc.id));
    ul.appendChild(li);
  });
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function renderDetail(loc) {
  const el = document.getElementById("detail");
  if (!loc) {
    el.innerHTML = '<p class="empty-state">Select a location on the list or map.</p>';
    return;
  }
  const wish = loc.wishlist.map((w) => `<li>${escapeHtml(w)}</li>`).join("");
  el.innerHTML = `
    <h2>${escapeHtml(loc.name)}</h2>
    <div class="sub">${escapeHtml(loc.address)} · ${escapeHtml(loc.phone)}</div>
    <section>
      <h3>Hours</h3>
      <p style="margin:0;font-size:0.9rem">${escapeHtml(loc.hours)}</p>
    </section>
    <section>
      <h3>Website</h3>
      <p style="margin:0;font-size:0.9rem"><a href="${escapeAttr(
        loc.website
      )}" target="_blank" rel="noopener noreferrer">${escapeHtml(loc.website)}</a></p>
    </section>
    <section>
      <h3>Current wishlist</h3>
      <ul>${wish}</ul>
    </section>
    <section>
      <h3>Notes</h3>
      <p style="margin:0;font-size:0.85rem;color:var(--muted)">${escapeHtml(loc.notes)}</p>
    </section>
  `;
}

function escapeAttr(s) {
  return s.replace(/"/g, "&quot;");
}

function selectLocation(id) {
  state.selectedId = id;
  const loc = dataset.locations.find((l) => l.id === id);
  renderList();
  renderDetail(loc || null);
  if (loc && state.markers[id] && state.map) {
    state.map.setView(loc.coords, Math.max(state.map.getZoom(), 14), { animate: true });
    state.markers[id].openPopup();
  }
}

function initMap() {
  const map = L.map("map").setView(dataset.center, dataset.zoom);
  state.map = map;

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  state.markers = {};
  dataset.locations.forEach((loc) => {
    const marker = L.marker(loc.coords).addTo(map);
    marker.bindPopup(
      `<strong>${escapeHtml(loc.name)}</strong><br>${escapeHtml(TYPE_LABELS[loc.type])}`
    );
    marker.on("click", () => selectLocation(loc.id));
    state.markers[loc.id] = marker;
  });
  syncMarkersVisibility();
}

function syncMarkersVisibility() {
  const map = state.map;
  if (!map) return;
  dataset.locations.forEach((loc) => {
    const m = state.markers[loc.id];
    if (!m) return;
    if (state.filterTypes.has(loc.type)) {
      if (!map.hasLayer(m)) m.addTo(map);
    } else if (map.hasLayer(m)) {
      map.removeLayer(m);
    }
  });
}

function renderAlerts() {
  const ul = document.getElementById("alerts-list");
  ul.innerHTML = "";
  mockAlerts(state.role).forEach((a) => {
    const li = document.createElement("li");
    li.className = a.stock ? "stock" : "";
    li.textContent = a.text;
    ul.appendChild(li);
  });
}

function renderMessages() {
  const thread = document.getElementById("messages-thread");
  thread.innerHTML = "";
  const msgs = loadMessages();
  if (msgs.length === 0) {
    thread.innerHTML =
      '<p class="empty-state">No posts yet — be the first (stored in this browser only).</p>';
    return;
  }
  msgs.forEach((m) => {
    const div = document.createElement("div");
    div.className = "msg";
    div.innerHTML = `<div class="from">${escapeHtml(m.from)} · ${escapeHtml(m.time)}</div><div>${escapeHtml(
      m.text
    )}</div>`;
    thread.appendChild(div);
  });
}

function postMessage() {
  const ta = /** @type {HTMLTextAreaElement} */ (document.getElementById("msg-body"));
  const text = ta.value.trim();
  if (!text) return;
  const msgs = loadMessages();
  msgs.unshift({
    from: roleLabel(state.role),
    time: new Date().toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }),
    text,
  });
  saveMessages(msgs.slice(0, 50));
  ta.value = "";
  renderMessages();
}

function setupTabs() {
  const tabs = document.querySelectorAll(".panel-tabs [data-tab]");
  const panels = {
    places: document.getElementById("tab-places"),
    alerts: document.getElementById("tab-alerts"),
    messages: document.getElementById("tab-messages"),
  };
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = /** @type {HTMLButtonElement} */ (btn).dataset.tab;
      tabs.forEach((b) => {
        const on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      Object.entries(panels).forEach(([key, panel]) => {
        const on = key === name;
        panel.classList.toggle("active", on);
        panel.hidden = !on;
      });
      if (name === "messages") renderMessages();
      if (name === "alerts") renderAlerts();
      setTimeout(() => state.map?.invalidateSize(), 100);
    });
  });
}

async function main() {
  const res = await fetch("data/locations.json");
  if (!res.ok) throw new Error("Failed to load locations");
  dataset = await res.json();

  state.role = loadRole();
  renderRoleButtons();
  renderRoleHint();
  renderFilters();
  renderList();
  renderDetail(null);
  renderAlerts();
  setupTabs();

  document.querySelectorAll(".role-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const role = /** @type {HTMLButtonElement} */ (btn).dataset.role;
      if (role !== "donor" && role !== "organization" && role !== "need") return;
      state.role = role;
      saveRole(role);
      renderRoleButtons();
      renderRoleHint();
      renderAlerts();
    });
  });

  document.getElementById("msg-send").addEventListener("click", postMessage);

  initMap();
}

main().catch((e) => {
  console.error(e);
  document.getElementById("detail").innerHTML =
    '<p class="empty-state">Could not load data. Serve this folder over HTTP (e.g. Live Server) or deploy to Vercel.</p>';
});
