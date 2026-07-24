"""Put the sibling `simulator` and `ml` packages on sys.path (monorepo layout)."""
import os
import sys

# this file: backend/app/_paths.py -> up three levels to the repo root
_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
for _pkg in ("simulator", "ml"):
    _p = os.path.join(_ROOT, _pkg)
    if _p not in sys.path:
        sys.path.insert(0, _p)
