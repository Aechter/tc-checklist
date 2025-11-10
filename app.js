// Minimal: lokale Speicherung pro Projekt+Pfad im Browser.

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

const listEl = document.getElementById("list");
const addForm = document.getElementById("addForm");
const itemInput = document.getElementById("itemInput");
const ctxHint = document.getElementById("ctxHint");

let STORAGE_KEY = null;
let items = [];

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
  itemInput.value = "";
  render();
});

(async () => {
  const ctx = await getWorkspaceContext();
  STORAGE_KEY = key(ctx);
  items = load(STORAGE_KEY);
  ctxHint.textContent = `Kontext: Projekt ${ctx.projectId}, Pfad "${ctx.path}" – lokal gespeichert.`;
  render();
})();
