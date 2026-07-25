"""pytest bootstrap: make the simulator package importable regardless of cwd."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
