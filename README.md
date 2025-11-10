# Trimble Connect Checklist (mit optionalem Projektsync)

**Kurz:** Statische Web-Extension für Trimble Connect (Browser). Lokal speichernd, optional Projektsync über die Trimble Connect Core API. 

## Dateien
- `manifest.json` – Manifest-URL in TC → Settings → Extensions eintragen
- `index.html` – UI
- `app.js` – Liste & UI-Logik, Sync-Steuerung
- `sync.js` – Core-API Calls (via Access Token aus Workspace)

## Ablauf
1. Hoste die Dateien (z. B. GitHub Pages, HTTPS).
2. In `manifest.json` die `url` (und optional `icon`) auf deine Domain anpassen.
3. Manifest-URL in Trimble Connect (Web) → Projekt → Settings → Extensions eintragen.
4. In der Extension den **Sync**-Button drücken. 
   - Das Script versucht ein Access Token via `window.trimble.connect.workspace.getAccessToken()` zu holen.
   - Im Projekt wird ein Ordner `Checklists` verwendet.
   - Pro Explorer-Pfad wird eine JSON-Datei `checklist-<pfad>.json` gespeichert.
5. „Remote laden“/„Remote speichern“ testet Pull/Push manuell.

> Hinweis: Die verwendeten Core-API-Endpunkte sind gängige Muster. Je nach Version/Region können sie leicht variieren. Im Zweifel bitte die offizielle Doku heranziehen und die URLs minimal anpassen.
