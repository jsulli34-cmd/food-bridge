import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db, isFirebaseConfigured } from "./firebase-config.js";

const ROLE_KEY = "food-bridge-role";
const STATUS_KEY = "food-bridge-status-overrides-v2";

/** Shared need + wishlist overrides (one doc, same pattern as messages collection). */
const LOCATION_OVERRIDES = ["settings", "locationOverrides"];

const TYPE_LABELS = {
  food_bank: "Food bank / hub",
  pantry: "Pantry",
  meal_site: "Meals",
  redistribution: "Redistribution",
};

const STATUS_META = {
  critical: { label: "Critical Need", className: "critical", color: "#b91c1c" },
  high: { label: "High Need", className: "high", color: "#d97706" },
  medium: { label: "Moderate Need", className: "medium", color: "#2563eb" },
  stable: { label: "Stable / stocked", className: "stable", color: "#15803d" },
};

const ROLE_TARGETS = {
  donor: "Donor",
  organization: "Organization",
  need: "Neighbor in need",
};

/** @typedef {{ id: string; name: string; type: keyof TYPE_LABELS; address: string; coords: [number, number]; hours: string; website: string; phone: string; wishlist: string[]; notes: string; status: keyof STATUS_META }} Location */
/** @type {{ center: [number, number]; zoom: number; locations: Location[] }} */
let dataset;

const state = {
  role: /** @type {'donor' | 'organization' | 'need'} */ ("donor"),
  filterTypes: new Set(Object.keys(TYPE_LABELS)),
  selectedId: null,
  markers: /** @type {Record<string, L.CircleMarker>} */ ({}),
  map: /** @type {L.Map | null} */ (null),
  statusById: /** @type {Record<string, keyof STATUS_META>} */ ({}),
  msgView: /** @type {'inbox' | 'sent' | 'all'} */ ("inbox"),
  messages: /** @type {Array<{from: string; to: string; text: string; locationId: string; locationName: string; createdAt?: any}>} */ ([]),
  sendingMessage: false,
  /** Firestore keys only; missing key means use static JSON wishlist. */
  wishlistById: /** @type {Record<string, string[]>} */ ({}),
  savingWishlist: false,
};

function setMessageStatus(text, tone = "") {
  const el = document.getElementById("msg-status");
  if (!el) return;
  el.textContent = text;
  el.classList.remove("error", "ok");
  if (tone) el.classList.add(tone);
}

function setPlaceSyncStatus(text, tone = "") {
  const el = document.getElementById("place-sync-status");
  if (!el) return;
  el.hidden = !text;
  el.textContent = text;
  el.classList.remove("error", "ok");
  if (tone) el.classList.add(tone);
}

function loadRole() {
  const val = sessionStorage.getItem(ROLE_KEY);
  return val === "donor" || val === "organization" || val === "need" ? val : "donor";
}

function saveRole(role) {
  sessionStorage.setItem(ROLE_KEY, role);
}

function loadStatusOverrides() {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStatusOverrides() {
  localStorage.setItem(STATUS_KEY, JSON.stringify(state.statusById));
}

function effectiveStatus(loc) {
  return state.statusById[loc.id] || loc.status || "medium";
}

function effectiveWishlist(loc) {
  if (Object.prototype.hasOwnProperty.call(state.wishlistById, loc.id)) {
    return state.wishlistById[loc.id];
  }
  return loc.wishlist;
}

function roleLabel(role) {
  if (role === "donor") return "Donor";
  if (role === "organization") return "Organization";
  return "Neighbor in need";
}

function roleHintHtml(role) {
  if (role === "donor") {
    return "<strong>Donor view:</strong> focus on high/critical sites. Open a location card for wishlist details and send direct notes to organizations.";
  }
  if (role === "organization") {
    return "<strong>Organization view:</strong> open your site and update need status and wishlist. When Firebase is configured, changes sync for everyone in realtime (like Messages).";
  }
  return "<strong>Neighbor view:</strong> check map/list and alerts for stocked or open meal sites. Send direct questions to organizations.";
}

function markerStyle(status) {
  return {
    radius: status === "critical" ? 10 : 8,
    color: "#111827",
    weight: 1,
    fillOpacity: 0.9,
    fillColor: STATUS_META[status].color,
  };
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function escapeAttr(s) {
  return s.replace(/"/g, "&quot;");
}

function filteredLocations() {
  return dataset.locations.filter((loc) => state.filterTypes.has(loc.type));
}

function renderRoleButtons() {
  document.querySelectorAll(".role-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.role === state.role);
  });
}

function renderRoleHint() {
  const hint = document.getElementById("role-hint");
  hint.innerHTML = roleHintHtml(state.role);
  hint.hidden = false;
}

function renderFilters() {
  const row = document.getElementById("type-filters");
  row.innerHTML = "";
  Object.entries(TYPE_LABELS).forEach(([key, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (state.filterTypes.has(key) ? " on" : "");
    b.textContent = label;
    b.addEventListener("click", () => {
      if (state.filterTypes.has(key)) state.filterTypes.delete(key);
      else state.filterTypes.add(key);
      if (state.filterTypes.size === 0) state.filterTypes.add(key);
      renderFilters();
      renderList();
      syncMarkersVisibility();
      renderAlerts();
    });
    row.appendChild(b);
  });
}

function statusPill(status) {
  return `<span class="status-pill ${STATUS_META[status].className}">${STATUS_META[status].label}</span>`;
}

function renderList() {
  const ul = document.getElementById("loc-list");
  ul.innerHTML = "";
  filteredLocations().forEach((loc) => {
    const currentStatus = effectiveStatus(loc);
    const li = document.createElement("li");
    if (loc.id === state.selectedId) li.classList.add("selected");
    li.innerHTML = `
      <div class="name">${escapeHtml(loc.name)} ${statusPill(currentStatus)}</div>
      <div class="meta">${escapeHtml(loc.address)}</div>
      <span class="badge ${loc.type}">${TYPE_LABELS[loc.type]}</span>
    `;
    li.addEventListener("click", () => selectLocation(loc.id));
    ul.appendChild(li);
  });
}

function renderStatusControls(loc) {
  if (state.role !== "organization") {
    return '<p class="empty-state">Switch to Organization role to update this site\'s need status.</p>';
  }
  const current = effectiveStatus(loc);
  const syncHint = isFirebaseConfigured
    ? ""
    : '<p class="empty-state" style="margin-top:0.5rem">Need status is saved only in this browser until Firebase is configured.</p>';
  return `
    <div class="status-controls" data-status-controls="${escapeAttr(loc.id)}">
      ${Object.entries(STATUS_META)
        .map(([key, meta]) => `<button type="button" data-status="${key}" class="${current === key ? "active" : ""}">${meta.label}</button>`)
        .join("")}
    </div>
    ${syncHint}
  `;
}

function renderWishlistSection(loc) {
  const wish = effectiveWishlist(loc).map((w) => `<li>${escapeHtml(w)}</li>`).join("");
  if (state.role !== "organization") {
    return `
    <section>
      <h3>Current wishlist</h3>
      <ul>${wish}</ul>
    </section>`;
  }
  if (!isFirebaseConfigured) {
    return `
    <section>
      <h3>Current wishlist</h3>
      <ul>${wish}</ul>
      <p class="empty-state">Add Firebase in <code>js/firebase-config.js</code> to edit the wishlist for everyone (shared updates, like Messages).</p>
    </section>`;
  }
  const body = effectiveWishlist(loc).join("\n");
  return `
    <section>
      <h3>Wishlist (syncs for everyone)</h3>
      <p class="empty-state" style="margin:0 0 0.35rem;font-size:0.8rem">One item per line.</p>
      <div class="wishlist-edit">
        <label for="wishlist-edit-body">Items needed</label>
        <textarea id="wishlist-edit-body" placeholder="Canned protein&#10;Diapers">${escapeHtml(body)}</textarea>
        <button type="button" id="wishlist-save-btn">Save wishlist</button>
      </div>
    </section>`;
}

function renderDetail(loc) {
  const el = document.getElementById("detail");
  if (!loc) {
    setPlaceSyncStatus("", "");
    el.innerHTML = '<p class="empty-state">Select a location on the list or map.</p>';
    return;
  }
  const status = effectiveStatus(loc);
  el.innerHTML = `
    <h2>${escapeHtml(loc.name)}</h2>
    <div class="sub">${escapeHtml(loc.address)} · ${escapeHtml(loc.phone)}</div>
    <section>
      <h3>Current need status</h3>
      <p style="margin:0 0 0.45rem">${statusPill(status)}</p>
      ${renderStatusControls(loc)}
    </section>
    <section>
      <h3>Hours</h3>
      <p style="margin:0;font-size:0.9rem">${escapeHtml(loc.hours)}</p>
    </section>
    <section>
      <h3>Website</h3>
      <p style="margin:0;font-size:0.9rem"><a href="${escapeAttr(loc.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(loc.website)}</a></p>
    </section>
    ${renderWishlistSection(loc)}
    <section>
      <h3>Notes</h3>
      <p style="margin:0;font-size:0.85rem;color:var(--muted)">${escapeHtml(loc.notes)}</p>
    </section>
  `;

  const box = el.querySelector("[data-status-controls]");
  if (box) {
    box.querySelectorAll("button[data-status]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const next = btn.dataset.status;
        if (!next || !STATUS_META[next]) return;
        if (isFirebaseConfigured) {
          setPlaceSyncStatus("Saving need status…", "");
          try {
            await setDoc(
              doc(db, ...LOCATION_OVERRIDES),
              { statusById: { [loc.id]: next }, updatedAt: serverTimestamp() },
              { merge: true }
            );
            setPlaceSyncStatus("Need status updated for everyone.", "ok");
          } catch (error) {
            console.error(error);
            setPlaceSyncStatus("Could not save need status. Check Firestore rules.", "error");
          }
        } else {
          state.statusById[loc.id] = /** @type {keyof STATUS_META} */ (next);
          saveStatusOverrides();
          updateMarkerStyle(loc.id);
          renderList();
          renderDetail(loc);
          renderAlerts();
        }
      });
    });
  }

  const saveWishBtn = document.getElementById("wishlist-save-btn");
  const wishTa = document.getElementById("wishlist-edit-body");
  if (saveWishBtn && wishTa && state.role === "organization" && isFirebaseConfigured) {
    saveWishBtn.addEventListener("click", () => saveWishlistForLocation(loc, wishTa, saveWishBtn));
  }
}

function selectLocation(id) {
  state.selectedId = id;
  const loc = dataset.locations.find((x) => x.id === id);
  renderList();
  renderDetail(loc || null);
  if (loc && state.map && state.markers[id]) {
    state.map.setView(loc.coords, Math.max(state.map.getZoom(), 14), { animate: true });
    state.markers[id].openPopup();
  }
}

function updateMarkerStyle(id) {
  const loc = dataset.locations.find((x) => x.id === id);
  const marker = state.markers[id];
  if (!loc || !marker) return;
  const status = effectiveStatus(loc);
  marker.setStyle(markerStyle(status));
  marker.setPopupContent(`<strong>${escapeHtml(loc.name)}</strong><br>${TYPE_LABELS[loc.type]}<br>${STATUS_META[status].label}`);
}

function initMap() {
  state.map = L.map("map").setView(dataset.center, dataset.zoom);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(state.map);

  state.markers = {};
  dataset.locations.forEach((loc) => {
    const status = effectiveStatus(loc);
    const marker = L.circleMarker(loc.coords, markerStyle(status)).addTo(state.map);
    marker.bindPopup(`<strong>${escapeHtml(loc.name)}</strong><br>${TYPE_LABELS[loc.type]}<br>${STATUS_META[status].label}`);
    marker.on("click", () => selectLocation(loc.id));
    state.markers[loc.id] = marker;
  });
  syncMarkersVisibility();
}

function syncMarkersVisibility() {
  if (!state.map) return;
  dataset.locations.forEach((loc) => {
    const marker = state.markers[loc.id];
    if (!marker) return;
    if (state.filterTypes.has(loc.type)) {
      if (!state.map.hasLayer(marker)) marker.addTo(state.map);
    } else if (state.map.hasLayer(marker)) {
      state.map.removeLayer(marker);
    }
  });
}

function buildAlerts() {
  const visible = filteredLocations();
  const alerts = [];

  if (state.role === "donor") {
    visible
      .filter((loc) => ["critical", "high"].includes(effectiveStatus(loc)))
      .forEach((loc) => alerts.push({ text: `${loc.name} is ${STATUS_META[effectiveStatus(loc)].label.toLowerCase()}. Priority items: ${effectiveWishlist(loc).slice(0, 2).join(", ")}.`, stock: false }));
  } else if (state.role === "need") {
    visible
      .filter((loc) => ["stable", "medium"].includes(effectiveStatus(loc)))
      .forEach((loc) => alerts.push({ text: `${loc.name} is currently marked ${STATUS_META[effectiveStatus(loc)].label.toLowerCase()}. Check posted hours before visiting.`, stock: true }));
  } else {
    visible
      .filter((loc) => ["critical", "high"].includes(effectiveStatus(loc)))
      .forEach((loc) => alerts.push({ text: `${loc.name} has elevated demand. Consider posting an updated wishlist message.`, stock: false }));
  }

  if (alerts.length === 0) {
    alerts.push({ text: "No urgent alerts for current filters. Try enabling more location types.", stock: true });
  }
  return alerts;
}

function renderAlerts() {
  const ul = document.getElementById("alerts-list");
  ul.innerHTML = "";
  buildAlerts().forEach((alert) => {
    const li = document.createElement("li");
    li.className = alert.stock ? "stock" : "";
    li.textContent = alert.text;
    ul.appendChild(li);
  });
}

function messageVisibleForRole(msg) {
  if (state.msgView === "inbox") return msg.to === state.role;
  if (state.msgView === "sent") return msg.from === state.role;
  return msg.to === state.role || msg.from === state.role;
}

function renderMessages() {
  const thread = document.getElementById("messages-thread");
  const msgs = state.messages.filter(messageVisibleForRole);
  thread.innerHTML = "";

  if (msgs.length === 0) {
    thread.innerHTML = '<p class="empty-state">No messages in this view yet.</p>';
    return;
  }

  msgs.forEach((m) => {
    const div = document.createElement("div");
    div.className = "msg";
    const location = m.locationName ? ` · Regarding: ${escapeHtml(m.locationName)}` : "";
    const time = formatMessageTime(m.createdAt);
    div.innerHTML = `
      <div class="from">${escapeHtml(roleLabel(m.from))} -> ${escapeHtml(roleLabel(m.to))} · ${escapeHtml(time)}</div>
      <div>${escapeHtml(m.text)}</div>
      <div class="subject">${location || "General message"}</div>
    `;
    thread.appendChild(div);
  });
}

function formatMessageTime(createdAt) {
  if (!createdAt || typeof createdAt.toDate !== "function") return "just now";
  return createdAt.toDate().toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function refreshMessageRoleOptions() {
  const select = document.getElementById("msg-to");
  select.innerHTML = "";
  Object.keys(ROLE_TARGETS)
    .filter((role) => role !== state.role)
    .forEach((role) => {
      const opt = document.createElement("option");
      opt.value = role;
      opt.textContent = ROLE_TARGETS[role];
      select.appendChild(opt);
    });
}

function populateMessageLocations() {
  const select = document.getElementById("msg-location");
  const current = select.value;
  select.innerHTML = '<option value="">General / all locations</option>';
  dataset.locations.forEach((loc) => {
    const opt = document.createElement("option");
    opt.value = loc.id;
    opt.textContent = loc.name;
    select.appendChild(opt);
  });
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

async function postMessage() {
  if (state.sendingMessage) return;
  const to = document.getElementById("msg-to").value;
  const locationId = document.getElementById("msg-location").value;
  const textArea = document.getElementById("msg-body");
  const sendBtn = document.getElementById("msg-send");
  const text = textArea.value.trim();
  if (!to) {
    setMessageStatus("Pick a recipient role before sending.", "error");
    return;
  }
  if (!text) {
    setMessageStatus("Type a message before sending.", "error");
    return;
  }
  if (!isFirebaseConfigured) {
    setMessageStatus("Firebase is not configured in this deployment.", "error");
    return;
  }

  const loc = dataset.locations.find((x) => x.id === locationId);
  state.sendingMessage = true;
  sendBtn.disabled = true;
  setMessageStatus("Sending message...", "");
  try {
    await addDoc(collection(db, "messages"), {
      from: state.role,
      to,
      text,
      locationId: loc ? loc.id : "",
      locationName: loc ? loc.name : "",
      createdAt: serverTimestamp(),
    });
    textArea.value = "";
    setMessageStatus("Message sent.", "ok");
  } catch (error) {
    console.error(error);
    setMessageStatus("Message send failed. Check Firestore rules and browser console.", "error");
  } finally {
    state.sendingMessage = false;
    sendBtn.disabled = false;
  }
}

function setupMessageViewButtons() {
  const buttons = document.querySelectorAll("#msg-toolbar [data-view]");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.msgView = btn.dataset.view;
      buttons.forEach((x) => x.classList.toggle("on", x === btn));
      renderMessages();
    });
  });
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
      const target = btn.dataset.tab;
      tabs.forEach((x) => {
        const on = x === btn;
        x.classList.toggle("active", on);
        x.setAttribute("aria-selected", on ? "true" : "false");
      });
      Object.entries(panels).forEach(([name, panel]) => {
        const on = name === target;
        panel.classList.toggle("active", on);
        panel.hidden = !on;
      });
      if (target === "alerts") renderAlerts();
      if (target === "messages") renderMessages();
      setTimeout(() => state.map?.invalidateSize(), 100);
    });
  });
}

function setupRoleSwitch() {
  document.querySelectorAll(".role-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const role = btn.dataset.role;
      if (role !== "donor" && role !== "organization" && role !== "need") return;
      state.role = role;
      saveRole(role);
      renderRoleButtons();
      renderRoleHint();
      refreshMessageRoleOptions();
      renderAlerts();
      renderMessages();
      if (state.selectedId) {
        const loc = dataset.locations.find((x) => x.id === state.selectedId);
        renderDetail(loc || null);
      }
    });
  });
}

function applyLocationOverridesFromServer(data) {
  const d = data && typeof data === "object" ? data : {};
  const s = d.statusById;
  const w = d.wishlistById;
  state.statusById =
    s && typeof s === "object" ? /** @type {Record<string, keyof STATUS_META>} */ ({ ...s }) : {};
  state.wishlistById = w && typeof w === "object" ? { ...w } : {};
}

/** @param {{ id: string }} loc */
async function saveWishlistForLocation(loc, textarea, saveBtn) {
  if (state.savingWishlist || !isFirebaseConfigured) return;
  state.savingWishlist = true;
  saveBtn.disabled = true;
  setPlaceSyncStatus("Saving wishlist…", "");
  const lines = textarea.value
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    await setDoc(
      doc(db, ...LOCATION_OVERRIDES),
      { wishlistById: { [loc.id]: lines }, updatedAt: serverTimestamp() },
      { merge: true }
    );
    setPlaceSyncStatus("Wishlist updated for everyone.", "ok");
  } catch (error) {
    console.error(error);
    setPlaceSyncStatus("Could not save wishlist. Check Firestore rules.", "error");
  } finally {
    state.savingWishlist = false;
    saveBtn.disabled = false;
  }
}

function setupLocationOverridesRealtime() {
  if (!isFirebaseConfigured) return;

  const ref = doc(db, ...LOCATION_OVERRIDES);
  onSnapshot(
    ref,
    (snap) => {
      applyLocationOverridesFromServer(snap.exists ? snap.data() : {});
      renderList();
      const selected = state.selectedId ? dataset.locations.find((x) => x.id === state.selectedId) : null;
      renderDetail(selected || null);
      dataset.locations.forEach((l) => updateMarkerStyle(l.id));
      renderAlerts();
    },
    (error) => {
      console.error(error);
      setPlaceSyncStatus("Could not load shared place updates from Firestore.", "error");
    }
  );
}

function setupMessageRealtime() {
  const intro = document.getElementById("msg-intro");
  const sendBtn = document.getElementById("msg-send");

  if (!isFirebaseConfigured) {
    intro.textContent =
      "Firebase is not configured yet. Add your keys in js/firebase-config.js to enable shared messaging.";
    sendBtn.disabled = true;
    setMessageStatus("Messaging disabled until Firebase is configured.", "error");
    return;
  }

  const q = query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(200));
  onSnapshot(
    q,
    (snap) => {
      state.messages = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderMessages();
    },
    (error) => {
      console.error(error);
      intro.textContent = "Could not load shared messages. Check Firebase rules.";
      setMessageStatus("Could not read messages from Firestore.", "error");
    }
  );
}

async function main() {
  const res = await fetch("data/locations.json");
  if (!res.ok) throw new Error("Failed to load locations");
  dataset = await res.json();

  state.role = loadRole();
  state.statusById = isFirebaseConfigured ? {} : loadStatusOverrides();
  state.wishlistById = {};

  renderRoleButtons();
  renderRoleHint();
  renderFilters();
  renderList();
  renderDetail(null);
  renderAlerts();

  setupTabs();
  setupRoleSwitch();
  setupMessageViewButtons();
  refreshMessageRoleOptions();
  populateMessageLocations();
  setupMessageRealtime();
  setupLocationOverridesRealtime();

  document.getElementById("msg-send").addEventListener("click", postMessage);

  initMap();
}

main().catch((e) => {
  console.error(e);
  const detail = document.getElementById("detail");
  detail.innerHTML = '<p class="empty-state">Could not load data. Serve this folder over HTTP or deploy to Vercel.</p>';
});
