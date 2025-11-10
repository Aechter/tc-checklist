// app.js – lokale Liste + optionaler Projektsync
import { enableProjectSync } from "./sync.js";

const listEl = document.getElementById("list");
const addForm = document.getElementById("addForm");
const itemInput = document.getElementById("itemInput");
const ctxHint = document.getElementById("ctxHint");
const logArea = document.getElementById("logArea");
const toggleSyncBtn = document.getElementById("toggleSyncBtn");
const forcePullBtn = document.getElementById("forcePullBtn");
const forcePushBtn = document.getElementById("forcePushBtn");
const syncBadge = document.getElementById("syncBadge");

let STORAGE_KEY = null;
let items = [];
let context = { projectId: "unknown", path: "/", userEmail: "unknown" };
let sync = null; // holds sync controller

function log(msg) {
  console.log("[Checklist]", msg);
  logArea.textContent = String(msg);
}

async function getWorkspaceContext() {
  const w = window.trimble?.connect?.workspace;
  if (!w?.getContext) return { projectId: "unknown", path: "/", userEmail: "unknown" };
  const ctx = await w.getContext();
  return {
    projectId: ctx?.project?.id || "unknown",
    path: ctx?.explorer?.path || "/",
    userEmail: ctx?.user?.email || "unknown"
  };
}

function key(ctx) { return `tc_checklist::${ctx.projectId}::${ctx.path}`; }
function load(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } }
function save(k, items) { localStorage.setItem(k, JSON.stringify(items)); }

function render() {
  listEl.innerHTML = "";
  items.forEach((it, i) => {
    const li = document.createElement("li");
    if (it.done) li.classList.add("done");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = it.done;
    cb.addEventListener("change", () => {
      items[i].done = cb.checked;
      save(STORAGE_KEY, items);
      if (sync?.isOn()) sync.schedulePush();
      render();
    });

    const label = document.createElement("label");
    label.textContent = it.text;

    const spacer = document.createElement("div");
    spacer.className = "spacer";

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Löschen";
    del.addEventListener("click", () => {
      items.splice(i, 1);
      save(STORAGE_KEY, items);
      if (sync?.isOn()) sync.schedulePush();
      render();
    });

    li.append(cb, label, spacer, del);
    listEl.appendChild(li);
  });
}

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const txt = itemInput.value.trim();
  if (!txt) return;
  items.push({ text: txt, done: false, ts: Date.now() });
  save(STORAGE_KEY, items);
  if (sync?.isOn()) sync.schedulePush();
  itemInput.value = "";
  render();
});

function setSyncUI(on) {
  syncBadge.textContent = on ? "Sync: an" : "Sync: aus";
  toggleSyncBtn.textContent = on ? "Sync deaktivieren" : "Sync aktivieren";
  forcePullBtn.disabled = !on;
  forcePushBtn.disabled = !on;
}

(async () => {
  context = await getWorkspaceContext();
  STORAGE_KEY = key(context);
  items = load(STORAGE_KEY);
  ctxHint.textContent = `Kontext: Projekt ${context.projectId}, Pfad "${context.path}" – lokal gespeichert.`;
  render();
  setSyncUI(false);

  // Setup sync controller (does nothing until turned on)
  sync = enableProjectSync({
    context,
    itemsRef: () => items,
    onRemoteLoad(newItems) {
      if (Array.isArray(newItems)) {
        items = newItems;
        save(STORAGE_KEY, items);
        render();
        log("Remote-Checkliste geladen.");
      }
    },
    onStatus(msg) { log(msg); }
  });

  toggleSyncBtn.addEventListener("click", async () => {
    if (sync.isOn()) {
      sync.turnOff();
      setSyncUI(false);
      log("Sync deaktiviert.");
      return;
    }
    try {
      await sync.turnOn();
      setSyncUI(true);
      log("Sync aktiviert.");
    } catch (e) {
      log("Sync konnte nicht aktiviert werden: " + (e?.message || e));
    }
  });

  forcePullBtn.addEventListener("click", async () => {
    try { await sync.pullNow(); } catch (e) { log("Pull-Fehler: " + (e?.message || e)); }
  });
  forcePushBtn.addEventListener("click", async () => {
    try { await sync.pushNow(); } catch (e) { log("Push-Fehler: " + (e?.message || e)); }
  });
})();
