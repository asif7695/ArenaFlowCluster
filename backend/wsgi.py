"""Entrypoint: `python wsgi.py` for local dev, or any WSGI server pointing
at `wsgi:app` (e.g. `gunicorn wsgi:app`) in production/containers."""
from app import create_app

app = create_app()

if __name__ == "__main__":
    # threaded so the tick loop and requests coexist; use_reloader off to avoid
    # starting the engine twice.
    app.run(host="0.0.0.0", port=5000, threaded=True, use_reloader=False)
