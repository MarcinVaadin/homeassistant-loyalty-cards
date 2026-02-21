"""WebSocket API for Loyalty Cards."""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN, WS_TYPE_ADD, WS_TYPE_LIST, WS_TYPE_REMOVE


def async_register_commands(hass: HomeAssistant) -> None:
    """Register WebSocket commands."""
    websocket_api.async_register_command(hass, ws_list_cards)
    websocket_api.async_register_command(hass, ws_add_card)
    websocket_api.async_register_command(hass, ws_remove_card)


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_LIST,
    }
)
@callback
def ws_list_cards(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Handle list cards WebSocket command."""
    store = hass.data[DOMAIN]["store"]
    cards = store.get_cards()
    connection.send_result(msg["id"], {"cards": cards})


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_ADD,
        vol.Required("name"): str,
        vol.Required("code"): str,
        vol.Required("code_type"): str,
    }
)
@websocket_api.async_response
async def ws_add_card(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Handle add card WebSocket command."""
    store = hass.data[DOMAIN]["store"]
    card = await store.async_add_card(
        msg["name"], msg["code"], msg["code_type"]
    )
    connection.send_result(msg["id"], {"card": card})


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_TYPE_REMOVE,
        vol.Required("card_id"): str,
    }
)
@websocket_api.async_response
async def ws_remove_card(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Handle remove card WebSocket command."""
    store = hass.data[DOMAIN]["store"]
    removed = await store.async_remove_card(msg["card_id"])
    if removed:
        connection.send_result(msg["id"], {})
    else:
        connection.send_error(msg["id"], "card_not_found", "Card not found")
