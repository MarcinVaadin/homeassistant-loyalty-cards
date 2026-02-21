"""Constants for the Loyalty Cards integration."""

DOMAIN = "loyalty_cards"
STORAGE_KEY = "loyalty_cards"
STORAGE_VERSION = 1

PANEL_TITLE = "Loyalty Cards"
PANEL_ICON = "mdi:card-account-details-outline"
PANEL_URL = "loyalty-cards"

PANEL_FRONTEND_PATH = "frontend"
PANEL_FILENAME = "loyalty-cards-panel.js"
PANEL_COMPONENT_NAME = "loyalty-cards-panel"
PANEL_STATIC_PATH = "/loyalty_cards_panel"

WS_TYPE_LIST = "loyalty_cards/cards/list"
WS_TYPE_ADD = "loyalty_cards/cards/add"
WS_TYPE_REMOVE = "loyalty_cards/cards/remove"

# Maps html5-qrcode format names to storage code_type values
SCANNER_FORMAT_MAP = {
    "QR_CODE": "qr",
    "EAN_13": "ean13",
    "EAN_8": "ean8",
    "UPC_A": "upca",
    "UPC_E": "upce",
    "CODE_128": "code128",
    "CODE_39": "code39",
    "CODE_93": "code93",
    "CODABAR": "codabar",
    "ITF": "itf",
    "DATA_MATRIX": "datamatrix",
    "PDF_417": "pdf417",
}
