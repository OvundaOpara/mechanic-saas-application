from flask import Blueprint, request, jsonify
from db import get_db_connection, dict_cursor

logs_bp = Blueprint("logs", __name__)

@logs_bp.route("/activity-logs", methods=["GET"])
def activity_logs():
    typ = request.args.get("type", "All")
    workshop_id = request.args.get("workshop_id", "All")
    actor = request.args.get("actor", "All")
    date_from = request.args.get("date_from", "")
    date_to = request.args.get("date_to", "")
    q = request.args.get("q", "")
    limit = int(request.args.get("limit", 200)); offset = int(request.args.get("offset", 0))
    conn = get_db_connection(); cur = dict_cursor(conn)
    # FIXED: join workshops so frontend gets real workshop_name, not Workshop #id
    sql = """SELECT al.*, w.name as workshop_name
             FROM activity_logs al
             LEFT JOIN workshops w ON w.id = al.workshop_id
             WHERE 1=1"""
    params = []
    if typ and typ != "All":
        sql += " AND al.activity_type=%s"; params.append(typ)
    if workshop_id and workshop_id not in ["All", "Platform"]:
        sql += " AND al.workshop_id=%s"; params.append(workshop_id)
    if actor and actor != "All":
        sql += " AND al.actor=%s"; params.append(actor)
    if date_from:
        sql += " AND DATE(COALESCE(al.timestamp, al.created_at)) >= %s"; params.append(date_from)
    if date_to:
        sql += " AND DATE(COALESCE(al.timestamp, al.created_at)) <= %s"; params.append(date_to)
    if q:
        sql += " AND (al.description ILIKE %s OR al.actor ILIKE %s OR al.ip_address ILIKE %s)"; params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
    sql += " ORDER BY COALESCE(al.timestamp, al.created_at) DESC LIMIT %s OFFSET %s"; params.extend([limit, offset])
    cur.execute(sql, tuple(params)); rows = cur.fetchall(); cur.close(); conn.close()
    return jsonify(rows)