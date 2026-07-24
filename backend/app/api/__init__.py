"""REST API blueprint — presentation layer only, no business logic.

Route handlers just read the engine's live snapshot (app.core.state.STORE) and
the live engine control fields; all decision-making lives in app.services.
"""
from flask import Blueprint

api_bp = Blueprint("api", __name__)

from . import routes  # noqa: E402,F401  (side effect: registers routes on api_bp)
