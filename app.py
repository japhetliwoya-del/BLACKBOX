"""BLACKBOX web host. Serves the simulator; never executes operating-system commands."""
from pathlib import Path
from flask import Flask, abort, jsonify, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
ALLOWED_ASSETS = {"style.css", "script.js"}

app = Flask(__name__)
app.config.update(
    MAX_CONTENT_LENGTH=1 * 1024 * 1024,
    SEND_FILE_MAX_AGE_DEFAULT=300,
    JSON_SORT_KEYS=False,
)


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/api/health")
def health():
    return jsonify(status="ok", app="BLACKBOX", mode="browser-simulation")


@app.get("/<path:asset>")
def assets(asset: str):
    # Explicit allowlist: user-supplied paths cannot read arbitrary server files.
    if asset not in ALLOWED_ASSETS:
        abort(404)
    return send_from_directory(BASE_DIR, asset)


@app.after_request
def security_headers(response):
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self'; "
        "img-src 'self' data:; connect-src 'self'; font-src 'self'; "
        "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    if response.content_type.startswith("text/html"):
        response.headers["Cache-Control"] = "no-store"
    return response


if __name__ == "__main__":
    # Local development only. Use a production WSGI server for deployment.
    app.run(host="127.0.0.1", port=5000, debug=False)
