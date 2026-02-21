# Loyalty Cards for Home Assistant

A custom Home Assistant integration that adds a sidebar panel for managing loyalty/store cards. View your cards at a glance, tap to display the barcode or QR code at checkout, and scan new cards with your phone camera.

## Features

- Grid dashboard of all your loyalty cards in the HA sidebar
- Tap a card to view its barcode or QR code full-screen (ideal for checkout scanning)
- Toggle between barcode and QR code display for any card
- Add new cards by scanning existing physical cards with your phone camera
- Manual code entry fallback for environments without camera access
- Delete cards you no longer need
- Works offline — all JS libraries are bundled, no CDN required
- Follows your HA theme (light/dark mode support)
- Data persists across HA restarts via built-in storage

## Installation

### HACS (Recommended)

1. Open HACS in your Home Assistant instance
2. Click the three-dot menu in the top right and select **Custom repositories**
3. Add `https://github.com/marcinvaadin/homeassistant-loyalty-cards` with category **Integration**
4. Click **Install**
5. Restart Home Assistant
6. Go to **Settings > Integrations > Add Integration** and search for **Loyalty Cards**

### Manual

1. Copy the `custom_components/loyalty_cards` directory into your Home Assistant `custom_components/` directory
2. Restart Home Assistant
3. Go to **Settings > Integrations > Add Integration** and search for **Loyalty Cards**

## Usage

After installation, a **Loyalty Cards** entry appears in your sidebar.

- **View cards:** Open the panel to see all your cards in a grid
- **View code:** Tap any card to see its barcode. Use the toggle to switch between barcode and QR code display
- **Add a card:** Tap the **+** button, enter the shop name, then scan the card's barcode/QR code with your camera (or enter the code manually)
- **Delete a card:** Open a card's detail view and tap the delete button

### Camera Scanning Requirements

Camera scanning requires a **secure context** (HTTPS). This works automatically when using:
- Home Assistant Companion App
- Nabu Casa cloud remote access
- A reverse proxy with HTTPS

If accessing HA over plain HTTP on a local network, the camera will not be available. Use the **Enter manually** fallback to type in the code instead.

## Architecture

```
Browser (HTMLElement custom panel)
    ↕ WebSocket API
Home Assistant (Python custom integration)
    ↕ homeassistant.helpers.storage.Store
.storage/loyalty_cards (JSON)
```

### Backend (Python)

| File | Role |
|------|------|
| `__init__.py` | Integration entry point. Registers the panel, static file paths, and WebSocket commands. |
| `config_flow.py` | Minimal UI-based config flow (Settings > Integrations). |
| `store.py` | `LoyaltyCardsStore` class — wraps HA's `Store` helper for CRUD operations on card data. |
| `websocket_api.py` | Three WebSocket command handlers for list/add/remove operations. |
| `const.py` | Constants: domain, storage keys, WS command types, code type mappings. |
| `manifest.json` | Integration metadata and dependencies. |
| `strings.json` | Config flow UI strings. |

### Frontend (JavaScript)

| File | Role |
|------|------|
| `frontend/loyalty-cards-panel.js` | The entire UI as a single `HTMLElement` custom element. Contains grid view, detail dialog, add dialog with camera scanner, and empty state. |
| `frontend/lib/jsbarcode.all.min.js` | Barcode rendering (EAN-13, Code 128, etc.) |
| `frontend/lib/qrcode-svg.min.js` | QR code SVG generation |
| `frontend/lib/html5-qrcode.min.js` | Camera-based barcode/QR code scanning |

### WebSocket API

All commands use the HA WebSocket connection (`hass.connection.sendMessagePromise()`).

#### `loyalty_cards/cards/list`

Returns all stored cards.

**Request:**
```json
{ "type": "loyalty_cards/cards/list" }
```

**Response:**
```json
{
  "cards": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Biedronka",
      "code": "5901234123457",
      "code_type": "ean13"
    }
  ]
}
```

#### `loyalty_cards/cards/add`

Adds a new card.

**Request:**
```json
{
  "type": "loyalty_cards/cards/add",
  "name": "Biedronka",
  "code": "5901234123457",
  "code_type": "ean13"
}
```

**Response:**
```json
{
  "card": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Biedronka",
    "code": "5901234123457",
    "code_type": "ean13"
  }
}
```

#### `loyalty_cards/cards/remove`

Removes a card by ID.

**Request:**
```json
{
  "type": "loyalty_cards/cards/remove",
  "card_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:** empty result on success, error if card not found.

### Storage Schema

Data is stored in `.storage/loyalty_cards` by HA's storage helper. The `code_type` field stores the format detected during scanning:

| code_type | Description | Barcode Format |
|-----------|-------------|----------------|
| `qr` | QR Code | Falls back to CODE128 |
| `ean13` | EAN-13 | EAN13 |
| `ean8` | EAN-8 | EAN8 |
| `upca` | UPC-A | UPC |
| `code128` | Code 128 | CODE128 |
| `code39` | Code 39 | CODE39 |

## Development

### Directory Structure

```
custom_components/loyalty_cards/
├── __init__.py
├── config_flow.py
├── const.py
├── manifest.json
├── store.py
├── strings.json
├── websocket_api.py
└── frontend/
    ├── loyalty-cards-panel.js
    └── lib/
        ├── jsbarcode.all.min.js
        ├── qrcode-svg.min.js
        ├── html5-qrcode.min.js
        └── THIRD_PARTY_LICENSES
```

### Making Frontend Changes

1. Edit `frontend/loyalty-cards-panel.js`
2. Copy the updated file to your HA instance's `custom_components/loyalty_cards/frontend/`
3. Hard-refresh the browser (Ctrl+Shift+R) — no HA restart needed for JS changes

### Adding a New WebSocket Command

1. Add the command type constant to `const.py`
2. Create a handler function in `websocket_api.py` with `@websocket_api.websocket_command` decorator
3. Register it in `async_register_commands()`
4. Call it from the frontend via `this._hass.connection.sendMessagePromise({type: "loyalty_cards/your_command"})`

### Updating Vendored Libraries

1. Download the new minified version from the library's npm package or GitHub releases
2. Replace the corresponding file in `frontend/lib/`
3. Update the version in `frontend/lib/THIRD_PARTY_LICENSES`
4. Test barcode rendering, QR generation, and camera scanning

## Vendored Libraries

| Library | Version | License | Purpose |
|---------|---------|---------|---------|
| [JsBarcode](https://github.com/lindell/JsBarcode) | 3.11.6 | MIT | 1D barcode rendering |
| [qrcode-svg](https://github.com/papnkukn/qrcode-svg) | 1.1.0 | MIT | QR code SVG generation |
| [html5-qrcode](https://github.com/mebjas/html5-qrcode) | 2.3.8 | Apache 2.0 | Camera barcode/QR scanning |

Full license texts are in `custom_components/loyalty_cards/frontend/lib/THIRD_PARTY_LICENSES`.

## Troubleshooting

**Camera not working:**
- Camera requires HTTPS (secure context). Use the HA Companion App, Nabu Casa, or a reverse proxy with SSL.
- Check that your browser has camera permissions enabled for the HA URL.
- On iOS, only Safari has full camera access. Other browsers may have limited support.

**Barcode not rendering:**
- Some code types (QR, DataMatrix) don't have a 1D barcode representation. The integration falls back to CODE128 encoding.
- If the code value is invalid for the detected format, CODE128 is used as a fallback.

**Panel not appearing in sidebar:**
- Ensure you've added the integration via Settings > Integrations > Add Integration.
- Check the HA logs for errors related to `loyalty_cards`.
- Try restarting Home Assistant.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

Vendored third-party libraries have their own licenses. See [THIRD_PARTY_LICENSES](custom_components/loyalty_cards/frontend/lib/THIRD_PARTY_LICENSES).
