"""The Loyalty Cards integration."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.components.panel_custom import async_register_panel
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    DOMAIN,
    PANEL_COMPONENT_NAME,
    PANEL_FILENAME,
    PANEL_FRONTEND_PATH,
    PANEL_ICON,
    PANEL_STATIC_PATH,
    PANEL_TITLE,
    PANEL_URL,
)
from .store import LoyaltyCardsStore
from .websocket_api import async_register_commands

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Loyalty Cards from a config entry."""
    store = LoyaltyCardsStore(hass)
    await store.async_load()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["store"] = store

    if "commands_registered" not in hass.data[DOMAIN]:
        async_register_commands(hass)
        hass.data[DOMAIN]["commands_registered"] = True

    frontend_path = Path(__file__).parent / PANEL_FRONTEND_PATH

    await hass.http.async_register_static_paths(
        [StaticPathConfig(PANEL_STATIC_PATH, str(frontend_path), False)]
    )

    if PANEL_URL not in hass.data.get("frontend_panels", {}):
        await async_register_panel(
            hass,
            webcomponent_name=PANEL_COMPONENT_NAME,
            frontend_url_path=PANEL_URL,
            sidebar_title=PANEL_TITLE,
            sidebar_icon=PANEL_ICON,
            module_url=f"{PANEL_STATIC_PATH}/{PANEL_FILENAME}",
            embed_iframe=False,
            require_admin=False,
        )

    _LOGGER.info("Loyalty Cards integration set up successfully")
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a Loyalty Cards config entry."""
    hass.components.frontend.async_remove_panel(PANEL_URL)
    hass.data.pop(DOMAIN, None)
    return True
