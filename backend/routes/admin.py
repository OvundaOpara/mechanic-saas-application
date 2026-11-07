from flask import Blueprint, request, jsonify
from db import get_db_connection, dict_cursor, log_activity

admin_bp = Blueprint("admin", __name__)

@admin_bp.route("/profile", methods=["GET", "PUT"])
def admin_profile():
    conn = get_db_connection(); cur = dict_cursor(conn)
    if request.method == "GET":
        cur.execute("SELECT id, full_name, email, phone, role, avatar, last_login, ip FROM admin_users WHERE id=1")
        row = cur.fetchone(); cur.close(); conn.close()
        if not row:
            return jsonify({"error":"Admin not found"}), 404
        # last_login from activity_logs if null
        if not row.get("last_login"):
            conn2 = get_db_connection(); cur2 = dict_cursor(conn2)
            cur2.execute("SELECT COALESCE(timestamp, created_at) as ts, ip_address FROM activity_logs WHERE actor LIKE %s ORDER BY COALESCE(timestamp, created_at) DESC LIMIT 1", ("%Ayinde%",))
            lg = cur2.fetchone(); cur2.close(); conn2.close()
            if lg:
                row["last_login"] = str(lg.get("ts"))
                row["ip"] = lg.get("ip_address")
        return jsonify(row)

    # PUT - update profile
    d = request.json or {}
    cur.execute("UPDATE admin_users SET full_name=%s, email=%s, phone=%s, avatar=%s WHERE id=1 RETURNING id, full_name, email, phone, role, avatar",
                (d.get("fullName") or d.get("full_name"), d.get("email"), d.get("phone"), d.get("avatar")))
    row = cur.fetchone(); conn.commit(); cur.close(); conn.close()
    log_activity("Ayinde Admin", "Admin", "Settings Updated", description=f"Profile updated • {row.get('full_name')} • {row.get('email')}")
    return jsonify(row)

@admin_bp.route("/password", methods=["PUT"])
def admin_password():
    d = request.json or {}
    conn = get_db_connection(); cur = dict_cursor(conn)
    cur.execute("SELECT password FROM admin_users WHERE id=1"); row = cur.fetchone()
    if not row or row.get("password") != d.get("current_password"):
        cur.close(); conn.close()
        return jsonify({"error":"Current password incorrect"}), 400
    if len(d.get("new_password","")) < 8:
        cur.close(); conn.close()
        return jsonify({"error":"Min 8 characters"}), 400
    cur.execute("UPDATE admin_users SET password=%s WHERE id=1", (d.get("new_password"),))
    conn.commit(); cur.close(); conn.close()
    log_activity("Ayinde Admin", "Admin", "Settings Updated", description="Password changed • Session invalidated • Audit immutable")
    return jsonify({"success": True})

@admin_bp.route("/pin", methods=["PUT"])
def admin_pin():
    d = request.json or {}
    conn = get_db_connection(); cur = dict_cursor(conn)
    cur.execute("SELECT pin FROM admin_users WHERE id=1"); row = cur.fetchone()
    if not row or str(row.get("pin")) != str(d.get("current_pin")):
        cur.close(); conn.close()
        return jsonify({"error":"Current PIN incorrect"}), 400
    if not str(d.get("new_pin","")).isdigit() or len(str(d.get("new_pin"))) != 4:
        cur.close(); conn.close()
        return jsonify({"error":"PIN must be 4 digits"}), 400
    cur.execute("UPDATE admin_users SET pin=%s WHERE id=1", (str(d.get("new_pin")),))
    conn.commit(); cur.close(); conn.close()
    log_activity("Ayinde Admin", "Admin", "Settings Updated", description="PIN changed • Console security • Audit logged")
    return jsonify({"success": True})