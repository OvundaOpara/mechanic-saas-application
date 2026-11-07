from flask import Blueprint, request, jsonify
from db import get_db_connection, dict_cursor, log_activity
from psycopg2.extras import RealDictCursor
from datetime import datetime, date, timedelta
from decimal import Decimal
import uuid
import json

workshops_bp = Blueprint("workshops", __name__)

def _clean(row):
    if not row:
        return row
    out = {}
    for k, v in row.items():
        if isinstance(v, Decimal):
            out[k] = float(v)
        elif hasattr(v, "isoformat"):
            # date / datetime -> YYYY-MM-DD
            try:
                out[k] = v.isoformat()[:10] if "date" in str(type(v)).lower() else str(v)
            except:
                out[k] = str(v)
        else:
            out[k] = v
    return out

def _parse_hire_date(v):
    if not v:
        return None
    if isinstance(v, date) and not isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, datetime):
        return v.date().isoformat()
    s = str(v).strip()
    if not s:
        return None
    # Already YYYY-MM-DD
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    # Try all JS / common formats
    for fmt in (
        "%a, %d %b %Y %H:%M:%S %Z",  # Fri, 06 Nov 2026 00:00:00 GMT <- your error
        "%a, %d %b %Y",
        "%a %b %d %Y",
        "%a %b %d %H:%M:%S %Y",      # Fri Nov 06 2026 ...
        "%a %b %d %H:%M:%S %Z %Y",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
        "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y",
    ):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except Exception:
            continue
    # Last resort: first 16 chars of "Fri, 06 Nov 2026..."
    try:
        return datetime.strptime(s[:16], "%a, %d %b %Y").date().isoformat()
    except Exception:
        return None


def _create_trial(cur, conn, workshop_id, email):
    """Create 7-day trial + receipt. Only called when workshop has NO subscription at all. Never raises."""
    try:
        start = date.today()
        end = start + timedelta(days=7)  # 7 days, not 14
        sub = None
        try:
            cur.execute(
                """INSERT INTO subscriptions (workshop_id, plan, status, start_date, end_date, amount, auto_renew, billing_email, payment_method, created_at)
                   VALUES (%s,'Trial','trial',%s,%s,0,FALSE,%s,'Free Trial',NOW()) RETURNING *""",
                (workshop_id, start, end, email or "")
            )
            sub = cur.fetchone()
        except Exception as e:
            print("Trial full insert failed, retry minimal:", e)
            try:
                conn.rollback()
            except:
                pass
            cur.execute(
                """INSERT INTO subscriptions (workshop_id, plan, status, start_date, end_date, amount, auto_renew, created_at)
                   VALUES (%s,'Trial','trial',%s,%s,0,FALSE,NOW()) RETURNING *""",
                (workshop_id, start, end)
            )
            sub = cur.fetchone()
        conn.commit()
        # Receipt - separate transaction, non-fatal
        try:
            cur.execute(
                """INSERT INTO subscription_receipts (subscription_id, workshop_id, receipt_number, transaction_id, plan, amount, payment_method, status, period, receipt_date, next_billing_date)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (sub["id"], workshop_id, f"RCPT-{sub['id']}-TRIAL", f"TX-{uuid.uuid4().hex[:8].upper()}", "1 Week Free Trial", 0, "Free Trial", "Paid", f"{start} to {end}", start, end)
            )
            conn.commit()
        except Exception as re:
            print("Trial receipt failed (non-fatal):", re)
            try:
                conn.rollback()
            except:
                pass
        print(f"TRIAL CREATED (dashboard backfill): workshop_id={workshop_id} {start} -> {end}")
        return _clean(sub)
    except Exception as e:
        try:
            conn.rollback()
        except:
            pass
        print("TRIAL CREATE FAILED (dashboard):", e)
        return None

def _get_subscription(cur, conn, workshop_id, email):
    """Fetch latest subscription, backfill 7-day trial if none exists."""
    try:
        cur.execute("SELECT * FROM subscriptions WHERE workshop_id=%s ORDER BY id DESC LIMIT 1", (workshop_id,))
        sub = cur.fetchone()
        if sub:
            return _clean(sub)
    except Exception as e:
        print("fetch subscription failed:", e)
        try:
            conn.rollback()
        except:
            pass
    # No subscription at all -> create 7-day trial now
    print(f"BACKFILL: workshop {workshop_id} has no subscription - creating 7-day trial in dashboard")
    return _create_trial(cur, conn, workshop_id, email)

# ---------------- LIST (Admin) ----------------
@workshops_bp.route("/", methods=["GET"])
def list_workshops():
    conn = get_db_connection(); cur = dict_cursor(conn)
    try:
        q = (request.args.get("q") or "").strip().lower()
        status = (request.args.get("status") or "").strip().lower()
        cur.execute("SELECT id, business_name, name, email, phone, address, verified, status, created_at FROM workshops ORDER BY id DESC")
        rows = cur.fetchall()
        out = []
        for w in rows:
            w = _clean(w)
            if q and q not in f"{w.get('business_name','')} {w.get('name','')} {w.get('email','')}".lower():
                continue
            if status and status != "all" and str(w.get("status") or "").lower() != status:
                continue
            # Attach latest subscription for Admin list (days left, plan)
            try:
                cur.execute("SELECT * FROM subscriptions WHERE workshop_id=%s ORDER BY id DESC LIMIT 1", (w["id"],))
                sub = cur.fetchone()
                w["subscription"] = _clean(sub) if sub else None
            except:
                conn.rollback()
                w["subscription"] = None
            out.append(w)
        return jsonify({"success": True, "workshops": out}), 200
    finally:
        cur.close(); conn.close()

@workshops_bp.route("/<int:workshop_id>", methods=["GET"])
def get_workshop(workshop_id):
    conn = get_db_connection(); cur = dict_cursor(conn)
    try:
        cur.execute("SELECT id, business_name, name, email, phone, address, verified, status, created_at FROM workshops WHERE id=%s", (workshop_id,))
        w = cur.fetchone()
        if not w:
            return jsonify({"success": False, "error": "Workshop not found"}), 404
        return jsonify({"success": True, "workshop": _clean(w)}), 200
    finally:
        cur.close(); conn.close()

@workshops_bp.route("/<int:workshop_id>/dashboard", methods=["GET"])
def workshop_dashboard(workshop_id):
    conn = get_db_connection(); cur = dict_cursor(conn)
    try:
        cur.execute("SELECT id, business_name, name, email, phone, address, verified, status, created_at FROM workshops WHERE id=%s", (workshop_id,))
        w = cur.fetchone()
        if not w:
            return jsonify({"success": False, "error": "Workshop not found"}), 404
        w = _clean(w)

        # Subscription - backfills 7-day trial if missing, so dashboard never returns null for a valid workshop
        sub = _get_subscription(cur, conn, workshop_id, w.get("email"))

        stats = {"totalBookings": 0, "newBookings": 0, "activeJobs": 0, "revenueMonth": 0, "expensesMonth": 0, "profitMonth": 0, "avgRating": 0, "reviewCount": 0, "teamTotal": 0}
        def safe(q, args=()):
            try:
                cur.execute(q, args)
                return cur.fetchone()
            except:
                conn.rollback()
                return None

        r = safe("SELECT COUNT(*) as c FROM bookings WHERE workshop_id=%s", (workshop_id,))
        stats["totalBookings"] = (r or {}).get("c", 0) or 0
        r = safe("SELECT COUNT(*) as c FROM bookings WHERE workshop_id=%s AND LOWER(status) IN ('pending','new','requested')", (workshop_id,))
        stats["newBookings"] = (r or {}).get("c", 0) or 0
        # Jobs: try jobs table first, fallback to bookings with job-like statuses
        r = safe("SELECT COUNT(*) as c FROM jobs WHERE workshop_id=%s AND LOWER(status) IN ('in_progress','accepted','in-progress','ongoing','diagnosing','diagnostics')", (workshop_id,))
        if r is None:
            r = safe("SELECT COUNT(*) as c FROM bookings WHERE workshop_id=%s AND LOWER(status) IN ('in_progress','accepted','in-progress','ongoing','diagnosing','diagnostics','confirmed')", (workshop_id,))
        stats["activeJobs"] = (r or {}).get("c", 0) or 0
        r = safe("SELECT COALESCE(SUM(amount),0) as s FROM workshop_expenditures WHERE workshop_id=%s AND DATE_TRUNC('month', created_at)=DATE_TRUNC('month', NOW()) AND LOWER(COALESCE(type,''))='income'", (workshop_id,))
        if r is None:
            r = safe("SELECT COALESCE(SUM(amount),0) as s FROM incomes WHERE workshop_id=%s AND DATE_TRUNC('month', created_at)=DATE_TRUNC('month', NOW())", (workshop_id,))
        stats["revenueMonth"] = float((r or {}).get("s", 0) or 0)
        r = safe("SELECT COALESCE(SUM(amount),0) as s FROM workshop_expenditures WHERE workshop_id=%s AND DATE_TRUNC('month', created_at)=DATE_TRUNC('month', NOW()) AND LOWER(COALESCE(type,'')) IN ('expense','')", (workshop_id,))
        if r is None:
            r = safe("SELECT COALESCE(SUM(amount),0) as s FROM expenditures WHERE workshop_id=%s AND DATE_TRUNC('month', created_at)=DATE_TRUNC('month', NOW())", (workshop_id,))
        stats["expensesMonth"] = float((r or {}).get("s", 0) or 0)
        stats["profitMonth"] = stats["revenueMonth"] - stats["expensesMonth"]
        r = safe("SELECT COALESCE(AVG(rating),0) as avg, COUNT(*) as c FROM reviews WHERE workshop_id=%s", (workshop_id,))
        stats["avgRating"] = round(float((r or {}).get("avg", 0) or 0), 1)
        stats["reviewCount"] = (r or {}).get("c", 0) or 0
        r = safe("SELECT COUNT(*) as c FROM team_members WHERE workshop_id=%s", (workshop_id,))
        stats["teamTotal"] = (r or {}).get("c", 0) or 0

        return jsonify({"success": True, "workshop": w, "subscription": sub, "stats": stats}), 200
    finally:
        cur.close(); conn.close()

# ---------------- ADMIN ACTIONS ----------------
@workshops_bp.route("/<int:workshop_id>/status", methods=["PUT"])
def update_workshop_status(workshop_id):
    d = request.json or {}
    status = (d.get("status") or "").strip().lower()
    if status not in ("active", "suspended", "deactivated", "blocked"):
        return jsonify({"success": False, "error": "Invalid status"}), 400
    conn = get_db_connection(); cur = dict_cursor(conn)
    try:
        cur.execute("UPDATE workshops SET status=%s WHERE id=%s RETURNING id, business_name, name, status", (status, workshop_id))
        w = cur.fetchone()
        if not w:
            return jsonify({"success": False, "error": "Workshop not found"}), 404
        conn.commit()
        try:
            log_activity("Admin", "Workshop", "Status Change", workshop_id=workshop_id, description=f"Workshop {w.get('business_name')} status -> {status}")
        except:
            pass
        return jsonify({"success": True, "workshop": _clean(w)}), 200
    finally:
        cur.close(); conn.close()

@workshops_bp.route("/<int:workshop_id>/verify", methods=["PUT"])
def verify_workshop(workshop_id):
    d = request.json or {}
    verified = d.get("verified", True)
    if isinstance(verified, str):
        verified = verified.lower() in ("true", "1", "yes", "verified")
    conn = get_db_connection(); cur = dict_cursor(conn)
    try:
        cur.execute("UPDATE workshops SET verified=%s WHERE id=%s RETURNING id, business_name, name, verified", (bool(verified), workshop_id))
        w = cur.fetchone()
        if not w:
            return jsonify({"success": False, "error": "Workshop not found"}), 404
        conn.commit()
        try:
            log_activity("Admin", "Workshop", "Verify", workshop_id=workshop_id, description=f"Workshop {w.get('business_name')} verified={verified}")
        except:
            pass
        return jsonify({"success": True, "workshop": _clean(w)}), 200
    finally:
        cur.close(); conn.close()


@workshops_bp.route("/<int:workshop_id>/customers", methods=["GET"])
def get_workshop_customers(workshop_id):
    try:
        from datetime import datetime, date
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Bookings for this workshop
        cur.execute("SELECT * FROM bookings WHERE workshop_id=%s ORDER BY booking_date DESC, id DESC", (workshop_id,))
        bookings = cur.fetchall()
        # Incomes for totals
        try:
            cur.execute("SELECT * FROM workshop_incomes WHERE workshop_id=%s", (workshop_id,))
            incomes = cur.fetchall()
        except: incomes = []
        # Owners for email/phone/location
        try:
            cur.execute("SELECT * FROM owners")
            owners = cur.fetchall()
        except: owners = []
        # Reviews for rating
        try:
            cur.execute("SELECT * FROM reviews WHERE workshop_id=%s", (workshop_id,))
            reviews = cur.fetchall()
        except: reviews = []
        cur.close(); conn.close()

        owner_by_id = {str(o.get("id")): o for o in owners}
        owner_by_name = {str(o.get("full_name") or o.get("name") or "").lower(): o for o in owners}
        owner_by_email = {str(o.get("email") or "").lower(): o for o in owners}

        def map_status(raw):
            s = str(raw or "").lower()
            if s in ("completed","done","paid"): return "Completed"
            if s in ("in_progress","in-progress","diagnosing","diagnosis","awaiting_parts","qc","on_hold"): return "In Progress"
            if s in ("pending","confirmed","booked","new","scheduled","awaiting"): return "Booked"
            if s in ("cancelled","canceled"): return "Cancelled"
            return "Booked"

        groups = {}
        for b in bookings:
            owner_id = b.get("owner_id") or b.get("customer_id") or b.get("user_id")
            name = b.get("owner_name") or b.get("customer_name") or b.get("name") or "Customer"
            key = str(owner_id) if owner_id else name.lower().strip()
            if key not in groups:
                owner = owner_by_id.get(str(owner_id)) or owner_by_name.get(name.lower()) or owner_by_email.get(str(b.get("owner_email") or b.get("customer_email") or "").lower()) or {}
                groups[key] = {
                    "owner_id": owner_id, "name": name,
                    "email": b.get("owner_email") or b.get("customer_email") or owner.get("email") or "-",
                    "phone": b.get("owner_phone") or b.get("customer_phone") or b.get("phone") or owner.get("phone") or owner.get("whatsapp") or "-",
                    "location": owner.get("location") or owner.get("address") or owner.get("city") or "Inglewood, CA",
                    "avatar": owner.get("avatar") or "",
                    "bookings": [], "totalSpent": 0, "jobs": 0,
                }
            groups[key]["bookings"].append(b)

        # Incomes by customer name for totalSpent
        inc_by_name = {}
        for inc in incomes:
            if str(inc.get("status","")).lower() not in ("paid","completed","success"): continue
            k = str(inc.get("customer_name") or inc.get("customer") or "").lower().strip()
            inc_by_name[k] = inc_by_name.get(k, 0) + float(inc.get("amount") or 0)

        # Reviews avg by owner name
        rev_by_name = {}
        for r in reviews:
            k = str(r.get("owner_name") or r.get("customer_name") or r.get("name") or "").lower().strip()
            if not k: continue
            rev_by_name.setdefault(k, []).append(float(r.get("rating") or 0))

        customers = []
        for key, g in groups.items():
            bs = sorted(g["bookings"], key=lambda x: str(x.get("booking_date") or x.get("date") or ""), reverse=True)
            latest = bs[0] if bs else {}
            # Car string from latest booking
            car_str = latest.get("car") or latest.get("vehicle") or ""
            if not car_str:
                parts = [latest.get("car_make"), latest.get("car_model"), latest.get("car_year")]
                car_str = " ".join([str(p) for p in parts if p]) or "Vehicle"
            plate = latest.get("plate") or latest.get("license_plate") or latest.get("car_plate") or ""
            # distinct cars
            seen_cars = {}
            for b in bs:
                cstr = b.get("car") or b.get("vehicle") or " ".join([str(b.get("car_make") or ""), str(b.get("car_model") or ""), str(b.get("car_year") or "")]).strip() or "Vehicle"
                seen_cars[cstr] = {"make": cstr, "plate": b.get("plate") or b.get("license_plate") or plate or "", "vin": b.get("vin") or b.get("car_vin") or "", "health": 85}
            # history
            history = []
            for b in bs:
                history.append({"date": str(b.get("booking_date") or b.get("date") or "")[:10], "service": b.get("service_type") or b.get("service") or "General Repair", "amount": float(b.get("amount") or 0), "status": map_status(b.get("status")), "rating": None})
            # next date = earliest future booked
            today = date.today().isoformat()
            future = [str(b.get("booking_date") or "")[:10] for b in bs if str(b.get("booking_date") or "")[:10] >= today and map_status(b.get("status")) == "Booked"]
            next_date = sorted(future)[0] if future else "-"
            last_date = str(latest.get("booking_date") or latest.get("date") or "")[:10] or "-"
            jobs = len(bs)
            # totalSpent: prefer incomes, else sum completed bookings
            total = inc_by_name.get(g["name"].lower(), 0)
            if not total:
                total = sum(float(b.get("amount") or 0) for b in bs if map_status(b.get("status")) == "Completed")
            ratings = rev_by_name.get(g["name"].lower(), [])
            avg_rating = round(sum(ratings)/len(ratings), 1) if ratings else None
            loyalty = "VIP • %d visits" % jobs if jobs >= 5 else ("Repeat • %d visits" % jobs if jobs >= 2 else "First Visit")
            customers.append({
                "id": f"#CUST-{1000 + (g['owner_id'] or 0) if g['owner_id'] else 3000 + len(customers)}",
                "dbId": g["owner_id"], "name": g["name"], "email": g["email"], "phone": g["phone"],
                "avatar": g["avatar"] or f"https://ui-avatars.com/api/?name={g['name'].replace(' ','+')}&background=0A192F&color=fff",
                "car": f"{car_str} • {plate}" if plate else car_str,
                "plate": f"{plate} • CA" if plate else "CA",
                "lastDate": last_date, "nextDate": next_date,
                "totalSpent": total, "jobs": jobs,
                "status": map_status(latest.get("status")),
                "rating": avg_rating, "location": g["location"], "loyalty": loyalty,
                "cars": list(seen_cars.values()) or [{"make": car_str, "plate": plate, "vin": "", "health": 85}],
                "history": history,
            })
        customers.sort(key=lambda x: x["lastDate"], reverse=True)
        return jsonify(customers)
    except Exception as e:
        print("GET workshop customers error:", e)
        return jsonify({"error": str(e)}), 500


def _ensure_team_table(cur, conn):
    cur.execute("""CREATE TABLE IF NOT EXISTS workshop_team (
        id SERIAL PRIMARY KEY, workshop_id INT,
        name TEXT, full_name TEXT, role TEXT, phone TEXT, email TEXT, experience INT DEFAULT 0,
        hire_date DATE, status TEXT DEFAULT 'Active', bar_license TEXT,
        certifications TEXT DEFAULT '[]', specialties TEXT DEFAULT '[]',
        bio TEXT, avatar TEXT, jobs_completed INT DEFAULT 0, rating FLOAT DEFAULT 5.0,
        created_at TIMESTAMP DEFAULT NOW())""")
    cols = [
        ("workshop_id","INT"), ("name","TEXT"), ("full_name","TEXT"), ("role","TEXT"),
        ("phone","TEXT"), ("email","TEXT"), ("experience","INT DEFAULT 0"),
        ("hire_date","DATE"), ("status","TEXT DEFAULT 'Active'"),
        ("bar_license","TEXT"), ("certifications","TEXT DEFAULT '[]'"),
        ("specialties","TEXT DEFAULT '[]'"), ("bio","TEXT"), ("avatar","TEXT"),
        ("jobs_completed","INT DEFAULT 0"), ("rating","FLOAT DEFAULT 5.0"),
        ("created_at","TIMESTAMP DEFAULT NOW()"),
    ]
    for n, t in cols:
        try: cur.execute(f"ALTER TABLE workshop_team ADD COLUMN IF NOT EXISTS {n} {t}")
        except Exception: conn.rollback()
    # Old tables have full_name NOT NULL - drop it, we fill both anyway
    for col in ["full_name","name","role","email","phone","bar_license","bio","avatar","certifications","specialties","status"]:
        try: cur.execute(f"ALTER TABLE workshop_team ALTER COLUMN {col} DROP NOT NULL")
        except Exception: conn.rollback()
    conn.commit()

@workshops_bp.route("/<int:workshop_id>/team", methods=["POST"])
def add_team(workshop_id):
    try:
        d = request.get_json() or {}
        if not d.get("name") or not d.get("role"):
            return jsonify({"error": "Name and Role required"}), 400
        if not d.get("specialties"):
            return jsonify({"error": "Select at least one specialty"}), 400
        conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
        _ensure_team_table(cur, conn)
        nm = d.get("name")
        values = (
            workshop_id,
            nm, nm,  # name, full_name - keep both in sync
            d.get("role"),
            d.get("phone"),
            d.get("email"),
            int(d.get("experience") or 0),
            _parse_hire_date(d.get("hireDate") or d.get("hire_date")),
            d.get("status") or "Active",
            d.get("barLicense") or d.get("bar_license") or "",
            json.dumps(d.get("certifications") or []),
            json.dumps(d.get("specialties") or []),
            d.get("bio") or "",
            d.get("avatar") or "",
            int(d.get("jobsCompleted") or d.get("jobs_completed") or 0),
            float(d.get("rating") or 5.0)
        )
        cur.execute("INSERT INTO workshop_team (workshop_id,name,full_name,role,phone,email,experience,hire_date,status,bar_license,certifications,specialties,bio,avatar,jobs_completed,rating) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *", values)
        row = cur.fetchone(); conn.commit(); cur.close(); conn.close()
        return jsonify(row), 201
    except Exception as e:
        print("POST team error:", e); return jsonify({"error": str(e)}), 500

@workshops_bp.route("/<int:workshop_id>/team/<int:member_id>", methods=["PUT"])
def update_team(workshop_id, member_id):
    try:
        d = request.get_json() or {}
        conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
        _ensure_team_table(cur, conn)
        nm = d.get("name")
        values = (
            nm, nm,  # name, full_name
            d.get("role"),
            d.get("phone"),
            d.get("email"),
            int(d.get("experience") or 0),
            _parse_hire_date(d.get("hireDate") or d.get("hire_date")),
            d.get("status") or "Active",
            d.get("barLicense") or d.get("bar_license") or "",
            json.dumps(d.get("certifications") or []),
            json.dumps(d.get("specialties") or []),
            d.get("bio") or "",
            d.get("avatar") or "",
            int(d.get("jobsCompleted") or d.get("jobs_completed") or 0),
            float(d.get("rating") or 5.0),
            member_id,
            workshop_id
        )
        cur.execute("UPDATE workshop_team SET name=%s,full_name=%s,role=%s,phone=%s,email=%s,experience=%s,hire_date=%s,status=%s,bar_license=%s,certifications=%s,specialties=%s,bio=%s,avatar=%s,jobs_completed=%s,rating=%s WHERE id=%s AND workshop_id=%s RETURNING *", values)
        row = cur.fetchone()
        if not row: return jsonify({"error": "Member not found"}), 404
        conn.commit(); cur.close(); conn.close()
        return jsonify(row)
    except Exception as e:
        print("PUT team error:", e); return jsonify({"error": str(e)}), 500


@workshops_bp.route("/<int:workshop_id>/team", methods=["GET"])
def get_team(workshop_id):
    try:
        conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
        _ensure_team_table(cur, conn)
        cur.execute("SELECT * FROM workshop_team WHERE workshop_id=%s ORDER BY id DESC", (workshop_id,))
        rows = cur.fetchall()
        out = []
        for r in rows:
            d = dict(r)
            for k, v in list(d.items()):
                if isinstance(v, (datetime, date)):
                    d[k] = v.isoformat()[:10]
                elif isinstance(v, Decimal):
                    d[k] = float(v)
            # Sync both name columns - old rows only have full_name
            nm = d.get("name") or d.get("full_name") or "Member"
            d["name"] = nm
            d["full_name"] = nm
            # Normalize hire_date to YYYY-MM-DD string
            if d.get("hire_date"):
                d["hire_date"] = str(d["hire_date"])[:10]
                d["hireDate"] = d["hire_date"]
            out.append(d)
        cur.close(); conn.close()
        return jsonify(out)
    except Exception as e:
        print("GET team error:", e)
        return jsonify({"error": str(e)}), 500


@workshops_bp.route("/<int:workshop_id>/team/<int:member_id>", methods=["DELETE"])
def delete_team(workshop_id, member_id):
    try:
        conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
        _ensure_team_table(cur, conn)
        cur.execute("DELETE FROM workshop_team WHERE id=%s AND workshop_id=%s RETURNING *", (member_id, workshop_id))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Member not found"}), 404
        conn.commit(); cur.close(); conn.close()
        return jsonify({"success": True, "deleted": row})
    except Exception as e:
        print("DELETE team error:", e); return jsonify({"error": str(e)}), 500


# --- WORKSHOP SETTINGS ---
def _ensure_workshop_settings_columns(cur, conn):
    cols = [
        ("owner_name","TEXT"), ("description","TEXT"),
        ("bar_license","TEXT"), ("bar_type","TEXT"), ("bar_expiry","DATE"), ("bar_verified","BOOLEAN DEFAULT TRUE"),
        ("address","TEXT"), ("city","TEXT"), ("state","TEXT"), ("zip","TEXT"),
        ("phone","TEXT"), ("support_phone","TEXT"),
        ("email","TEXT"), ("support_email","TEXT"), ("info_email","TEXT"),
        ("website","TEXT"), ("tax_id","TEXT"), ("timezone","TEXT"), ("currency","TEXT"),
        ("logo","TEXT"), ("avatar","TEXT"),
        ("specialties","TEXT DEFAULT '[]'"), ("hours","TEXT DEFAULT '[]'"),
        ("business_name","TEXT"), ("name","TEXT"),
    ]
    for n, t in cols:
        try:
            cur.execute(f"ALTER TABLE workshops ADD COLUMN IF NOT EXISTS {n} {t}")
        except Exception:
            conn.rollback()
    conn.commit()

def _parse_settings_date(v):
    if not v: return None
    s = str(v).strip()
    if not s: return None
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    try:
        from datetime import datetime
        for fmt in ("%a, %d %b %Y %H:%M:%S %Z", "%a, %d %b %Y", "%a %b %d %Y", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%d"):
            try: return datetime.strptime(s, fmt).date().isoformat()
            except Exception: continue
        d = datetime.fromisoformat(s.replace("Z","+00:00"))
        return d.date().isoformat()
    except Exception:
        return None

def _parse_settings_json(v, default):
    if not v: return default
    if isinstance(v, list): return v
    if isinstance(v, dict): return v
    try:
        p = json.loads(v)
        return p if isinstance(p, list) else default
    except Exception:
        return default

@workshops_bp.route("/<int:workshop_id>/settings", methods=["GET"])
def get_workshop_settings(workshop_id):
    try:
        conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
        _ensure_workshop_settings_columns(cur, conn)
        cur.execute("SELECT * FROM workshops WHERE id=%s", (workshop_id,))
        w = cur.fetchone()
        if not w:
            cur.close(); conn.close()
            return jsonify({"error": "Workshop not found"}), 404
        d = dict(w)
        # Serialize dates / decimals
        for k, v in list(d.items()):
            if isinstance(v, (datetime, date)):
                d[k] = v.isoformat()[:10]
            elif isinstance(v, Decimal):
                d[k] = float(v)
        # Specialties + Hours
        specialties = _parse_settings_json(d.get("specialties"), [])
        hours = _parse_settings_json(d.get("hours"), [])
        # Normalize specialties: string -> object
        norm_specs = []
        for s in specialties:
            if isinstance(s, str):
                norm_specs.append({"name": s, "added": datetime.now().date().isoformat(), "primary": False, "enabled": True, "teamCount": 0})
            elif isinstance(s, dict):
                norm_specs.append({
                    "name": s.get("name") or s.get("specialty") or "",
                    "added": s.get("added") or datetime.now().date().isoformat(),
                    "primary": bool(s.get("primary")),
                    "enabled": s.get("enabled", True) if s.get("enabled") is not None else True,
                    "teamCount": int(s.get("teamCount") or s.get("team_count") or 0),
                })
        # Team counts from workshop_team
        try:
            cur.execute("SELECT specialties FROM workshop_team WHERE workshop_id=%s", (workshop_id,))
            team_rows = cur.fetchall()
            counts = {}
            for tr in team_rows:
                for sp in _parse_settings_json(tr.get("specialties"), []):
                    if isinstance(sp, str):
                        counts[sp] = counts.get(sp, 0) + 1
                    elif isinstance(sp, dict) and sp.get("name"):
                        counts[sp["name"]] = counts.get(sp["name"], 0) + 1
            for ns in norm_specs:
                if ns["name"] in counts:
                    ns["teamCount"] = counts[ns["name"]]
        except Exception:
            pass
        if not hours:
            hours = [
                {"day":"Monday","open":"08:00","close":"18:00","enabled":True},
                {"day":"Tuesday","open":"08:00","close":"18:00","enabled":True},
                {"day":"Wednesday","open":"08:00","close":"18:00","enabled":True},
                {"day":"Thursday","open":"08:00","close":"18:00","enabled":True},
                {"day":"Friday","open":"08:00","close":"18:00","enabled":True},
                {"day":"Saturday","open":"08:00","close":"16:00","enabled":True},
                {"day":"Sunday","open":"09:00","close":"14:00","enabled":False},
            ]
        d["specialties"] = norm_specs
        d["hours"] = hours
        # Aliases for frontend
        d["name"] = d.get("name") or d.get("business_name") or ""
        d["business_name"] = d["name"]
        d["ownerName"] = d.get("owner_name") or ""
        d["owner_name"] = d["ownerName"]
        d["barLicense"] = d.get("bar_license") or ""
        d["barType"] = d.get("bar_type") or "Automotive Repair Dealer"
        d["barExpiry"] = _parse_settings_date(d.get("bar_expiry")) or ""
        d["barVerified"] = bool(d.get("bar_verified")) if d.get("bar_verified") is not None else True
        d["supportPhone"] = d.get("support_phone") or ""
        d["supportEmail"] = d.get("support_email") or ""
        d["infoEmail"] = d.get("info_email") or ""
        d["taxId"] = d.get("tax_id") or ""
        d["logo"] = d.get("logo") or d.get("avatar") or ""
        d["avatar"] = d["logo"]
        cur.close(); conn.close()
        return jsonify(d)
    except Exception as e:
        print("GET settings error:", e)
        return jsonify({"error": str(e)}), 500

@workshops_bp.route("/<int:workshop_id>/settings", methods=["PUT"])
def update_workshop_settings(workshop_id):
    try:
        d = request.get_json() or {}
        conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
        _ensure_workshop_settings_columns(cur, conn)
        name = d.get("name") or d.get("business_name") or d.get("workshop_name") or d.get("businessName")
        owner_name = d.get("ownerName") or d.get("owner_name")
        description = d.get("description")
        bar_license = d.get("barLicense") or d.get("bar_license") or d.get("bar_license_number")
        bar_type = d.get("barType") or d.get("bar_type")
        bar_expiry = _parse_settings_date(d.get("barExpiry") or d.get("bar_expiry"))
        bar_verified = d.get("barVerified") if d.get("barVerified") is not None else d.get("bar_verified")
        address = d.get("address"); city = d.get("city"); state = d.get("state"); zip_code = d.get("zip")
        phone = d.get("phone"); support_phone = d.get("supportPhone") or d.get("support_phone")
        email = d.get("email"); support_email = d.get("supportEmail") or d.get("support_email")
        info_email = d.get("infoEmail") or d.get("info_email")
        website = d.get("website"); tax_id = d.get("taxId") or d.get("tax_id")
        timezone = d.get("timezone"); currency = d.get("currency")
        logo = d.get("logo") or d.get("avatar")
        specialties = d.get("specialties") or []
        hours = d.get("hours") or []
        norm_specs = []
        for s in specialties:
            if isinstance(s, str):
                norm_specs.append({"name": s, "added": datetime.now().date().isoformat(), "primary": False, "enabled": True, "teamCount": 0})
            else:
                norm_specs.append({
                    "name": s.get("name",""),
                    "added": s.get("added") or datetime.now().date().isoformat(),
                    "primary": bool(s.get("primary")),
                    "enabled": bool(s.get("enabled")) if s.get("enabled") is not None else True,
                    "teamCount": int(s.get("teamCount") or 0),
                })
        cur.execute("""
            UPDATE workshops SET
                name=%s, business_name=%s, owner_name=%s, description=%s,
                bar_license=%s, bar_type=%s, bar_expiry=%s, bar_verified=%s,
                address=%s, city=%s, state=%s, zip=%s,
                phone=%s, support_phone=%s, email=%s, support_email=%s, info_email=%s,
                website=%s, tax_id=%s, timezone=%s, currency=%s,
                logo=%s, avatar=%s, specialties=%s, hours=%s
            WHERE id=%s RETURNING *
        """, (
            name, name, owner_name, description,
            bar_license, bar_type, bar_expiry, bar_verified,
            address, city, state, zip_code,
            phone, support_phone, email, support_email, info_email,
            website, tax_id, timezone, currency,
            logo, logo, json.dumps(norm_specs), json.dumps(hours),
            workshop_id
        ))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return jsonify({"error": "Workshop not found"}), 404
        conn.commit(); cur.close(); conn.close()
        return jsonify({"success": True, "message": "Settings saved"}), 200
    except Exception as e:
        print("PUT settings error:", e)
        return jsonify({"error": str(e)}), 500


@workshops_bp.route("/available", methods=["GET"])
def list_available_workshops():
    """For car owners: only verified + active subscription workshops."""
    try:
        conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT DISTINCT w.*,
              COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.workshop_id = w.id), 0) as avg_rating,
              COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.workshop_id = w.id), 0) as review_count,
              COALESCE((SELECT COUNT(*) FROM favorites f WHERE f.workshop_id = w.id), 0) as like_count,
              COALESCE((SELECT COUNT(*) FROM bookings b WHERE b.workshop_id = w.id), 0) as job_count
            FROM workshops w
            JOIN subscriptions s ON s.workshop_id = w.id
            WHERE w.verified = TRUE
              AND LOWER(COALESCE(w.status,'active')) IN ('active','approved','verified')
              AND LOWER(s.status) IN ('active','trial','trialing')
              AND s.end_date >= CURRENT_DATE
            ORDER BY avg_rating DESC, w.id DESC
        """)
        rows = cur.fetchall()
        out = []
        for r in rows:
            d = dict(r)
            for k, v in list(d.items()):
                if isinstance(v, (datetime, date)): d[k] = v.isoformat()[:10]
                elif isinstance(v, Decimal): d[k] = float(v)
            # Normalize for frontend
            specialties = d.get("specialties") or d.get("expertise") or []
            if isinstance(specialties, str):
                try: specialties = json.loads(specialties)
                except: specialties = [specialties]
            if specialties and isinstance(specialties[0], dict):
                specialties = [s.get("name") for s in specialties if s.get("name")]
            out.append({
                "id": d.get("id"),
                "name": d.get("name") or d.get("business_name") or "Workshop",
                "location": d.get("city") or d.get("location") or "Los Angeles",
                "address": d.get("address") or "",
                "city": d.get("city") or "",
                "rating": round(float(d.get("avg_rating") or d.get("rating") or 0), 1) or 4.5,
                "reviews": int(d.get("review_count") or 0),
                "likes": int(d.get("like_count") or d.get("likes") or 0),
                "jobs": int(d.get("job_count") or 0),
                "price": d.get("price") or "$45/hr",
                "phone": d.get("phone") or "",
                "email": d.get("email") or "",
                "hours": d.get("hours") or "Mon-Sat 8AM-7PM",
                "expertise": specialties[:4] if specialties else ["Oil Change","Brake Service","Diagnostics"],
                "services": specialties[:6] if specialties else ["Oil Change","Brake Service","Diagnostics"],
                "image": d.get("logo") or d.get("avatar") or d.get("image") or "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=800&q=80",
                "verified": bool(d.get("verified")),
                "distance": "1.2 mi",
                "response": "12 min",
                "about": d.get("description") or d.get("about") or "BAR licensed workshop",
            })
        
        
        cur.close(); conn.close()
        return jsonify(out)
    except Exception as e:
        print("list_available_workshops error:", e)
        return jsonify({"error": str(e)}), 500



