# CLAUDE.md — Agent Context for Claude Code

## Project Overview

**Loyalty Cards** is a HACS custom integration for Home Assistant that adds a sidebar panel for managing loyalty/store cards. Each card stores a shop name and a code (barcode or QR). Users can view, add (via phone camera scan), and delete cards. Data persists across HA restarts using the built-in storage helper.

## Architecture

```
Browser (LitElement-free HTMLElement panel)
    ↕ WebSocket API
Home Assistant Core (Python custom integration)
    ↕ homeassistant.helpers.storage.Store
.storage/loyalty_cards (JSON file)
```

**Backend:** Python custom integration at `custom_components/loyalty_cards/`. Uses config flow (UI setup via Settings > Integrations). No YAML configuration needed.

**Frontend:** Single JS file (`frontend/loyalty-cards-panel.js`) using plain `HTMLElement` — NOT LitElement, NOT Shadow DOM. This is intentional because `html5-qrcode` uses `document.getElementById()` which doesn't penetrate Shadow DOM.

**Communication:** Three WebSocket commands handle all CRUD:
- `loyalty_cards/cards/list` — returns all cards
- `loyalty_cards/cards/add` — creates a card (name, code, code_type)
- `loyalty_cards/cards/remove` — deletes a card by id

## Directory Structure

```
custom_components/loyalty_cards/
├── __init__.py          — async_setup_entry: panel registration, static paths, WS commands, store init
├── const.py             — DOMAIN, storage keys, WS type strings, code type mappings
├── config_flow.py       — Minimal config flow (single confirm step, prevents duplicates)
├── store.py             — LoyaltyCardsStore wrapping HA Store helper. CRUD on cards list.
├── websocket_api.py     — Three @websocket_command handlers with voluptuous validation
├── manifest.json        — Integration metadata (dependencies: http, frontend, panel_custom)
├── strings.json         — Config flow UI text
└── frontend/
    ├── loyalty-cards-panel.js  — Entire UI (~700 lines). Grid, detail dialog, add dialog, scanner.
    └── lib/
        ├── jsbarcode.all.min.js    — v3.11.6, MIT, barcode rendering
        ├── qrcode-svg.min.js       — v1.1.0, MIT, QR code SVG generation
        ├── html5-qrcode.min.js     — v2.3.8, Apache 2.0, camera barcode/QR scanning
        └── THIRD_PARTY_LICENSES    — License texts for all vendored libraries
```

## Storage Schema

File: `.storage/loyalty_cards` (managed by HA Store helper)

```json
{
  "version": 1,
  "key": "loyalty_cards",
  "data": {
    "cards": [
      {
        "id": "uuid4-string",
        "name": "Shop Name",
        "code": "5901234123457",
        "code_type": "ean13"
      }
    ]
  }
}
```

## Code Type Mapping

html5-qrcode detects formats like `QR_CODE`, `EAN_13`, etc. These are stored in lowercase shorthand (`qr`, `ean13`). When rendering barcodes, they map to JsBarcode format names (`EAN13`, `CODE128`, etc.). See `const.py` for the full mapping.

For 2D codes (QR, DataMatrix, PDF417), barcode view falls back to CODE128 encoding.

## Key Patterns

- **WebSocket commands** are registered in `websocket_api.py` via `@websocket_api.websocket_command` decorator with voluptuous schema. Sync handlers use `@callback`, async handlers use `@websocket_api.async_response`.
- **Static files** are served via `hass.http.async_register_static_paths([StaticPathConfig(...)])`.
- **Panel** is registered via `panel_custom.async_register_panel()` with `module_url` pointing to the JS file.
- **Frontend JS** loads vendored libraries via dynamic `<script>` injection (not ES module imports, since they're UMD/IIFE bundles). Base path derived from `import.meta.url`.
- **CSS** uses HA custom properties (`--primary-color`, `--ha-card-background`, `--primary-text-color`, etc.) for theme integration.
- **Scanner** (html5-qrcode) is loaded lazily — only when the Add Card dialog opens — to reduce initial page load.

## Gotchas

1. **No Shadow DOM.** The panel uses plain DOM with scoped CSS class names (prefixed `lc-`). html5-qrcode calls `document.getElementById()` which doesn't work inside Shadow DOM.
2. **Camera requires HTTPS.** `navigator.mediaDevices.getUserMedia()` needs a secure context. The panel checks `window.isSecureContext` and shows a fallback manual entry form if not secure.
3. **JsBarcode can throw** if the code value is invalid for the format (e.g., non-numeric for EAN-13). Always wrap in try/catch and fall back to CODE128.
4. **Scanner cleanup is critical.** Always call `scanner.stop()` when closing the add dialog or when the component disconnects, otherwise the camera stays active.
5. **Library loading is async.** The panel waits for libraries to load before rendering barcodes/QR codes. A loading state is shown while waiting.

## Testing Changes

1. Copy `custom_components/loyalty_cards/` into your HA instance's `custom_components/` directory
2. Restart Home Assistant
3. Go to Settings > Integrations > Add Integration > search "Loyalty Cards"
4. Panel appears in the sidebar
5. To test frontend changes without full restart: clear browser cache and hard reload the panel page

## Vendored Library Updates

To update a vendored library:
1. Download the new minified version from npm/GitHub releases
2. Replace the file in `frontend/lib/`
3. Update the version in `THIRD_PARTY_LICENSES`
4. Update the version noted in this file
5. Test that barcode rendering, QR generation, and camera scanning still work
