"""ArenaFlowCluster backend application package.

Layered structure:
  app/api/       Flask blueprint — REST endpoints only, no business logic.
  app/core/      engine orchestration (background tick loop) + the shared
                 thread-safe live-state store.
  app/services/  scheduler/consolidation/cost/Kubernetes domain logic —
                 framework-agnostic, unit-tested without Flask or a live cluster.
"""
from __future__ import annotations

from . import _paths  # noqa: F401  (side effect: simulator + ml on sys.path)

from flask import Flask
from flask_cors import CORS


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    from app.core.engine import ENGINE
    from app.api import api_bp

    app.register_blueprint(api_bp)
    ENGINE.start()

    return app
