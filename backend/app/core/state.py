"""Thread-safe latest-state store.

The engine thread writes a fresh snapshot each tick; Flask request handlers read
from it without blocking the tick loop.
"""
from __future__ import annotations

import threading


class Store:
    def __init__(self):
        self._lock = threading.Lock()
        self._snap: dict = {"ready": False}

    def set(self, snapshot: dict) -> None:
        with self._lock:
            self._snap = snapshot

    def get(self) -> dict:
        with self._lock:
            return self._snap


STORE = Store()
