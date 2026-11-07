from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash
from db import get_db_connection, dict_cursor, log_activity
from datetime import datetime

admin_auth_bp = Blueprint("admin_auth", __name__)

def _check_hash(stored, plain):
    if not stored or not plain:
        return False
    # hashed (scrypt:/pbkdf2:) -> check hash, plain (1234) -> plain compare for legacy rows
    if str(stored).startswith(("scrypt:", "pbkdf2:")):
        return check_password_hash(stored, str(plain))
    return str(stored) == str(plain)

@admin_auth_bp.route("/login/admin", methods=["POST"])
def login_admin():
    d = request.json or {}
    username = (d.get("username") or d.get("email") or "").strip()
    password = d.get("password") or ""
    pin = str(d.get("pin") or "").strip()

    if not username or not password or not pin:
        return jsonify({"error": "All fields required: username, password, PIN"}), 400

    conn = get_db_connection(); cur = dict_cursor(conn)
    cur.execute("SELECT * FROM admin_users WHERE email=%s OR username=%s OR full_name=%s LIMIT 1", (username, username, username))
    a = cur.fetchone()
    if not a:
        cur.close(); conn.close()
        return jsonify({"error": "Invalid username"}), 401

    if not _check_hash(a.get("password_hash") or a.get("password"), password):
        cur.close(); conn.close()
        log_activity(a.get("full_name") or username, "Admin", "Security Alert", description=f"Failed admin login - wrong password • {username} • IP {request.remote_addr}")
        return jsonify({"error": "Invalid password"}), 401

    if not _check_hash(a.get("pin_hash") or a.get("pin"), pin):
        cur.close(); conn.close()
        log_activity(a.get("full_name") or username, "Admin", "Security Alert", description=f"Failed admin login - wrong PIN • {username} • IP {request.remote_addr}")
        return jsonify({"error": "Invalid PIN"}), 401

    cur.execute("UPDATE admin_users SET last_login=NOW(), ip_address=%s WHERE id=%s", (request.remote_addr, a["id"])); conn.commit()
    log_activity(a["full_name"], "Admin", "Login", description=f"Admin login {a['email']} • {datetime.now()}")
    cur.close(); conn.close()
    return jsonify({"id": a["id"], "username": a.get("username"), "full_name": a["full_name"], "name": a["full_name"], "email": a["email"], "phone": a.get("phone"), "role": a.get("role"), "avatar": a.get("avatar_url") or a.get("avatar")})


@admin_auth_bp.route("/logout/admin", methods=["POST"])
def logout_admin():
    d = request.json or {}
    username = (d.get("username") or d.get("email") or "Admin").strip()
    # Log it - immutable audit
    try:
        log_activity(username, "Admin", "Logout", description=f"Admin logout • IP {request.remote_addr} • Inglewood CA 90301 PST")
    except:
        pass
    res = make_response(jsonify({"success": True, "message": "Logged out"}))
    # Delete cookies - backend side
    res.set_cookie("autoville_admin", "", expires=0, path="/", httponly=False, samesite="Lax")
    res.set_cookie("autoville_token", "", expires=0, path="/", httponly=False, samesite="Lax")
    res.set_cookie("autoville_user", "", expires=0, path="/", httponly=False, samesite="Lax")
    res.set_cookie("session", "", expires=0, path="/")
    return res
@admin_auth_bp.route("/verify/admin", methods=["GET", "POST"])
def verify_admin():
    # Guard calls this every 30s + on focus + on storage change
    # If no valid admin in localStorage -> frontend sends nothing -> 401
    d = request.json or {}
    username = (d.get("username") or d.get("email") or request.args.get("username") or "").strip()
    if not username:
        return jsonify({"authenticated": False, "error": "No session"}), 401
    conn = get_db_connection(); cur = dict_cursor(conn)
    cur.execute("SELECT id, username, full_name, email FROM admin_users WHERE username=%s OR email=%s OR full_name=%s LIMIT 1", (username, username, username))
    a = cur.fetchone(); cur.close(); conn.close()
    if not a:
        return jsonify({"authenticated": False, "error": "Admin not found"}), 401
    return jsonify({"authenticated": True, "id": a["id"], "username": a.get("username"), "full_name": a.get("full_name"), "email": a.get("email")})