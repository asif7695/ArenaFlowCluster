"""Make the sibling `simulator` package importable from the ml package.

Hackathon monorepo: the three Python packages live side by side and depend
downward (ml -> simulator). This adds ../simulator to sys.path on import.
"""
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SIM = os.path.join(_ROOT, "simulator")
if _SIM not in sys.path:
    sys.path.insert(0, _SIM)
