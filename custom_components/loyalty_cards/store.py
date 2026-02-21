"""Storage manager for Loyalty Cards."""
from __future__ import annotations

import logging
import uuid
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION

_LOGGER = logging.getLogger(__name__)


class LoyaltyCardsStore:
    """Manage loyalty cards storage."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the store."""
        self._store: Store[dict[str, Any]] = Store(
            hass, STORAGE_VERSION, STORAGE_KEY
        )
        self._data: dict[str, Any] | None = None

    async def async_load(self) -> None:
        """Load data from storage."""
        data = await self._store.async_load()
        if data is None:
            self._data = {"cards": []}
        else:
            self._data = data

    async def _async_save(self) -> None:
        """Save data to storage."""
        await self._store.async_save(self._data)

    def get_cards(self) -> list[dict[str, Any]]:
        """Return all cards."""
        if self._data is None:
            return []
        return self._data.get("cards", [])

    async def async_add_card(
        self, name: str, code: str, code_type: str
    ) -> dict[str, Any]:
        """Add a new loyalty card."""
        card = {
            "id": str(uuid.uuid4()),
            "name": name,
            "code": code,
            "code_type": code_type,
        }
        self._data["cards"].append(card)
        await self._async_save()
        _LOGGER.debug("Added loyalty card: %s (%s)", name, code_type)
        return card

    async def async_remove_card(self, card_id: str) -> bool:
        """Remove a loyalty card by ID. Returns True if found and removed."""
        cards = self._data.get("cards", [])
        original_len = len(cards)
        self._data["cards"] = [c for c in cards if c["id"] != card_id]
        if len(self._data["cards"]) < original_len:
            await self._async_save()
            _LOGGER.debug("Removed loyalty card: %s", card_id)
            return True
        return False
