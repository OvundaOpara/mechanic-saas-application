from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from db import get_db_connection, dict_cursor, log_activity
from datetime import date, timedelta
import uuid

auth_bp = Blueprint("auth", __name__)

# ---------- TRIAL HELPER - uses SAME connection, no ALTER TABLE, no 2nd connection ----------
def _create_trial(cur, conn, workshop_id, email):
    """Create 7-day trial + receipt. Returns sub dict or None. Never raises, never blocks register/login."""
    try:
        cur.execute("SELECT * FROM subscriptions WHERE workshop_id=%s ORDER BY id DESC LIMIT 1", (workshop_id,))
        existing = cur.fetchone()
        if existing:
            for k in ["start_date", "end_date"]:
                if existing.get(k):
                    existing[k] = str(existing[k])[:10]
            try:
                existing["amount"] = float(existing.get("amount") or 0)
            except:
                pass
            return existing

        start = date.today()
        end = start + timedelta(days=7)  # 7 days, not 14
        sub = None
        # Try full columns first, fallback to minimal if billing_email / payment_method do not exist yet
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

        conn.commit()  # commit subscription BEFORE receipt, so receipt failure cannot kill it

        # Receipt - separate transaction, non-fatal
        try:
            receipt_no = f"RCPT-{sub['id']}-TRIAL"
            tx = f"TX-{uuid.uuid4().hex[:8].upper()}"
            cur.execute(
                """INSERT INTO subscription_receipts (subscription_id, workshop_id, receipt_number, transaction_id, plan, amount, payment_method, status, period, receipt_date, next_billing_date)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (sub["id"], workshop_id, receipt_no, tx, "1 Week Free Trial", 0, "Free Trial", "Paid", f"{start} to {end}", start, end)
            )
            conn.commit()
        except Exception as re:
            print("Trial receipt failed (non-fatal, subscription still saved):", re)
            try:
                conn.rollback()
            except:
                pass

        for k in ["start_date", "end_date"]:
            if sub.get(k):
                sub[k] = str(sub[k])[:10]
        try:
            sub["amount"] = float(sub.get("amount") or 0)
        except:
            pass
        print(f"TRIAL CREATED: workshop_id={workshop_id} {start} -> {end}")
        return sub
    except Exception as e:
        try:
            conn.rollback()
        except:
            pass
        print("TRIAL CREATE FAILED (workshop still saved):", e)
        return None

# ---------------- OWNER ----------------
@auth_bp.route("/register/owner", methods=["POST"])
def register_owner():
    d = request.json or {}
    full_name = (d.get("full_name") or "").strip()
    email = (d.get("email") or "").strip().lower()
    phone = (d.get("phone") or d.get("whatsapp") or "").strip()
    password = (d.get("password") or "").strip()
    if not full_name or not email or not password:
        return jsonify({"success": False, "error": "Full name, email and password are required"}), 400
    if len(password) < 6:
        return jsonify({"success": False, "error": "Password must be at least 6 characters"}), 400
    conn = get_db_connection(); cur = dict_cursor(conn)
    try:
        cur.execute("SELECT id FROM vehicle_owners WHERE LOWER(email)=%s", (email,))
        if cur.fetchone():
            return jsonify({"success": False, "error": "This email is already registered. Please login."}), 409
        cur.execute(
            "INSERT INTO vehicle_owners (full_name, email, phone, password_hash, status, created_at) VALUES (%s,%s,%s,%s,'active',NOW()) RETURNING id, full_name, email, phone",
            (full_name, email, phone, generate_password_hash(password))
        )
        user = cur.fetchone()
        conn.commit()
        try:
            log_activity(email, "Owner", "Register", description=f"Owner registered - {full_name} - Inglewood CA")
        except:
            pass
        return jsonify({"success": True, "user": {"id": user["id"], "role": "owner", "full_name": user["full_name"], "email": user["email"], "phone": user["phone"]}}), 201
    except Exception as e:
        conn.rollback()
        print("REGISTER OWNER ERROR:", e)
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cur.close(); conn.close()

@auth_bp.route("/login/owner", methods=["POST"])
def login_owner():
    d = request.json or {}
    email = (d.get("email") or "").strip().lower()
    password = (d.get("password") or "").strip()
    if not email or not password:
        return jsonify({"success": False, "error": "Email and password are required"}), 400
    conn = get_db_connection(); cur = dict_cursor(conn)
    try:
        cur.execute("SELECT * FROM vehicle_owners WHERE LOWER(email)=%s LIMIT 1", (email,))
        user = cur.fetchone()
        if not user or not check_password_hash(user.get("password_hash") or "", password):
            try:
                log_activity(email, "Owner", "Login Failed", description=f"Failed owner login - {email}")
            except:
                pass
            return jsonify({"success": False, "error": "Invalid email or password"}), 401
        if (user.get("status") or "active").lower() in ("suspended", "deactivated", "blocked"):
            return jsonify({"success": False, "error": "Account is suspended. Contact AutoVille support."}), 403
        try:
            log_activity(user["email"], "Owner", "Login", description=f"Owner login - {user.get('full_name')} - IP {request.remote_addr}")
        except:
            pass
        return jsonify({"success": True, "user": {"id": user["id"], "role": "owner", "full_name": user.get("full_name"), "email": user.get("email"), "phone": user.get("phone"), "status": user.get("status")}}), 200
    finally:
        cur.close(); conn.close()

# ---------------- WORKSHOP ----------------
@auth_bp.route("/register/workshop", methods=["POST"])
def register_workshop():
    # Self-contained: no change needed to imports at top of auth.py
    from datetime import date, timedelta
    import uuid

    d = request.json or {}
    business_name = (d.get("business_name") or d.get("workshop_name") or d.get("name") or "").strip()
    email = (d.get("email") or "").strip().lower()
    phone = (d.get("phone") or d.get("whatsapp") or "").strip()
    address = (d.get("address") or d.get("shop_address") or "").strip()
    password = (d.get("password") or "").strip()
    if not business_name or not email or not password:
        return jsonify({"success": False, "error": "Business name, email and password are required"}), 400
    if len(password) < 6:
        return jsonify({"success": False, "error": "Password must be at least 6 characters"}), 400

    conn = get_db_connection(); cur = dict_cursor(conn)
    try:
        cur.execute("SELECT id FROM workshops WHERE LOWER(email)=%s", (email,))
        if cur.fetchone():
            return jsonify({"success": False, "error": "This email is already registered. Please login."}), 409

        # 1. Workshop - DO NOT COMMIT YET
        cur.execute(
            """INSERT INTO workshops (business_name, name, email, phone, address, password_hash, status, verified, created_at)
               VALUES (%s,%s,%s,%s,%s,%s,'active',TRUE,NOW())
               RETURNING id, business_name, name, email, phone, address, verified, status""",
            (business_name, business_name, email, phone, address, generate_password_hash(password))
        )
        w = cur.fetchone()
        if not w:
            raise Exception("Workshop insert returned no row")

        # 2. Subscription - SAME TRANSACTION
        # FIX: 'trial' and 'trialing' both violate your check constraint.
        # Postgres CHECK is case-sensitive. Try variants until DB accepts one.
        # Order: 'Active' / 'active' (most common) -> 'Trial' -> 'trialing' -> 'trial'
        start = date.today()
        end = start + timedelta(days=7)  # 7-day free plan
        sub = None
        used_status = None
        last_err = None
        for cand in ["Active", "active", "Trial", "trialing", "trial"]:
            cur.execute("SAVEPOINT trial_try")
            try:
                cur.execute(
                    """INSERT INTO subscriptions (workshop_id, plan, status, start_date, end_date, amount, auto_renew, billing_email, payment_method, created_at)
                       VALUES (%s,'Trial',%s,%s,%s,0,FALSE,%s,'Free Trial',NOW()) RETURNING *""",
                    (w["id"], cand, start, end, email)
                )
                sub = cur.fetchone()
                cur.execute("RELEASE SAVEPOINT trial_try")
                used_status = cand
                print(f"Subscription status accepted: {cand}")
                break
            except Exception as e:
                print(f"Status '{cand}' rejected: {e}")
                last_err = e
                cur.execute("ROLLBACK TO SAVEPOINT trial_try")
                cur.execute("RELEASE SAVEPOINT trial_try")
                # Try minimal columns with same status (in case billing_email/payment_method missing)
                cur.execute("SAVEPOINT trial_try_min")
                try:
                    cur.execute(
                        """INSERT INTO subscriptions (workshop_id, plan, status, start_date, end_date, amount, auto_renew, created_at)
                           VALUES (%s,'Trial',%s,%s,%s,0,FALSE,NOW()) RETURNING *""",
                        (w["id"], cand, start, end)
                    )
                    sub = cur.fetchone()
                    cur.execute("RELEASE SAVEPOINT trial_try_min")
                    used_status = cand
                    print(f"Subscription status accepted (minimal): {cand}")
                    break
                except Exception as e2:
                    print(f"Status '{cand}' minimal also rejected: {e2}")
                    last_err = e2
                    cur.execute("ROLLBACK TO SAVEPOINT trial_try_min")
                    cur.execute("RELEASE SAVEPOINT trial_try_min")
                    continue
        if not sub:
            # No status accepted -> raise -> outer rollback -> NO workshop row
            raise Exception(f"All subscription status values rejected by subscriptions_status_check. Last error: {last_err}")

        # 3. Receipt - SAME TRANSACTION, FATAL
        # If receipt fails, raise -> rollback workshops + subscriptions too.
        cur.execute("SAVEPOINT receipt_insert")
        try:
            cur.execute(
                """INSERT INTO subscription_receipts (subscription_id, workshop_id, receipt_number, transaction_id, plan, amount, payment_method, status, period, receipt_date, next_billing_date)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (sub["id"], w["id"], f"RCPT-{sub['id']}-TRIAL", f"TX-{uuid.uuid4().hex[:8].upper()}", "1 Week Free Trial", 0, "Free Trial", "Paid", f"{start} to {end}", start, end)
            )
            cur.execute("RELEASE SAVEPOINT receipt_insert")
        except Exception as re:
            print("Receipt full insert failed, retry minimal receipt:", re)
            cur.execute("ROLLBACK TO SAVEPOINT receipt_insert")
            cur.execute("RELEASE SAVEPOINT receipt_insert")
            # Minimal receipt - if THIS fails, raise -> rollback ALL 3 tables
            cur.execute(
                """INSERT INTO subscription_receipts (subscription_id, workshop_id, receipt_number, plan, amount, status)
                   VALUES (%s,%s,%s,%s,%s,%s)""",
                (sub["id"], w["id"], f"RCPT-{sub['id']}-TRIAL", "1 Week Free Trial", 0, "Paid")
            )

        # 4. Single commit ONLY if workshops + subscriptions + subscription_receipts ALL succeeded
        conn.commit()
        print(f"WORKSHOP REGISTERED + TRIAL + RECEIPT: id={w['id']} email={w['email']} verified={w['verified']} sub_id={sub['id']} status={used_status} {start} -> {end}")

        try:
            log_activity(email, "Workshop", "Register", description=f"Workshop registered - {business_name} - Auto-verified + One Week Free Trial started")
        except:
            pass
        return jsonify({"success": True, "user": {
            "id": w["id"], "role": "mechanic", "rawRole": "workshop",
            "business_name": w["business_name"] or w["name"], "name": w["name"],
            "email": w["email"], "phone": w.get("phone"), "address": w.get("address"),
            "verified": True, "status": "active",
            "plan": "Trial", "subscription_status": str(used_status).lower(),
            "subscription_end": str(sub.get("end_date") or "")[:10]
        }, "subscription": {
            "id": sub["id"], "workshop_id": w["id"], "plan": "Trial", "status": used_status,
            "start_date": str(sub.get("start_date") or "")[:10], "end_date": str(sub.get("end_date") or "")[:10],
            "amount": 0, "auto_renew": False, "billing_email": email, "payment_method": "Free Trial"
        }}), 201
    except Exception as e:
        # ATOMIC: any failure rolls back ALL 3 tables - no orphan workshop
        try:
            conn.rollback()
        except:
            pass
        print("REGISTER WORKSHOP ERROR - ALL ROLLED BACK, NO WORKSHOP ROW:", e)
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        cur.close(); conn.close()

@auth_bp.route("/login/workshop", methods=["POST"])
def login_workshop():
    d = request.json or {}
    email = (d.get("email") or "").strip().lower()
    password = (d.get("password") or "").strip()
    if not email or not password:
        return jsonify({"success": False, "error": "Email and password are required"}), 400
    conn = get_db_connection(); cur = dict_cursor(conn)
    try:
        cur.execute("SELECT * FROM workshops WHERE LOWER(email)=%s LIMIT 1", (email,))
        w = cur.fetchone()
        if not w:
            print(f"LOGIN FAIL: no workshop found for '{email}'")
            return jsonify({"success": False, "error": "Invalid email or password"}), 401
        if not check_password_hash(w.get("password_hash") or "", password):
            print(f"LOGIN FAIL: wrong password for workshop {w.get('id')} email={w.get('email')}")
            return jsonify({"success": False, "error": "Invalid email or password"}), 401
        if (w.get("status") or "active").lower() in ("suspended", "deactivated", "blocked"):
            return jsonify({"success": False, "error": "Workshop is suspended. Contact AutoVille support."}), 403
        # Fetch sub, backfill if missing - SAME connection
        sub = None
        try:
            cur.execute("SELECT * FROM subscriptions WHERE workshop_id=%s ORDER BY id DESC LIMIT 1", (w["id"],))
            sub = cur.fetchone()
            if sub:
                for k in ["start_date", "end_date"]:
                    if sub.get(k):
                        sub[k] = str(sub[k])[:10]
                try:
                    sub["amount"] = float(sub.get("amount") or 0)
                except:
                    pass
        except Exception as e:
            print("fetch sub failed:", e)
            try:
                conn.rollback()
            except:
                pass
        if not sub:
            print(f"BACKFILL: workshop {w['id']} has no subscription - creating 7-day trial on login")
            sub = _create_trial(cur, conn, w["id"], w.get("email"))
        try:
            log_activity(w["email"], "Workshop", "Login", description=f"Workshop login - {w.get('business_name') or w.get('name')} - IP {request.remote_addr}")
        except:
            pass
        return jsonify({"success": True, "user": {
            "id": w["id"], "role": "mechanic", "rawRole": "workshop",
            "business_name": w.get("business_name") or w.get("name"),
            "name": w.get("name") or w.get("business_name"),
            "email": w.get("email"), "phone": w.get("phone"), "address": w.get("address"),
            "verified": w.get("verified"), "status": w.get("status"),
            "plan": (sub or {}).get("plan") or "Trial",
            "subscription_status": (sub or {}).get("status") or "trial",
            "subscription_end": str((sub or {}).get("end_date") or "")
        }, "subscription": sub}), 200
    finally:
        cur.close(); conn.close()

# ---------------- FORGOT / LOGOUT ----------------
@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    d = request.json or {}
    email = (d.get("email") or "").strip().lower()
    if email:
        try:
            log_activity(email, "Owner", "Password Reset Requested", description=f"Forgot password - {email} - role {d.get('role')}")
        except:
            pass
    return jsonify({"success": True, "message": "If email exists, reset link sent"})

@auth_bp.route("/logout/workshop", methods=["POST"])
def logout_workshop():
    d = request.json or {}
    try:
        log_activity(d.get("email", ""), "Workshop", "Logout", description=f"Workshop logout - {d.get('email')}")
    except:
        pass
    return jsonify({"success": True, "message": "Logged out"})

@auth_bp.route("/logout", methods=["POST"])
def logout_any():
    try:
        d = request.get_json(silent=True) or {}
        # log if you have log_activity, else just return success
        return jsonify({"success": True, "message": "Logged out"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500