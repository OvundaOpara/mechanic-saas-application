from flask import Blueprint, request, jsonify
from db import get_db_connection, dict_cursor
from psycopg2.extras import RealDictCursor
from decimal import Decimal
from datetime import datetime, date, time

owners_bp = Blueprint("owners", __name__)

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

@owners_bp.route("", methods=["GET"])
def list_owners():
    try:
        conn = get_db_connection(); cur = dict_cursor(conn)
        try:
            cur.execute("""
                SELECT id, full_name as name, email, phone, address,
                       COALESCE(status,'Active') as status,
                       COALESCE(avatar_url,'') as avatar,
                       COALESCE(dob,'') as dob, COALESCE(gender,'') as gender,
                       COALESCE(license_number,'') as license,
                       COALESCE(insurance_provider,'') as insurance,
                       COALESCE(rating,0) as rating,
                       COALESCE(total_bookings,0) as bookings,
                       COALESCE(total_spent,0) as spent,
                       created_at, last_active
                FROM vehicle_owners ORDER BY created_at DESC
            """)
            rows = cur.fetchall()
        except Exception:
            # Fallback if some columns above don't exist in your schema
            conn.rollback()
            cur.execute("SELECT * FROM vehicle_owners ORDER BY id DESC")
            rows = cur.fetchall()
        out = _clean_list(rows)
        cur.close(); conn.close()
        return jsonify(out)
    except Exception as e:
        print("list_owners error:", e)
        return jsonify({"error": str(e)}), 500

@owners_bp.route("/<int:oid>/vehicles", methods=["GET"])
def owner_vehicles(oid):
    try:
        conn = get_db_connection(); cur = dict_cursor(conn)
        cur.execute("SELECT * FROM cars WHERE owner_id=%s ORDER BY created_at DESC", (oid,))
        rows = cur.fetchall(); cur.close(); conn.close()
        return jsonify(_clean_list(rows))
    except Exception as e:
        print("owner_vehicles error:", e)
        return jsonify([]), 200

@owners_bp.route("/<int:oid>/status", methods=["PUT"])
def toggle_owner(oid):
    try:
        d = request.get_json(silent=True) or {}
        conn = get_db_connection(); cur = dict_cursor(conn)
        cur.execute("UPDATE vehicle_owners SET status=%s WHERE id=%s RETURNING *", (d.get("status"), oid))
        row = cur.fetchone(); conn.commit()
        out = _clean(row) if row else None
        cur.close(); conn.close()
        if not out:
            return jsonify({"error": "Owner not found"}), 404
        return jsonify(out)
    except Exception as e:
        print("toggle_owner error:", e)
        return jsonify({"error": str(e)}), 500

@owners_bp.route("/<int:owner_id>/dashboard", methods=["GET"])
def get_owner_dashboard(owner_id):
    try:
        conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
        # FIXED: table is vehicle_owners, not owners
        cur.execute("SELECT * FROM vehicle_owners WHERE id=%s", (owner_id,))
        o = cur.fetchone()
        if not o:
            cur.close(); conn.close()
            return jsonify({"error": "Owner not found"}), 404
        owner = _clean(o)
        # Normalize for frontend: frontend reads owner.full_name / owner.name / owner.avatar
        owner["full_name"] = owner.get("full_name") or owner.get("name") or ""
        owner["name"] = owner.get("name") or owner.get("full_name") or ""
        owner["avatar"] = owner.get("avatar") or owner.get("avatar_url") or owner.get("profile_image") or owner.get("logo") or ""
        owner["avatar_url"] = owner["avatar"]
        # Bookings
        try:
            cur.execute("SELECT * FROM bookings WHERE owner_id=%s ORDER BY id DESC LIMIT 200", (owner_id,))
            bookings = [dict(r) for r in cur.fetchall()]
        except Exception:
            conn.rollback(); bookings = []
        # Reviews / Remarks
        try:
            cur.execute("SELECT * FROM reviews WHERE owner_id=%s ORDER BY id DESC", (owner_id,))
            reviews = [dict(r) for r in cur.fetchall()]
        except Exception:
            conn.rollback(); reviews = []
        # Favorites
        try:
            cur.execute("SELECT * FROM favorites WHERE owner_id=%s", (owner_id,))
            favorites = cur.fetchall()
            fav_count = len(favorites)
        except Exception:
            conn.rollback(); fav_count = 0
        # Stats
        def amt(b):
            try: return float(b.get("amount") or b.get("total") or b.get("price") or 0)
            except: return 0
        active = [b for b in bookings if str(b.get("status","")).lower() in ("pending","confirmed","in_progress","in-progress","diagnosing","repairing","in progress","active","accepted","scheduled")]
        live = [b for b in bookings if str(b.get("status","")).lower() in ("in_progress","in-progress","diagnosing","repairing","in progress")]
        paid = [b for b in bookings if str(b.get("status","")).lower() in ("completed","paid","delivered","done")]
        total_spent = sum(amt(b) for b in paid)
        rating_avg = round(sum(float(r.get("rating") or 0) for r in reviews)/len(reviews), 1) if reviews else 0
        # Serialize bookings/reviews dates
        for lst in (bookings, reviews):
            for r in lst:
                for k, v in list(r.items()):
                    if isinstance(v, (datetime, date)): r[k] = v.isoformat()[:10]
                    elif isinstance(v, Decimal): r[k] = float(v)
        active_booking = None
        if active:
            b = active[0]
            active_booking = {
                "id": b.get("id"),
                "car": b.get("car_name") or b.get("vehicle") or b.get("car") or f"Booking #{b.get('id')}",
                "service_type": b.get("service_type") or b.get("service") or "",
                "workshop_name": b.get("workshop_name") or b.get("workshop") or "Workshop",
                "status": b.get("status") or "",
                "booking_date": b.get("booking_date") or b.get("date") or "",
            }
        latest = None
        if reviews:
            r = reviews[0]
            latest = {
                "workshop_name": r.get("workshop_name") or r.get("workshop") or "Workshop",
                "service_type": r.get("service_type") or r.get("service") or "",
                "rating": float(r.get("rating") or 0),
                "comment": r.get("comment") or r.get("review") or r.get("remarks") or "",
                "booking_id": r.get("booking_id") or r.get("bookingId") or "",
            }
        cur.close(); conn.close()
        return jsonify({
            "owner": owner,
            "stats": {
                "activeBookings": len(active),
                "appointmentsCount": len([b for b in bookings if str(b.get("status","")).lower() in ("pending","confirmed","scheduled","accepted")]),
                "liveCount": len(live),
                "remarksCount": len(reviews),
                "ratingAvg": rating_avg,
                "totalSpent": round(total_spent, 2),
                "totalJobs": len(bookings),
                "favoritesCount": fav_count,
                "positiveRemarks": len([r for r in reviews if float(r.get("rating") or 0) >= 4]),
            },
            "activeBooking": active_booking,
            "latestRemark": latest,
            "recentBookings": bookings[:5],
        })
    except Exception as e:
        print("GET owner dashboard error:", e)
        return jsonify({"error": str(e)}), 500



@owners_bp.route("/<int:oid>/vehicles", methods=["POST"])
def add_owner_vehicle(oid):
    try:
        d = request.get_json(silent=True) or {}
        conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
        # Ensure columns exist - safe if they already do
        for col, typ in [
            ("make","TEXT"), ("model","TEXT"), ("year","INT"), ("plate","TEXT"),
            ("vin","TEXT"), ("mileage","INT"), ("color","TEXT"), ("fuel","TEXT"),
            ("image","TEXT"), ("status","TEXT"), ("next_service","TEXT"),
        ]:
            try:
                cur.execute(f"ALTER TABLE cars ADD COLUMN IF NOT EXISTS {col} {typ}")
                conn.commit()
            except Exception:
                conn.rollback()
        cur.execute("""
            INSERT INTO cars (owner_id, make, model, year, plate, vin, mileage, color, fuel, image, status, next_service)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
        """, (
            oid,
            d.get("make") or d.get("brand") or "",
            d.get("model") or "",
            int(d.get("year") or 0) or None,
            d.get("plate") or d.get("license_plate") or "",
            d.get("vin") or "",
            int(d.get("mileage") or 0),
            d.get("color") or "",
            d.get("fuel") or d.get("fuel_type") or "Gasoline",
            d.get("image") or d.get("image_url") or "",
            d.get("status") or "healthy",
            d.get("next") or d.get("next_service") or "General Check",
        ))
        row = cur.fetchone(); conn.commit()
        out = _clean(row) if row else {}
        cur.close(); conn.close()
        return jsonify(out), 201
    except Exception as e:
        print("add_owner_vehicle error:", e)
        return jsonify({"error": str(e)}), 500

@owners_bp.route("/<int:oid>/vehicles/<int:car_id>", methods=["PUT"])
def update_owner_vehicle(oid, car_id):
    try:
        d = request.get_json(silent=True) or {}
        conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            UPDATE cars SET make=%s, model=%s, year=%s, plate=%s, vin=%s, mileage=%s, color=%s, fuel=%s, image=%s, status=%s
            WHERE id=%s AND owner_id=%s RETURNING *
        """, (
            d.get("make"), d.get("model"),
            int(d.get("year") or 0) or None,
            d.get("plate"), d.get("vin"),
            int(d.get("mileage") or 0),
            d.get("color"), d.get("fuel") or "Gasoline",
            d.get("image") or "", d.get("status") or "healthy",
            car_id, oid
        ))
        row = cur.fetchone(); conn.commit()
        out = _clean(row) if row else None
        cur.close(); conn.close()
        if not out:
            return jsonify({"error": "Car not found"}), 404
        return jsonify(out)
    except Exception as e:
        print("update_owner_vehicle error:", e)
        return jsonify({"error": str(e)}), 500

@owners_bp.route("/<int:oid>/vehicles/<int:car_id>", methods=["DELETE"])
def delete_owner_vehicle(oid, car_id):
    try:
        conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("DELETE FROM cars WHERE id=%s AND owner_id=%s RETURNING id", (car_id, oid))
        row = cur.fetchone(); conn.commit(); cur.close(); conn.close()
        if not row:
            return jsonify({"error": "Car not found"}), 404
        return jsonify({"success": True})
    except Exception as e:
        print("delete_owner_vehicle error:", e)
        return jsonify({"error": str(e)}), 500