from psycopg2.extras import RealDictCursor
from flask import Blueprint, request, jsonify
from db import get_db_connection, dict_cursor, log_activity
import uuid
from datetime import date, timedelta
from decimal import Decimal
import datetime
import time

finance_bp = Blueprint("finance", __name__)

PLANS = {
    "free_trial": {"name": "1 Week Free Trial", "price": 0, "days": 7, "db": "Trial"},
    "monthly": {"name": "Monthly", "price": 40, "days": 30, "db": "Monthly"},
    "quarterly": {"name": "Quarterly", "price": 100, "days": 90, "db": "Quarterly"},
    "annual": {"name": "Annual", "price": 300, "days": 365, "db": "Annual"},
}

def _safe_int(v, default=200):
    try:
        return int(v)
    except:
        return default

def _clean_rows(rows):
    out = []
    for r in rows or []:
        nr = {}
        for k, v in (r or {}).items():
            if isinstance(v, (datetime.date, datetime.datetime)):
                nr[k] = str(v)[:10] if isinstance(v, datetime.date) and not isinstance(v, datetime.datetime) else str(v)[:10]
            elif isinstance(v, Decimal):
                nr[k] = float(v)
            else:
                nr[k] = v
        out.append(nr)
    return out

def _clean_row(r):
    if not r:
        return r
    return _clean_rows([r])[0]

# ---------- SUBSCRIPTIONS ----------

@finance_bp.route("/subscriptions", methods=["GET"])
def get_subscriptions():
    workshop_id = request.args.get("workshop_id")
    status = request.args.get("status")
    plan = request.args.get("plan")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    q = request.args.get("q", "")
    limit = _safe_int(request.args.get("limit", 200), 200)
    offset = _safe_int(request.args.get("offset", 0), 0)
    conn = get_db_connection(); cur = dict_cursor(conn)
    try:
        sql = """SELECT s.*, COALESCE(w.business_name, w.name) as workshop_name,
                 w.owner_name, w.email, w.phone, w.bar_license, w.address, w.logo_url
                 FROM subscriptions s
                 LEFT JOIN workshops w ON w.id = s.workshop_id WHERE 1=1"""
        params = []
        if workshop_id and workshop_id != "All":
            sql += " AND s.workshop_id=%s"; params.append(workshop_id)
        if status and status != "All":
            sql += " AND s.status=%s"; params.append(status)
        if plan and plan != "All":
            sql += " AND s.plan=%s"; params.append(plan)
        if date_from:
            sql += " AND s.start_date>=%s"; params.append(date_from)
        if date_to:
            sql += " AND s.start_date<=%s"; params.append(date_to)
        if q:
            sql += " AND COALESCE(w.business_name, w.name) ILIKE %s"; params.append(f"%{q}%")
        sql += " ORDER BY s.start_date DESC, s.id DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        cur.execute(sql, tuple(params))
        rows = _clean_rows(cur.fetchall())
        for r in rows:
            if r.get("amount") is not None:
                try: r["amount"] = float(r["amount"])
                except: pass
        return jsonify(rows)
    finally:
        cur.close(); conn.close()

@finance_bp.route("/subscriptions", methods=["POST"])
def create_subscription():
    d = request.get_json() or {}
    workshop_id = d.get("workshop_id")
    raw_plan = str(d.get("plan_id") or d.get("plan") or "monthly").lower()
    # normalize: "1 Week Free Trial" -> free_trial, "Trial" -> free_trial, etc.
    if "trial" in raw_plan:
        plan_id = "free_trial"
    elif "quarter" in raw_plan:
        plan_id = "quarterly"
    elif "annual" in raw_plan or "year" in raw_plan:
        plan_id = "annual"
    elif "monthly" in raw_plan or "month" in raw_plan:
        plan_id = "monthly"
    else:
        plan_id = raw_plan
    if plan_id not in PLANS:
        return jsonify({"success": False, "error": "Invalid plan"}), 400
    if not workshop_id:
        return jsonify({"success": False, "error": "workshop_id required"}), 400
    plan = PLANS[plan_id]
    conn = get_db_connection(); cur = dict_cursor(conn)
    try:
        # 1 trial per workshop
        if plan_id == "free_trial":
            cur.execute("SELECT COUNT(*) as c FROM subscriptions WHERE workshop_id=%s AND LOWER(plan) IN ('trial','free_trial','1 week free trial')", (workshop_id,))
            cnt = (cur.fetchone() or {}).get("c", 0) or 0
            if cnt > 0:
                return jsonify({"success": False, "error": "Free Trial already used • One trial per workshop"}), 400
        cur.execute("SELECT email, COALESCE(business_name, name) as workshop_name FROM workshops WHERE id=%s", (workshop_id,))
        w = cur.fetchone() or {}
        start = date.today()
        end = start + timedelta(days=plan["days"])
        status = "trial" if plan_id == "free_trial" else "active"
        payment_method = d.get("payment_method") or ("Free Trial" if plan_id == "free_trial" else "Visa •••• 4242")
        billing_email = d.get("billing_email") or w.get("email") or ""
        # ensure optional columns exist (safe if already exist)
        try:
            cur.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255)")
            cur.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100)")
            cur.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT TRUE")
            conn.commit()
        except:
            conn.rollback()
        cur.execute("""INSERT INTO subscriptions (workshop_id, plan, status, start_date, end_date, amount, auto_renew, billing_email, payment_method)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                    (workshop_id, plan["db"], status, start, end, plan["price"], plan_id != "free_trial", billing_email, payment_method))
        sub = _clean_row(cur.fetchone())
        # receipt
        receipt_no = f"RCPT-{sub['id']}-ELITE"
        invoice_id = f"INV-{sub['id'] + 2000}"
        tx_id = f"TX-{uuid.uuid4().hex[:8].upper()}"
        period = f"{start} to {end}"
        cur.execute("""INSERT INTO subscription_receipts (subscription_id, workshop_id, receipt_number, transaction_id, plan, amount, payment_method, status, period, receipt_date, next_billing_date)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                    (sub["id"], workshop_id, receipt_no, tx_id, plan["name"], plan["price"], payment_method, "Paid", period, start, end))
        receipt = _clean_row(cur.fetchone())
        # also log as admin income so Admin > Incomes sees it
        try:
            cur.execute("""INSERT INTO admin_incomes (workshop_id, subscription_id, plan, amount, payment_method, receipt_id, transaction_id, status, period, date)
                           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                        (workshop_id, sub["id"], plan["name"], plan["price"], payment_method, receipt_no, tx_id, "Paid", period, start))
        except:
            conn.rollback()
            # retry without admin_incomes if table missing columns - don't fail subscription
            conn.commit()
        conn.commit()
        return jsonify({"success": True, "subscription": sub, "receipt": receipt}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cur.close(); conn.close()

@finance_bp.route("/subscriptions/<int:sub_id>/cancel", methods=["PUT"])
def cancel_subscription(sub_id):
    conn = get_db_connection(); cur = dict_cursor(conn)
    try:
        cur.execute("UPDATE subscriptions SET status='Canceled', auto_renew=FALSE WHERE id=%s RETURNING *", (sub_id,))
        row = _clean_row(cur.fetchone())
        conn.commit()
        if not row:
            return jsonify({"success": False, "error": "Subscription not found"}), 404
        return jsonify({"success": True, "subscription": row}), 200
    finally:
        cur.close(); conn.close()

@finance_bp.route("/subscriptions/<int:sub_id>/auto-renew", methods=["PUT"])
def toggle_auto_renew(sub_id):
    d = request.get_json() or {}
    auto = d.get("auto_renew")
    conn = get_db_connection(); cur = dict_cursor(conn)
    try:
        if auto is None:
            cur.execute("UPDATE subscriptions SET auto_renew = NOT COALESCE(auto_renew, TRUE) WHERE id=%s RETURNING *", (sub_id,))
        else:
            cur.execute("UPDATE subscriptions SET auto_renew=%s WHERE id=%s RETURNING *", (bool(auto), sub_id))
        row = _clean_row(cur.fetchone())
        conn.commit()
        if not row:
            return jsonify({"success": False, "error": "Subscription not found"}), 404
        return jsonify({"success": True, "subscription": row}), 200
    finally:
        cur.close(); conn.close()

@finance_bp.route("/subscriptions/receipts", methods=["GET"])
def get_subscription_receipts():
    workshop_id = request.args.get("workshop_id")
    plan = request.args.get("plan")
    limit = _safe_int(request.args.get("limit", 200), 200)
    offset = _safe_int(request.args.get("offset", 0), 0)
    conn = get_db_connection(); cur = dict_cursor(conn)
    try:
        sql = """SELECT r.*, COALESCE(w.business_name, w.name) AS workshop_name, w.owner_name, w.email, w.bar_license, w.address, w.logo_url
                 FROM subscription_receipts r
                 LEFT JOIN workshops w ON w.id = r.workshop_id WHERE 1=1"""
        params = []
        if workshop_id and workshop_id != "All":
            sql += " AND r.workshop_id=%s"; params.append(workshop_id)
        if plan and plan != "All":
            sql += " AND r.plan=%s"; params.append(plan)
        sql += " ORDER BY r.receipt_date DESC NULLS LAST, r.id DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        cur.execute(sql, tuple(params))
        rows = _clean_rows(cur.fetchall())
        for r in rows:
            for k in ["amount", "total"]:
                if r.get(k) is not None:
                    try: r[k] = float(r[k])
                    except: pass
        return jsonify(rows)
    finally:
        cur.close(); conn.close()

# ---------- ADMIN INCOMES ----------

@finance_bp.route("/admin/incomes", methods=["GET", "POST"])
def admin_incomes():
    if request.method == "POST":
        d = request.get_json() or {}
        conn = get_db_connection(); cur = dict_cursor(conn)
        try:
            receipt = f"RCPT-SUB-{uuid.uuid4().hex[:8].upper()}"
            tx = f"TX-{uuid.uuid4().hex[:8].upper()}"
            cur.execute("INSERT INTO admin_incomes (workshop_id,subscription_id,plan,amount,payment_method,receipt_id,transaction_id,status,period,date) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *",
                        (d.get("workshop_id"), d.get("subscription_id"), d.get("plan", "Monthly"), d.get("amount", 40), d.get("payment_method", "Card • 4242"), receipt, tx, d.get("status", "Paid"), d.get("period", "1 month"), d.get("date", date.today())))
            row = _clean_row(cur.fetchone())
            try:
                cur.execute("INSERT INTO subscription_receipts (subscription_id,workshop_id,receipt_number,transaction_id,plan,amount,payment_method,status,period,receipt_date,next_billing_date) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                            (d.get("subscription_id"), d.get("workshop_id"), receipt, tx, d.get("plan", "Monthly"), d.get("amount", 40), d.get("payment_method", "Card • 4242"), d.get("status", "Paid"), d.get("period", "1 month"), d.get("date", date.today()), d.get("next_billing_date")))
            except:
                conn.rollback()
                # re-insert income if rollback cleared it
                cur.execute("INSERT INTO admin_incomes (workshop_id,subscription_id,plan,amount,payment_method,receipt_id,transaction_id,status,period,date) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *",
                            (d.get("workshop_id"), d.get("subscription_id"), d.get("plan", "Monthly"), d.get("amount", 40), d.get("payment_method", "Card • 4242"), receipt, tx, d.get("status", "Paid"), d.get("period", "1 month"), d.get("date", date.today())))
                row = _clean_row(cur.fetchone())
            conn.commit()
            try:
                log_activity("Ayinde Admin", "Admin", "Payment Received", workshop_id=d.get("workshop_id"), description=f"Income {receipt} • ${d.get('amount')} • {d.get('plan')}")
            except:
                pass
            return jsonify(row), 201
        finally:
            cur.close(); conn.close()
    else:
        workshop_id = request.args.get("workshop_id"); plan = request.args.get("plan"); date_from = request.args.get("date_from"); date_to = request.args.get("date_to"); q = request.args.get("q", "")
        limit = _safe_int(request.args.get("limit", 200), 200); offset = _safe_int(request.args.get("offset", 0), 0)
        conn = get_db_connection(); cur = dict_cursor(conn)
        try:
            sql = """SELECT ai.*, COALESCE(w.business_name, w.name) as workshop_name, w.owner_name as owner, w.phone as phone, w.address as address, w.bar_license as bar, w.logo_url as logo_url
                     FROM admin_incomes ai LEFT JOIN workshops w ON w.id=ai.workshop_id WHERE 1=1"""
            params = []
            if workshop_id and workshop_id not in ["All", "Platform"]:
                sql += " AND ai.workshop_id=%s"; params.append(workshop_id)
            if plan and plan != "All":
                sql += " AND ai.plan=%s"; params.append(plan)
            if date_from:
                sql += " AND ai.date>=%s"; params.append(date_from)
            if date_to:
                sql += " AND ai.date<=%s"; params.append(date_to)
            if q:
                sql += " AND COALESCE(w.business_name, w.name) ILIKE %s"; params.append(f"%{q}%")
            sql += " ORDER BY ai.date DESC LIMIT %s OFFSET %s"; params.extend([limit, offset])
            cur.execute(sql, tuple(params))
            return jsonify(_clean_rows(cur.fetchall()))
        finally:
            cur.close(); conn.close()

# ---------- ADMIN EXPENDITURES ----------

@finance_bp.route("/admin/expenditures", methods=["GET", "POST"])
def admin_expenditures():
    if request.method == "POST":
        d = request.get_json() or {}; conn = get_db_connection(); cur = dict_cursor(conn)
        try:
            receipt = f"RCPT-EXP-{uuid.uuid4().hex[:6].upper()}"
            cur.execute("INSERT INTO admin_expenditures (category,description,amount,vendor,receipt_id,method,date,approved_by,workshop_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *",
                        (d.get("category"), d.get("description"), d.get("amount"), d.get("vendor"), receipt, d.get("method"), d.get("date", date.today()), d.get("approved_by", "Ayinde Admin"), d.get("workshop_id")))
            row = _clean_row(cur.fetchone()); conn.commit(); return jsonify(row), 201
        finally:
            cur.close(); conn.close()
    else:
        workshop_id = request.args.get("workshop_id"); cat = request.args.get("category"); date_from = request.args.get("date_from"); date_to = request.args.get("date_to"); q = request.args.get("q", "")
        limit = _safe_int(request.args.get("limit", 200), 200); offset = _safe_int(request.args.get("offset", 0), 0)
        conn = get_db_connection(); cur = dict_cursor(conn)
        try:
            sql = "SELECT ae.*, COALESCE(w.business_name, w.name) as workshop_name FROM admin_expenditures ae LEFT JOIN workshops w ON w.id=ae.workshop_id WHERE 1=1"; params = []
            if workshop_id and workshop_id not in ["All", "Platform"]:
                sql += " AND ae.workshop_id=%s"; params.append(workshop_id)
            if cat and cat != "All":
                sql += " AND ae.category=%s"; params.append(cat)
            if date_from:
                sql += " AND ae.date>=%s"; params.append(date_from)
            if date_to:
                sql += " AND ae.date<=%s"; params.append(date_to)
            if q:
                sql += " AND ae.description ILIKE %s"; params.append(f"%{q}%")
            sql += " ORDER BY ae.date DESC LIMIT %s OFFSET %s"; params.extend([limit, offset])
            cur.execute(sql, tuple(params))
            return jsonify(_clean_rows(cur.fetchall()))
        finally:
            cur.close(); conn.close()

# ---------- ADMIN BOOKKEEPING ----------

@finance_bp.route("/admin/bookkeeping", methods=["GET"])
def bookkeeping():
    typ = request.args.get("type", "All")
    cat = request.args.get("category", "All")
    workshop_id = request.args.get("workshop_id", "All")
    date_from = request.args.get("date_from", "")
    date_to = request.args.get("date_to", "")
    q = request.args.get("q", "")
    limit = _safe_int(request.args.get("limit", 200), 200); offset = _safe_int(request.args.get("offset", 0), 0)
    conn = get_db_connection(); cur = dict_cursor(conn)
    try:
        sql_inc = """SELECT ai.id, 'Income' as type, ai.plan as category,
                     COALESCE(w.business_name, w.name,'Platform') || ' • ' || COALESCE(ai.plan,'Monthly') || ' subscription' as description,
                     ai.workshop_id, COALESCE(w.business_name, w.name,'Platform') as workshop_name,
                     ai.amount, ai.date, ai.receipt_id, ai.payment_method as method, ai.status
                     FROM admin_incomes ai LEFT JOIN workshops w ON w.id = ai.workshop_id WHERE 1=1"""
        sql_exp = """SELECT ae.id, 'Expenditure' as type, ae.category as category,
                     ae.description as description,
                     ae.workshop_id, COALESCE(w.business_name, w.name,'Platform • Ayinde Technologies') as workshop_name,
                     ae.amount, ae.date, ae.receipt_id, ae.method as method, 'Paid' as status
                     FROM admin_expenditures ae LEFT JOIN workshops w ON w.id = ae.workshop_id WHERE 1=1"""
        p_inc, p_exp = [], []
        if workshop_id and workshop_id not in ["All", "Platform"]:
            sql_inc += " AND ai.workshop_id=%s"; p_inc.append(workshop_id)
            sql_exp += " AND ae.workshop_id=%s"; p_exp.append(workshop_id)
        if cat and cat != "All":
            sql_inc += " AND ai.plan=%s"; p_inc.append(cat)
            sql_exp += " AND ae.category=%s"; p_exp.append(cat)
        if date_from:
            sql_inc += " AND ai.date>=%s"; p_inc.append(date_from)
            sql_exp += " AND ae.date>=%s"; p_exp.append(date_from)
        if date_to:
            sql_inc += " AND ai.date<=%s"; p_inc.append(date_to)
            sql_exp += " AND ae.date<=%s"; p_exp.append(date_to)
        if q:
            sql_inc += " AND COALESCE(w.business_name, w.name) ILIKE %s"; p_inc.append(f"%{q}%")
            sql_exp += " AND ae.description ILIKE %s"; p_exp.append(f"%{q}%")
        rows = []
        if typ in ["All", "Income"]:
            cur.execute(sql_inc, tuple(p_inc)); rows += _clean_rows(cur.fetchall())
        if typ in ["All", "Expenditure"]:
            cur.execute(sql_exp, tuple(p_exp)); rows += _clean_rows(cur.fetchall())
        rows.sort(key=lambda r: str(r.get("date") or ""), reverse=True)
        rows = rows[offset: offset + limit]
        return jsonify(rows)
    finally:
        cur.close(); conn.close()

@finance_bp.route("/admin/receipts", methods=["GET"])
def admin_receipts():
    workshop_id = request.args.get("workshop_id"); plan = request.args.get("plan")
    limit = _safe_int(request.args.get("limit", 200), 200); offset = _safe_int(request.args.get("offset", 0), 0)
    conn = get_db_connection(); cur = dict_cursor(conn)
    try:
        sql = "SELECT sr.*, COALESCE(w.business_name, w.name) as workshop_name FROM subscription_receipts sr LEFT JOIN workshops w ON w.id=sr.workshop_id WHERE 1=1"; params = []
        if workshop_id and workshop_id != "All":
            sql += " AND sr.workshop_id=%s"; params.append(workshop_id)
        if plan and plan != "All":
            sql += " AND sr.plan=%s"; params.append(plan)
        sql += " ORDER BY sr.receipt_date DESC NULLS LAST, sr.id DESC LIMIT %s OFFSET %s"; params.extend([limit, offset])
        cur.execute(sql, tuple(params))
        return jsonify(_clean_rows(cur.fetchall()))
    finally:
        cur.close(); conn.close()

# ---------- WORKSHOP INCOMES / EXPENDITURES ----------

@finance_bp.route("/workshop/incomes", methods=["GET", "POST"])
def workshop_incomes():
    if request.method == "POST":
        d = request.get_json() or {}; conn = get_db_connection(); cur = dict_cursor(conn)
        try:
            receipt = f"RCPT-WK-{uuid.uuid4().hex[:6].upper()}"
            cur.execute("INSERT INTO workshop_incomes (workshop_id,booking_id,category,description,amount,payment_method,receipt_id,date) VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *",
                        (d.get("workshop_id"), d.get("booking_id"), d.get("category", "Service"), d.get("description"), d.get("amount"), d.get("payment_method", "Cash"), receipt, d.get("date", date.today())))
            row = _clean_row(cur.fetchone()); conn.commit(); return jsonify(row), 201
        finally:
            cur.close(); conn.close()
    else:
        workshop_id = request.args.get("workshop_id")
        limit = _safe_int(request.args.get("limit", 200), 200); offset = _safe_int(request.args.get("offset", 0), 0)
        if not workshop_id or workshop_id == "All":
            return jsonify([])
        conn = get_db_connection(); cur = dict_cursor(conn)
        try:
            cur.execute("SELECT * FROM workshop_incomes WHERE workshop_id=%s ORDER BY date DESC LIMIT %s OFFSET %s", (workshop_id, limit, offset))
            return jsonify(_clean_rows(cur.fetchall()))
        finally:
            cur.close(); conn.close()

@finance_bp.route("/workshop/expenditures", methods=["GET", "POST"])
def workshop_exp():
    if request.method == "POST":
        d = request.get_json() or {}; conn = get_db_connection(); cur = dict_cursor(conn)
        try:
            receipt = f"RCPT-WK-EXP-{uuid.uuid4().hex[:6].upper()}"
            cur.execute("INSERT INTO workshop_expenditures (workshop_id,category,description,amount,vendor,receipt_id,method,date,approved_by) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *",
                        (d.get("workshop_id"), d.get("category"), d.get("description"), d.get("amount"), d.get("vendor"), receipt, d.get("method"), d.get("date", date.today()), d.get("approved_by")))
            row = _clean_row(cur.fetchone()); conn.commit(); return jsonify(row), 201
        finally:
            cur.close(); conn.close()
    else:
        workshop_id = request.args.get("workshop_id")
        limit = _safe_int(request.args.get("limit", 200), 200); offset = _safe_int(request.args.get("offset", 0), 0)
        if not workshop_id or workshop_id == "All":
            return jsonify([])
        conn = get_db_connection(); cur = dict_cursor(conn)
        try:
            cur.execute("SELECT * FROM workshop_expenditures WHERE workshop_id=%s ORDER BY date DESC LIMIT %s OFFSET %s", (workshop_id, limit, offset))
            return jsonify(_clean_rows(cur.fetchall()))
        finally:
            cur.close(); conn.close()


# --- Workshop Payments / Revenue Book ---
@finance_bp.route("/workshops/<int:workshop_id>/incomes", methods=["GET"])
def get_workshop_incomes(workshop_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS workshop_incomes (
                id SERIAL PRIMARY KEY,
                workshop_id INT NOT NULL
            )
        """)
        # Auto-migrate old table - adds any missing column
        for col_sql in [
            "ADD COLUMN IF NOT EXISTS booking_id INT",
            "ADD COLUMN IF NOT EXISTS customer_name TEXT",
            "ADD COLUMN IF NOT EXISTS car TEXT",
            "ADD COLUMN IF NOT EXISTS service TEXT",
            "ADD COLUMN IF NOT EXISTS service_type TEXT",
            "ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Card'",
            "ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'paid'",
            "ADD COLUMN IF NOT EXISTS payment_date DATE DEFAULT CURRENT_DATE",
            "ADD COLUMN IF NOT EXISTS tax NUMERIC DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS description TEXT",
            "ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
        ]:
            cur.execute(f"ALTER TABLE workshop_incomes {col_sql}")
        conn.commit()

        cur.execute("""
            SELECT id, workshop_id, booking_id, customer_name, car,
                   COALESCE(service_type, service) as service,
                   amount, payment_method, status,
                   COALESCE(payment_date, created_at::date) as payment_date,
                   tax, discount
            FROM workshop_incomes
            WHERE workshop_id = %s
            ORDER BY created_at DESC LIMIT 200
        """, (workshop_id,))
        rows = cur.fetchall()
        cur.close(); conn.close()
        for r in rows:
            for k in ["amount","tax","discount"]:
                if r.get(k) is not None: r[k] = float(r[k])
            if r.get("payment_date"): r["payment_date"] = str(r["payment_date"])
        return jsonify(rows), 200
    except Exception as e:
        print("GET workshop incomes error:", e)
        return jsonify({"error": str(e)}), 500


@finance_bp.route("/workshops/<int:workshop_id>/incomes", methods=["POST"])
def create_workshop_income(workshop_id):
    try:
        data = request.get_json() or {}
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("CREATE TABLE IF NOT EXISTS workshop_incomes (id SERIAL PRIMARY KEY, workshop_id INT NOT NULL)")
        for col_sql in [
            "ADD COLUMN IF NOT EXISTS booking_id INT",
            "ADD COLUMN IF NOT EXISTS receipt_id TEXT",
            "ADD COLUMN IF NOT EXISTS customer_name TEXT",
            "ADD COLUMN IF NOT EXISTS car TEXT",
            "ADD COLUMN IF NOT EXISTS service TEXT",
            "ADD COLUMN IF NOT EXISTS service_type TEXT",
            "ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Card'",
            "ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'paid'",
            "ADD COLUMN IF NOT EXISTS payment_date DATE DEFAULT CURRENT_DATE",
            "ADD COLUMN IF NOT EXISTS tax NUMERIC DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS description TEXT",
            "ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
        ]:
            cur.execute(f"ALTER TABLE workshop_incomes {col_sql}")
        # This is the fix - drop NOT NULL so old rows / future inserts never fail again
        cur.execute("ALTER TABLE workshop_incomes ALTER COLUMN receipt_id DROP NOT NULL")
        conn.commit()

        booking_id = data.get("booking_id")
        if booking_id:
            try: booking_id = int(booking_id)
            except: booking_id = None
            if booking_id:
                cur.execute("SELECT id FROM bookings WHERE id=%s", (booking_id,))
                if not cur.fetchone():
                    booking_id = None

        # Always generate receipt_id
        receipt_id = data.get("receipt_id") or f"RCPT-WK-{workshop_id}-{int(time.time())}"

        cur.execute("""
            INSERT INTO workshop_incomes
            (workshop_id, booking_id, receipt_id, customer_name, car, service, service_type, amount, payment_method, status, payment_date, tax, discount, description)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
        """, (
            workshop_id, booking_id, receipt_id,
            data.get("customer_name") or data.get("customer"),
            data.get("car"),
            data.get("service") or data.get("service_type"),
            data.get("service_type") or data.get("service"),
            float(data.get("amount") or 0),
            data.get("payment_method") or data.get("method") or "Card",
            (data.get("status") or "paid").lower(),
            data.get("payment_date") or data.get("date") or None,
            float(data.get("tax") or 0),
            float(data.get("discount") or 0),
            data.get("description") or data.get("service"),
        ))
        row = cur.fetchone()
        conn.commit()
        cur.close(); conn.close()
        for k in ["amount","tax","discount"]:
            if row.get(k) is not None: row[k] = float(row[k])
        if row.get("payment_date"): row["payment_date"] = str(row["payment_date"])
        return jsonify({"success": True, "income": row}), 201
    except Exception as e:
        print("POST workshop income error:", e)
        return jsonify({"error": str(e)}), 500

@finance_bp.route("/workshops/incomes/<int:income_id>/status", methods=["PUT"])
def update_workshop_income_status(income_id):
    try:
        data = request.get_json() or {}
        status = (data.get("status") or "paid").lower()
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE workshop_incomes SET status=%s WHERE id=%s", (status, income_id))
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Fallback generic endpoints the frontend also tries
@finance_bp.route("/incomes", methods=["GET"])
def get_incomes_fallback():
    wid = request.args.get("workshop_id")
    if wid:
        return get_workshop_incomes(int(wid))
    return jsonify([]), 200


@finance_bp.route("/incomes", methods=["POST"])
def create_income_fallback():
    data = request.get_json() or {}
    wid = data.get("workshop_id")
    if not wid:
        return jsonify({"error": "workshop_id missing"}), 400
    return create_workshop_income(int(wid))



import time

@finance_bp.route("/workshops/<int:workshop_id>/expenses", methods=["GET"])
def get_workshop_expenses(workshop_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("CREATE TABLE IF NOT EXISTS workshop_expenses (id SERIAL PRIMARY KEY, workshop_id INT NOT NULL)")
        for col_sql in [
            "ADD COLUMN IF NOT EXISTS booking_id INT",
            "ADD COLUMN IF NOT EXISTS receipt_id TEXT",
            "ADD COLUMN IF NOT EXISTS audit_id TEXT",
            "ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Other'",
            "ADD COLUMN IF NOT EXISTS description TEXT",
            "ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS vendor TEXT",
            "ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Card'",
            "ADD COLUMN IF NOT EXISTS mechanic TEXT",
            "ADD COLUMN IF NOT EXISTS expense_date DATE DEFAULT CURRENT_DATE",
            "ADD COLUMN IF NOT EXISTS bar TEXT DEFAULT 'ARD 284719'",
            "ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
        ]:
            cur.execute(f"ALTER TABLE workshop_expenses {col_sql}")
        cur.execute("ALTER TABLE workshop_expenses ALTER COLUMN receipt_id DROP NOT NULL")
        cur.execute("ALTER TABLE workshop_expenses ALTER COLUMN audit_id DROP NOT NULL")
        conn.commit()
        cur.execute("SELECT * FROM workshop_expenses WHERE workshop_id=%s ORDER BY expense_date DESC, id DESC LIMIT 200", (workshop_id,))
        rows = cur.fetchall()
        cur.close(); conn.close()
        for r in rows:
            for k in ["amount"]:
                if r.get(k) is not None: r[k] = float(r[k])
            if r.get("expense_date"): r["expense_date"] = str(r["expense_date"])
            if r.get("created_at"): r["created_at"] = str(r["created_at"])
        return jsonify(rows)
    except Exception as e:
        print("GET workshop expenses error:", e)
        return jsonify({"error": str(e)}), 500

@finance_bp.route("/workshops/<int:workshop_id>/expenses", methods=["POST"])
def create_workshop_expense(workshop_id):
    try:
        data = request.get_json() or {}
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("CREATE TABLE IF NOT EXISTS workshop_expenses (id SERIAL PRIMARY KEY, workshop_id INT NOT NULL)")
        for col_sql in [
            "ADD COLUMN IF NOT EXISTS booking_id INT",
            "ADD COLUMN IF NOT EXISTS receipt_id TEXT",
            "ADD COLUMN IF NOT EXISTS audit_id TEXT",
            "ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Other'",
            "ADD COLUMN IF NOT EXISTS description TEXT",
            "ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0",
            "ADD COLUMN IF NOT EXISTS vendor TEXT",
            "ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Card'",
            "ADD COLUMN IF NOT EXISTS mechanic TEXT",
            "ADD COLUMN IF NOT EXISTS expense_date DATE DEFAULT CURRENT_DATE",
            "ADD COLUMN IF NOT EXISTS bar TEXT DEFAULT 'ARD 284719'",
            "ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
        ]:
            cur.execute(f"ALTER TABLE workshop_expenses {col_sql}")
        cur.execute("ALTER TABLE workshop_expenses ALTER COLUMN receipt_id DROP NOT NULL")
        cur.execute("ALTER TABLE workshop_expenses ALTER COLUMN audit_id DROP NOT NULL")
        conn.commit()

        booking_id = data.get("booking_id")
        if booking_id:
            try: booking_id = int(str(booking_id).replace("#AV-","").replace("AV-",""))
            except: booking_id = None
            if booking_id:
                cur.execute("SELECT id FROM bookings WHERE id=%s", (booking_id,))
                if not cur.fetchone(): booking_id = None

        ts = int(time.time())
        receipt_id = data.get("receipt_id") or f"RCPT-EXP-{workshop_id}-{ts}"
        # Audit ID: AUD-YYYY-XXXX - count existing + 1
        cur.execute("SELECT COUNT(*) as c FROM workshop_expenses WHERE workshop_id=%s", (workshop_id,))
        cnt = (cur.fetchone() or {}).get("c", 0) + 1
        audit_id = data.get("audit_id") or f"AUD-{time.strftime('%Y')}-{str(cnt).zfill(4)}"

        cur.execute("""
            INSERT INTO workshop_expenses
            (workshop_id, booking_id, receipt_id, audit_id, category, description, amount, vendor, payment_method, mechanic, expense_date, bar)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
        """, (
            workshop_id, booking_id, receipt_id, audit_id,
            data.get("category") or "Other",
            data.get("description") or data.get("desc") or "",
            float(data.get("amount") or 0),
            data.get("vendor") or "General",
            data.get("payment_method") or data.get("method") or "Card",
            data.get("mechanic") or "-",
            data.get("expense_date") or data.get("date") or None,
            data.get("bar") or "ARD 284719",
        ))
        row = cur.fetchone()
        conn.commit()
        cur.close(); conn.close()
        if row.get("amount") is not None: row["amount"] = float(row["amount"])
        if row.get("expense_date"): row["expense_date"] = str(row["expense_date"])
        return jsonify({"success": True, "expense": row}), 201
    except Exception as e:
        print("POST workshop expense error:", e)
        return jsonify({"error": str(e)}), 500

@finance_bp.route("/expenses", methods=["GET", "POST"])
def expenses_fallback():
    # fallback for /api/expenses?workshop_id=...
    if request.method == "GET":
        wid = request.args.get("workshop_id")
        if not wid: return jsonify({"error": "workshop_id missing"}), 400
        return get_workshop_expenses(int(wid))
    data = request.get_json() or {}
    wid = data.get("workshop_id")
    if not wid: return jsonify({"error": "workshop_id missing"}), 400
    return create_workshop_expense(int(wid))


@finance_bp.route("/workshops/<int:workshop_id>/bookkeeping", methods=["GET"])
def get_workshop_bookkeeping(workshop_id):
    try:
        from datetime import datetime, date
        period = request.args.get("period", "All")
        from_q = request.args.get("from") or request.args.get("from_date")
        to_q = request.args.get("to") or request.args.get("to_date")
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # ensure tables exist (same as incomes/expenses endpoints)
        cur.execute("CREATE TABLE IF NOT EXISTS workshop_incomes (id SERIAL PRIMARY KEY, workshop_id INT NOT NULL)")
        cur.execute("CREATE TABLE IF NOT EXISTS workshop_expenses (id SERIAL PRIMARY KEY, workshop_id INT NOT NULL)")
        cur.execute("SELECT * FROM workshop_incomes WHERE workshop_id=%s ORDER BY payment_date DESC, id DESC", (workshop_id,))
        incomes = cur.fetchall()
        cur.execute("SELECT * FROM workshop_expenses WHERE workshop_id=%s ORDER BY expense_date DESC, id DESC", (workshop_id,))
        expenses = cur.fetchall()
        cur.close(); conn.close()

        def in_range(d):
            if not d: return True
            ds = str(d)[:10]
            now = datetime.now()
            if period == "Today": return ds == now.strftime("%Y-%m-%d")
            if period == "This Week": return datetime.fromisoformat(ds) >= datetime.fromtimestamp(now.timestamp()-7*86400)
            if period == "This Month": return ds[:7] == now.strftime("%Y-%m")
            if period == "Custom" and from_q and to_q: return from_q <= ds <= to_q
            if from_q and to_q: return from_q <= ds <= to_q
            return True

        paid = [r for r in incomes if str(r.get("status","")).lower() in ("paid","completed","success") and in_range(r.get("payment_date") or r.get("date") or r.get("created_at"))]
        pending = [r for r in incomes if str(r.get("status","")).lower() in ("pending","awaiting","unpaid") and in_range(r.get("payment_date") or r.get("date") or r.get("created_at"))]
        exps = [r for r in expenses if in_range(r.get("expense_date") or r.get("date") or r.get("created_at"))]

        revenue = sum(float(r.get("amount") or 0) for r in paid)
        pending_amt = sum(float(r.get("amount") or 0) for r in pending)
        total_exp = sum(float(r.get("amount") or 0) for r in exps)
        net = revenue - total_exp
        margin = round((net/revenue*100),1) if revenue else 0

        by_service = {}
        for r in paid:
            k = r.get("service_type") or r.get("service") or r.get("description") or "General Repair"
            by_service[k] = by_service.get(k,0)+float(r.get("amount") or 0)
        by_category = {}
        for r in exps:
            k = r.get("category") or "Other"
            by_category[k] = by_category.get(k,0)+float(r.get("amount") or 0)

        monthly = {}
        for r in paid:
            m = str(r.get("payment_date") or r.get("date") or "")[:7]
            if not m: continue
            monthly.setdefault(m, {"rev":0,"exp":0})
            monthly[m]["rev"] += float(r.get("amount") or 0)
        for r in exps:
            m = str(r.get("expense_date") or r.get("date") or "")[:7]
            if not m: continue
            monthly.setdefault(m, {"rev":0,"exp":0})
            monthly[m]["exp"] += float(r.get("amount") or 0)
        monthly_list = [{"month":k, "rev":v["rev"], "exp":v["exp"], "net":v["rev"]-v["exp"]} for k,v in sorted(monthly.items())]

        ledger = []
        for r in incomes:
            if not in_range(r.get("payment_date") or r.get("date") or r.get("created_at")): continue
            ledger.append({"date": str(r.get("payment_date") or r.get("date") or r.get("created_at") or "")[:10], "type":"INCOME", "id": f"#PAY-{r.get('id')}", "desc": f"{r.get('service_type') or r.get('service') or ''} • {r.get('customer_name') or ''} • #{'AV-'+str(r.get('booking_id')) if r.get('booking_id') else ''}", "amount": float(r.get("amount") or 0), "method": r.get("payment_method") or "Card", "status": str(r.get("status") or "").capitalize()})
        for r in exps:
            ledger.append({"date": str(r.get("expense_date") or r.get("date") or "")[:10], "type":"EXPENSE", "id": f"#EXP-{r.get('id')}", "desc": f"{r.get('category') or ''} • {r.get('description') or ''} • {r.get('vendor') or ''}", "amount": -float(r.get("amount") or 0), "method":"Cost", "status":"Locked"})
        ledger.sort(key=lambda x: x["date"], reverse=True)

        return jsonify({"revenue": revenue, "pending": pending_amt, "totalExpenses": total_exp, "net": net, "margin": margin, "byService": sorted(by_service.items(), key=lambda x:-x[1]), "byCategory": sorted(by_category.items(), key=lambda x:-x[1]), "monthly": monthly_list, "ledger": ledger, "paidCount": len(paid), "expenseCount": len(exps)})
    except Exception as e:
        print("GET bookkeeping error:", e)
        return jsonify({"error": str(e)}), 500