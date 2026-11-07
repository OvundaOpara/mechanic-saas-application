from flask import Blueprint, request, jsonify
from db import get_db_connection, dict_cursor
from datetime import datetime, date, time
from decimal import Decimal
import re
import traceback

bookings_bp = Blueprint("bookings", __name__)  # <-- only ONE file in routes/ may have this

# log_activity is optional - don't crash booking if logs.py changes
try:
    from logs import log_activity
except Exception:
    def log_activity(*args, **kwargs):
        pass

# ---------- HELPERS ----------
def _clean(row):
    if not row:
        return row
    d = dict(row)
    for k, v in list(d.items()):
        if isinstance(v, (datetime, date, time)):
            d[k] = v.isoformat()
        elif isinstance(v, Decimal):
            d[k] = float(v)
    return d

def _clean_list(rows):
    return [_clean(r) for r in (rows or [])]

def _to_24h(t):
    """'10:00 AM' / '10:00 AM PST' / '10:00' -> '10:00:00' for TIME columns."""
    if not t:
        return "09:00:00"
    s = str(t).strip().replace("PST", "").replace("PDT", "").strip()
    m = re.match(r"(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?", s, re.I)
    if not m:
        return "09:00:00"
    h, mi, sec, ap = int(m.group(1)), m.group(2), m.group(3) or "00", (m.group(4) or "").upper()
    if ap == "PM" and h != 12:
        h += 12
    if ap == "AM" and h == 12:
        h = 0
    return f"{h:02d}:{mi}:{sec}"

def _to_int(v, default=200):
    try:
        return int(v)
    except Exception:
        return default

# ---------- BOOKINGS ----------
@bookings_bp.route("", methods=["GET", "POST"])
def bookings_route():
    if request.method == "POST":
        return _create_booking()
    return _list_bookings()

def _create_booking():
    try:
        d = request.json or {}
        owner_id = d.get("owner_id")
        workshop_id = d.get("workshop_id")
        if not owner_id or not workshop_id:
            return jsonify({"error": "owner_id and workshop_id are required"}), 400

        car_id = d.get("car_id")
        if car_id in ("", 0, "0", None):
            car_id = None
        try:
            amount = float(d.get("amount") or 0)
        except Exception:
            amount = 0

        conn = get_db_connection(); cur = dict_cursor(conn)
        cur.execute(
            """INSERT INTO bookings (owner_id, workshop_id, car_id, service_type, description, booking_date, booking_time, amount, status)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'Pending') RETURNING *""",
            (owner_id, workshop_id, car_id,
             d.get("service_type") or d.get("service") or "General Service",
             d.get("description") or d.get("note") or "",
             d.get("booking_date") or d.get("date"),
             _to_24h(d.get("booking_time") or d.get("time") or "09:00 AM"),
             amount)
        )
        b = _clean(cur.fetchone())

        # Job row - don't let a jobs-table issue kill the booking
        job = None
        try:
            cur.execute("SAVEPOINT job_sp")
            cur.execute(
                "INSERT INTO jobs (booking_id, workshop_id, owner_id, status, progress) VALUES (%s,%s,%s,'Diagnostics',0) RETURNING *",
                (b["id"], workshop_id, owner_id))
            job = _clean(cur.fetchone())
        except Exception as e:
            print("jobs insert skipped:", e)
            try:
                cur.execute("ROLLBACK TO SAVEPOINT job_sp")
            except Exception:
                pass

        conn.commit()
        try:
            log_activity("System", "System", "Booking Created",
                         workshop_id=workshop_id, owner_id=owner_id,
                         description=f"Booking {b['id']} - {d.get('service_type')}")
        except Exception:
            pass
        cur.close(); conn.close()
        return jsonify({"booking": b, "job": job}), 201
    except Exception as e:
        print("POST /bookings error:", e); traceback.print_exc()
        return jsonify({"error": str(e)}), 500

def _list_bookings():
    try:
        workshop_id = request.args.get("workshop_id")
        owner_id = request.args.get("owner_id")
        status = request.args.get("status")
        date_from = request.args.get("date_from")
        date_to = request.args.get("date_to")
        q = request.args.get("q", "")
        limit = _to_int(request.args.get("limit", 200), 200)
        offset = _to_int(request.args.get("offset", 0), 0)
        conn = get_db_connection(); cur = dict_cursor(conn)

        # Full join (with workshop_phone/rating). Fallback to original query if a column is missing.
        sql_full = """SELECT b.*, vo.full_name as owner_name, vo.phone as phone, vo.avatar_url as owner_avatar,
                 w.name as workshop_name, w.logo_url as workshop_logo, w.address as workshop_address,
                 w.phone as workshop_phone, w.rating as workshop_rating,
                 c.make as car_make, c.model as car_model, c.year as car_year,
                 c.license_plate as plate, c.vin as vin
                 FROM bookings b
                 LEFT JOIN vehicle_owners vo ON vo.id=b.owner_id
                 LEFT JOIN workshops w ON w.id=b.workshop_id
                 LEFT JOIN cars c ON c.id=b.car_id WHERE 1=1"""
        sql_base = """SELECT b.*, vo.full_name as owner_name, vo.phone as phone, vo.avatar_url as owner_avatar,
                 w.name as workshop_name, w.logo_url as workshop_logo, w.address as workshop_address,
                 c.make as car_make, c.model as car_model, c.year as car_year,
                 c.license_plate as plate, c.vin as vin
                 FROM bookings b
                 LEFT JOIN vehicle_owners vo ON vo.id=b.owner_id
                 LEFT JOIN workshops w ON w.id=b.workshop_id
                 LEFT JOIN cars c ON c.id=b.car_id WHERE 1=1"""

        def _build(base_sql):
            sql, params = base_sql, []
            if workshop_id and workshop_id != "All":
                sql += " AND b.workshop_id=%s"; params.append(workshop_id)
            if owner_id:
                sql += " AND b.owner_id=%s"; params.append(owner_id)
            if status and status != "All":
                sql += " AND b.status=%s"; params.append(status)
            if date_from:
                sql += " AND b.booking_date>=%s"; params.append(date_from)
            if date_to:
                sql += " AND b.booking_date<=%s"; params.append(date_to)
            if q:
                sql += " AND (b.service_type ILIKE %s OR b.description ILIKE %s OR vo.full_name ILIKE %s OR w.name ILIKE %s)"
                params.extend([f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%"])
            sql += " ORDER BY b.booking_date DESC, b.id DESC LIMIT %s OFFSET %s"
            params.extend([limit, offset])
            return sql, tuple(params)

        try:
            sql, params = _build(sql_full)
            cur.execute(sql, params)
        except Exception:
            conn.rollback()
            sql, params = _build(sql_base)
            cur.execute(sql, params)

        rows = _clean_list(cur.fetchall())
        cur.close(); conn.close()
        return jsonify(rows)
    except Exception as e:
        print("GET /bookings error:", e); traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ---------- SINGLE BOOKING: GET (detail/track) + PUT (reschedule) ----------
@bookings_bp.route("/<int:bid>", methods=["GET", "PUT"])
def booking_detail(bid):
    try:
        conn = get_db_connection(); cur = dict_cursor(conn)
        if request.method == "GET":
            cur.execute(
                """SELECT b.*, vo.full_name as owner_name, vo.phone as phone,
                   w.name as workshop_name, w.logo_url as workshop_logo, w.address as workshop_address, w.phone as workshop_phone,
                   c.make as car_make, c.model as car_model, c.year as car_year, c.license_plate as plate
                   FROM bookings b
                   LEFT JOIN vehicle_owners vo ON vo.id=b.owner_id
                   LEFT JOIN workshops w ON w.id=b.workshop_id
                   LEFT JOIN cars c ON c.id=b.car_id WHERE b.id=%s""", (bid,))
            row = cur.fetchone()
            cur.close(); conn.close()
            if not row:
                return jsonify({"error": "Booking not found"}), 404
            return jsonify(_clean(row))

        # PUT - reschedule / edit
        d = request.json or {}
        sets, params = [], []
        if d.get("booking_date") or d.get("date"):
            sets.append("booking_date=%s"); params.append(d.get("booking_date") or d.get("date"))
        if d.get("booking_time") or d.get("time"):
            sets.append("booking_time=%s"); params.append(_to_24h(d.get("booking_time") or d.get("time")))
        if d.get("service_type") or d.get("service"):
            sets.append("service_type=%s"); params.append(d.get("service_type") or d.get("service"))
        if d.get("description") is not None or d.get("note") is not None:
            sets.append("description=%s"); params.append(d.get("description") if d.get("description") is not None else d.get("note"))
        if d.get("status"):
            sets.append("status=%s"); params.append(d.get("status"))
        if d.get("amount") is not None:
            try:
                sets.append("amount=%s"); params.append(float(d.get("amount")))
            except Exception:
                pass
        if not sets:
            cur.close(); conn.close()
            return jsonify({"error": "Nothing to update"}), 400
        params.append(bid)
        cur.execute(f"UPDATE bookings SET {', '.join(sets)} WHERE id=%s RETURNING *", tuple(params))
        row = cur.fetchone(); conn.commit(); cur.close(); conn.close()
        if not row:
            return jsonify({"error": "Booking not found"}), 404
        return jsonify(_clean(row))
    except Exception as e:
        print(f"GET/PUT /bookings/{bid} error:", e); traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ---------- BOOKING STATUS (for AdminBookings + Owner cancel) ----------
@bookings_bp.route("/<int:bid>/status", methods=["PUT"])
def update_booking_status(bid):
    try:
        d = request.json or {}
        status = d.get("status")
        if not status:
            return jsonify({"error": "status is required"}), 400
        conn = get_db_connection(); cur = dict_cursor(conn)
        cur.execute("UPDATE bookings SET status=%s WHERE id=%s RETURNING *", (status, bid))
        row = cur.fetchone(); conn.commit(); cur.close(); conn.close()
        if not row:
            return jsonify({"error": "Booking not found"}), 404
        return jsonify(_clean(row))
    except Exception as e:
        print("PUT /bookings status error:", e); traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ---------- JOBS ----------
@bookings_bp.route("/jobs", methods=["GET", "PUT"])
def jobs_route():
    try:
        conn = get_db_connection(); cur = dict_cursor(conn)
        if request.method == "GET":
            workshop_id = request.args.get("workshop_id")
            owner_id = request.args.get("owner_id")
            booking_id = request.args.get("booking_id")
            status = request.args.get("status")
            limit = _to_int(request.args.get("limit", 200), 200)
            offset = _to_int(request.args.get("offset", 0), 0)
            sql = """SELECT j.*, b.service_type, b.booking_date, b.booking_time, b.amount,
             vo.full_name as owner_name, vo.avatar_url as owner_avatar,
             w.name as workshop_name, w.logo_url as workshop_logo,
             c.make as car_make, c.model as car_model, c.year as car_year, c.license_plate as plate
             FROM jobs j
             LEFT JOIN bookings b ON b.id=j.booking_id
             LEFT JOIN vehicle_owners vo ON vo.id=j.owner_id
             LEFT JOIN workshops w ON w.id=j.workshop_id
             LEFT JOIN cars c ON c.id=b.car_id WHERE 1=1"""
            params = []
            if workshop_id and workshop_id != "All":
                sql += " AND j.workshop_id=%s"; params.append(workshop_id)
            if owner_id:
                sql += " AND j.owner_id=%s"; params.append(owner_id)
            if booking_id:
                sql += " AND j.booking_id=%s"; params.append(booking_id)
            if status and status != "All":
                sql += " AND j.status=%s"; params.append(status)
            sql += " ORDER BY j.updated_at DESC NULLS LAST, j.id DESC LIMIT %s OFFSET %s"
            params.extend([limit, offset])
            cur.execute(sql, tuple(params)); rows = _clean_list(cur.fetchall())
            cur.close(); conn.close()
            return jsonify(rows)
        else:
            d = request.json or {}
            if not d.get("id"):
                cur.close(); conn.close()
                return jsonify({"error": "id is required"}), 400
            cur.execute(
                "UPDATE jobs SET status=%s, progress=%s, remarks=%s, updated_at=NOW() WHERE id=%s RETURNING *",
                (d.get("status"), d.get("progress", 50), d.get("remarks"), d.get("id")))
            row = cur.fetchone(); conn.commit(); cur.close(); conn.close()
            if not row:
                return jsonify({"error": "Job not found"}), 404
            return jsonify(_clean(row))
    except Exception as e:
        print("jobs_route error:", e); traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ---------- CARS ----------
@bookings_bp.route("/cars", methods=["GET", "POST"])
def cars_route():
    try:
        if request.method == "POST":
            d = request.json or {}
            conn = get_db_connection(); cur = dict_cursor(conn)
            cur.execute(
                "INSERT INTO cars (owner_id, make, model, year, vin, license_plate, color, mileage, image_url) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *",
                (d.get("owner_id"), d.get("make"), d.get("model"), d.get("year"), d.get("vin"),
                 d.get("license_plate"), d.get("color"), d.get("mileage"), d.get("image_url")))
            row = _clean(cur.fetchone()); conn.commit(); cur.close(); conn.close()
            return jsonify(row), 201
        else:
            owner_id = request.args.get("owner_id")
            conn = get_db_connection(); cur = dict_cursor(conn)
            if not owner_id:
                cur.close(); conn.close(); return jsonify([])
            cur.execute("SELECT * FROM cars WHERE owner_id=%s ORDER BY created_at DESC", (owner_id,))
            rows = _clean_list(cur.fetchall()); cur.close(); conn.close()
            return jsonify(rows)
    except Exception as e:
        print("cars_route error:", e); traceback.print_exc()
        return jsonify({"error": str(e)}), 500