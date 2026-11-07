from flask import Flask
from flask_cors import CORS
from db import init_db

from routes.auth import auth_bp
from routes.admin_auth import admin_auth_bp
from routes.bookings import bookings_bp
from routes.finance import finance_bp
from routes.reviews import reviews_bp
from routes.logs import logs_bp
from routes.admin import admin_bp
from routes.workshops import workshops_bp
from routes.owners import owners_bp
from routes.analytics import analytics_bp

app = Flask(__name__)
CORS(app)

# Each blueprint EXACTLY ONCE - unique name, no duplicates
app.register_blueprint(auth_bp, url_prefix="/api/auth")         # /api/auth/login/owner, /api/auth/login/workshop, /api/auth/register/*
app.register_blueprint(admin_auth_bp, url_prefix="/api/auth")  # /api/auth/login/admin - separate file, same prefix
app.register_blueprint(bookings_bp, url_prefix="/api/bookings")
app.register_blueprint(finance_bp, url_prefix="/api")      # /api/admin/incomes, /api/subscriptions, /api/admin/bookkeeping
app.register_blueprint(reviews_bp, url_prefix="/api")     # /api/admin/reviews
app.register_blueprint(logs_bp, url_prefix="/api")        # /api/activity-logs - ONLY ONCE
app.register_blueprint(admin_bp, url_prefix="/api/admin") # /api/admin/profile, /api/admin/password, /api/admin/pin
app.register_blueprint(workshops_bp, url_prefix="/api/workshops")
app.register_blueprint(owners_bp, url_prefix="/api/owners")
app.register_blueprint(analytics_bp, url_prefix="/api")   # /api/admin/analytics

@app.route("/")
def home():
    return {"status": "AutoVille API running", "location": "112 S Market St Inglewood CA 90301 PST"}

if __name__ == "__main__":
    init_db()
    print("DB initialized - AutoVille • 112 S Market St Inglewood CA 90301 PST")
    app.run(host="127.0.0.1", port=5000, debug=True)