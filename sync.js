// sync.js – Projektsync über Trimble Connect Core API (EU-Endpoint als Platzhalter)
const REGION_BASE = "https://connect-eu.trimble.com"; // Bei Bedarf auf US-Region ändern
const CORE = `${REGION_BASE}/tc/api/2.0`;

// Hilfsfunktionen
function sanitizeFilename(s) {
  // Erzeuge einen stabilen Dateinamen pro Pfad: checklist-<pfad>.json
  const safe = s.replace(/[^a-z0-9-_]/gi, "_").replace(/_+/g, "_").toLowerCase();
  return `checklist${safe === "_" ? "" : "-" + safe}.json`;
}

async function getAccessTokenFromWorkspace() {
  const w = window.trimble?.connect?.workspace;
  if (w?.getAccessToken) {
    const token = await w.getAccessToken();
    if (!token) throw new Error("Kein Access Token erhalten.");
    return token;
  }
  throw new Error("workspace.getAccessToken() nicht verfügbar. Öffne die App innerhalb von Trimble Connect (Web).");
}

async function tcGET(url, token) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
  return r.json();
}

async function tcPOSTjson(url, token, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`POST ${url} -> ${r.status}`);
  return r.json();
}

async function tcPOSTmultipart(url, token, form) {
  const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  if (!r.ok) throw new Error(`POST ${url} -> ${r.status}`);
  return r.json();
}

async function ensureFolder(projectId, token, folderName = "Checklists") {
  const res = await tcGET(`${CORE}/projects/${projectId}/folders`, token);
  const folders = Array.isArray(res?.items) ? res.items : [];
  let folder = folders.find(f => f.name === folderName);
  if (!folder) {
    const created = await tcPOSTjson(`${CORE}/projects/${projectId}/folders`, token, { name: folderName, parentId: null });
    folder = created;
  }
  return folder;
}

async function listFiles(projectId, token, folderId) {
  const res = await tcGET(`${CORE}/projects/${projectId}/files?folderId=${encodeURIComponent(folderId)}`, token);
  return Array.isArray(res?.items) ? res.items : [];
}

// NOTE: Der genaue Download-Endpunkt kann je nach Core-API Version variieren.
// Hier verwenden wir ein übliches Muster: erst Download-URL holen, dann Inhalt laden.
async function getDownloadUrl(projectId, token, fileId) {
  const r = await tcPOSTjson(`${CORE}/projects/${projectId}/files/${fileId}/download-url`, token, {});
  return r?.url;
}

async function downloadJsonById(projectId, token, fileId) {
  const url = await getDownloadUrl(projectId, token, fileId);
  if (!url) throw new Error("Kein Download-URL erhalten.");
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Download fehlgeschlagen: " + resp.status);
  return resp.json();
}

async function uploadJson(projectId, folderId, token, filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const file = new File([blob], filename, { type: "application/json" });

  const form = new FormData();
  form.append("file", file);
  // Falls die API ein weiteres Feld benötigt (z. B. "overwrite" oder "parentId"), ggf. anpassen:
  // form.append("overwrite", "true");

  const up = await tcPOSTmultipart(`${CORE}/projects/${projectId}/files?folderId=${encodeURIComponent(folderId)}`, token, form);
  return up; // enthält ggf. File-/Version-Infos
}

export function enableProjectSync({ context, itemsRef, onRemoteLoad, onStatus }) {
  const state = {
    on: false,
    timer: null,
    lastPush: 0,
    folderId: null,
    fileId: null,
    filename: sanitizeFilename(context.path || "/")
  };

  function status(msg) { if (typeof onStatus === "function") onStatus(msg); }

  async function initIfNeeded(token) {
    if (state.folderId) return;
    status("Prüfe/erstelle Projektordner…");
    const folder = await ensureFolder(context.projectId, token, "Checklists");
    state.folderId = folder?.id;
    if (!state.folderId) throw new Error("Folder-ID fehlt.");

    status("Suche vorhandene Checkliste…");
    const files = await listFiles(context.projectId, token, state.folderId);
    const hit = files.find(f => f.name === state.filename);
    state.fileId = hit?.id || null;
  }

  async function pullNow() {
    const token = await getAccessTokenFromWorkspace();
    await initIfNeeded(token);
    if (!state.fileId) {
      status("Keine Remote-Datei vorhanden (wird beim ersten Push erstellt).");
      return;
    }
    status("Lade Remote-Checkliste…");
    const json = await downloadJsonById(context.projectId, token, state.fileId);
    if (json && Array.isArray(json)) onRemoteLoad(json);
  }

  async function pushNow() {
    const token = await getAccessTokenFromWorkspace();
    await initIfNeeded(token);

    status(state.fileId ? "Speichere neue Version…" : "Lade erste Version hoch…");
    const res = await uploadJson(context.projectId, state.folderId, token, state.filename, itemsRef());
    // Wenn API eine neue Version anlegt, sollte res die fileId enthalten (ggf. aktualisieren)
    if (res?.id) state.fileId = res.id;
    state.lastPush = Date.now();
    status("Remote gespeichert.");
  }

  function schedulePush() {
    if (!state.on) return;
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => { pushNow().catch(e => status("Push-Fehler: " + (e?.message || e))); }, 1000);
  }

  return {
    isOn: () => state.on,
    async turnOn() {
      if (state.on) return;
      // Teste Token-Zugriff vorab
      await getAccessTokenFromWorkspace();
      state.on = true;
      await pullNow(); // zuerst holen, um lokalen Stand zu aktualisieren
      schedulePush();  // danach einmalig hochladen
    },
    turnOff() {
      state.on = false;
      if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    },
    schedulePush,
    pullNow,
    pushNow
  };
}
