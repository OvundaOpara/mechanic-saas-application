from flask import Blueprint, request, jsonify
from db import get_db_connection, dict_cursor
from datetime import datetime

reviews_bp = Blueprint("reviews", __name__)

@reviews_bp.route("/admin/reviews", methods=["GET", "POST"])
def admin_reviews():
    if request.method == "POST":
        d = request.json or {}
        conn = get_db_connection(); cur = dict_cursor(conn)
        cur.execute(
            "INSERT INTO reviews (workshop_id, owner_id, booking_id, rating, comment, created_at) VALUES (%s,%s,%s,%s,%s,%s) RETURNING *",
            (d.get("workshop_id"), d.get("owner_id"), d.get("booking_id"), int(d.get("rating", 5)), d.get("comment", ""), d.get("created_at") or datetime.now())
        )
        row = cur.fetchone(); conn.commit(); cur.close(); conn.close()
        return jsonify(row), 201

    # GET
    workshop_id = request.args.get("workshop_id", "All")
    rating = request.args.get("rating", "All")
    date_from = request.args.get("date_from", "")
    date_to = request.args.get("date_to", "")
    q = request.args.get("q", "")
    limit = int(request.args.get("limit", 200)); offset = int(request.args.get("offset", 0))
    conn = get_db_connection(); cur = dict_cursor(conn)
    sql = """SELECT r.*, w.name as workshop_name, w.owner_name as workshop_owner,
             COALESCE(vo.full_name, vo.name, 'Car Owner') as owner_name,
             COALESCE(vo.email, '') as owner_email
             FROM reviews r
             LEFT JOIN workshops w ON w.id = r.workshop_id
             LEFT JOIN vehicle_owners vo ON vo.id = r.owner_id
             WHERE 1=1"""
    params = []
    if workshop_id and workshop_id not in ["All", "Platform"]:
        sql += " AND r.workshop_id=%s"; params.append(workshop_id)
    if rating and rating != "All":
        sql += " AND r.rating=%s"; params.append(int(rating))
    if date_from:
        sql += " AND DATE(r.created_at) >= %s"; params.append(date_from)
    if date_to:
        sql += " AND DATE(r.created_at) <= %s"; params.append(date_to)
    if q:
        sql += " AND (r.comment ILIKE %s OR w.name ILIKE %s)"; params.extend([f"%{q}%", f"%{q}%"])
    sql += " ORDER BY r.created_at DESC LIMIT %s OFFSET %s"; params.extend([limit, offset])
    cur.execute(sql, tuple(params)); rows = cur.fetchall(); cur.close(); conn.close()
    return jsonify(rows)

# Alias for workshop / owner side - same data, no reply endpoint (read-only)
@reviews_bp.route("/reviews", methods=["GET"])
def public_reviews():
    return admin_reviews()


@reviews_bp.route("/workshops/<int:workshop_id>/reviews", methods=["GET"])
def get_workshop_reviews(workshop_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("CREATE TABLE IF NOT EXISTS reviews (id SERIAL PRIMARY KEY, workshop_id INT, owner_id INT, booking_id INT, rating INT, comment TEXT, created_at TIMESTAMP DEFAULT NOW())")
        for col_sql in [
            "ADD COLUMN IF NOT EXISTS booking_id INT",
            "ADD COLUMN IF NOT EXISTS owner_id INT",
            "ADD COLUMN IF NOT EXISTS rating INT DEFAULT 5",
            "ADD COLUMN IF NOT EXISTS comment TEXT",
            "ADD COLUMN IF NOT EXISTS tags TEXT",
            "ADD COLUMN IF NOT EXISTS helpful INT DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS recommend BOOLEAN DEFAULT TRUE",
            "ADD COLUMN IF NOT EXISTS service TEXT",
            "ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
        ]:
            try: cur.execute(f"ALTER TABLE reviews {col_sql}")
            except: conn.rollback()
        conn.commit()
        # Join owners + bookings for display fields - use LEFT JOIN so review shows even if booking deleted
        cur.execute("""
            SELECT r.*,
              COALESCE(o.full_name, o.name, r.owner_name, r.customer_name, 'Customer') AS owner_name,
              o.email AS owner_email, o.avatar AS owner_avatar, o.phone AS owner_phone,
              b.service_type AS booking_service, b.car AS booking_car, b.car_make, b.car_model, b.car_year,
              b.booking_date, b.status AS booking_status
            FROM reviews r
            LEFT JOIN owners o ON o.id = r.owner_id
            LEFT JOIN bookings b ON b.id = r.booking_id
            WHERE r.workshop_id=%s
            ORDER BY r.created_at DESC, r.id DESC LIMIT 500
        """, (workshop_id,))
        rows = cur.fetchall()
        cur.close(); conn.close()
        for r in rows:
            if r.get("created_at"): r["created_at"] = str(r["created_at"])
            if r.get("booking_date"): r["booking_date"] = str(r["booking_date"])
            # tags may be stored as JSON string, comma string, or null
            tags = r.get("tags")
            if isinstance(tags, str):
                try:
                    import json
                    parsed = json.loads(tags)
                    r["tags"] = parsed if isinstance(parsed, list) else [tags]
                except: r["tags"] = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
            elif tags is None: r["tags"] = []
        return jsonify(rows)
    except Exception as e:
        print("GET workshop reviews error:", e)
        return jsonify({"error": str(e)}), 500

@reviews_bp.route("/reviews", methods=["GET"])
def get_reviews_fallback():
    # fallback for /api/reviews?workshop_id=...
    wid = request.args.get("workshop_id")
    if not wid: return jsonify({"error": "workshop_id missing"}), 400
    return get_workshop_reviews(int(wid))