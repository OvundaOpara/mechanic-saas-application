from flask import Blueprint, request, jsonify
from db import get_db_connection, dict_cursor
from datetime import datetime, date
from collections import defaultdict
import calendar

analytics_bp = Blueprint("analytics", __name__)

def _month_key(d):
    if not d: return None
    if isinstance(d, str):
        try: d = datetime.fromisoformat(d.replace("Z","").split("T")[0]).date()
        except: return None
    if isinstance(d, datetime): d = d.date()
    return (d.year, d.month)

def _last_months(n):
    today = date.today()
    out = []
    y, m = today.year, today.month
    for i in range(n-1, -1, -1):
        mm = m - i
        yy = y
        while mm <= 0:
            mm += 12; yy -= 1
        out.append((yy, mm))
    return out

@analytics_bp.route("/admin/analytics", methods=["GET"])
def admin_analytics():
    rng = request.args.get("range", "6M")
    n = {"1M":1, "3M":3, "6M":6, "1Y":12}.get(rng, 6)
    months = _last_months(n)

    conn = get_db_connection(); cur = dict_cursor(conn)
    cur.execute("SELECT * FROM bookings"); bookings = cur.fetchall()
    cur.execute("SELECT * FROM admin_incomes"); incomes = cur.fetchall()
    cur.execute("SELECT * FROM admin_expenditures"); exps = cur.fetchall()
    cur.execute("SELECT * FROM vehicle_owners"); owners = cur.fetchall()
    cur.execute("SELECT * FROM workshops"); workshops = cur.fetchall()
    cur.execute("SELECT * FROM reviews"); reviews = cur.fetchall()
    cur.execute("SELECT * FROM subscriptions"); subs = cur.fetchall()
    cur.close(); conn.close()

    # Monthly buckets
    monthly = []
    for (yy, mm) in months:
        label = calendar.month_abbr[mm]
        b = sum(1 for x in bookings if _month_key(x.get("created_at") or x.get("date")) == (yy, mm))
        inc = sum(float(x.get("amount") or 0) for x in incomes if _month_key(x.get("date") or x.get("created_at")) == (yy, mm))
        ex = sum(float(x.get("amount") or 0) for x in exps if _month_key(x.get("date") or x.get("created_at")) == (yy, mm))
        ow = sum(1 for x in owners if _month_key(x.get("created_at")) == (yy, mm))
        ws = sum(1 for x in workshops if _month_key(x.get("created_at")) == (yy, mm))
        monthly.append({"month": label, "year": yy, "bookings": b, "income": int(inc), "exp": int(ex), "owners": ow, "workshops": ws})

    totalBookings = len(bookings)
    totalIncome = int(sum(float(x.get("amount") or 0) for x in incomes))
    totalExp = int(sum(float(x.get("amount") or 0) for x in exps))
    totalProfit = totalIncome - totalExp
    totalOwners = len(owners)
    totalWorkshops = len(workshops)

    # MRR: Monthly $40 + Quarterly $100/3 + Annual $300/12, only active/trial
    mrr = 0
    for s in subs:
        if str(s.get("status","")).lower() not in ["active","trial","paid"]: continue
        p = str(s.get("plan","Monthly"))
        if p == "Monthly": mrr += 40
        elif p == "Quarterly": mrr += 100/3
        elif p == "Annual": mrr += 300/12
    mrr = int(round(mrr))

    # Avg rating
    avgRating = round(sum(float(r.get("rating") or 0) for r in reviews)/len(reviews), 1) if reviews else 0

    # Top workshops by bookings
    by_ws = defaultdict(lambda: {"bookings":0, "revenue":0, "ratings":[]})
    ws_map = {w["id"]: w for w in workshops}
    for b in bookings:
        wid = b.get("workshop_id")
        if wid: by_ws[wid]["bookings"] += 1
    for inc in incomes:
        wid = inc.get("workshop_id")
        if wid: by_ws[wid]["revenue"] += float(inc.get("amount") or 0)
    for r in reviews:
        wid = r.get("workshop_id")
        if wid: by_ws[wid]["ratings"].append(float(r.get("rating") or 0))

    logos = {
        "Elite Garage Inglewood":"https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=100&q=80",
        "Sunset Auto Care":"https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&w=100&q=80",
        "Culver City Motors":"https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?auto=format&fit=crop&w=100&q=80",
        "Torrance Auto Pro":"https://images.unsplash.com/photo-1551524559-8af4e6624178?auto=format&fit=crop&w=100&q=80",
        "Beverly Hills Auto Spa":"https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?auto=format&fit=crop&w=100&q=80",
    }
    top = []
    for wid, v in sorted(by_ws.items(), key=lambda kv: kv[1]["bookings"], reverse=True)[:5]:
        w = ws_map.get(wid, {})
        name = w.get("name", f"Workshop {wid}")
        top.append({
            "name": name,
            "bookings": v["bookings"],
            "rating": round(sum(v["ratings"])/len(v["ratings"]),1) if v["ratings"] else 0,
            "revenue": int(v["revenue"]),
            "bar": w.get("bar_license") or w.get("bar") or "ARD 284719",
            "logo": w.get("logo_url") or logos.get(name, logos["Elite Garage Inglewood"])
        })

    # Growth % bookings last month vs prev month
    growth = 0
    if len(monthly) >= 2 and monthly[-2]["bookings"] > 0:
        growth = round((monthly[-1]["bookings"] - monthly[-2]["bookings"]) / monthly[-2]["bookings"] * 100, 1)

    return jsonify({
        "monthly": monthly,
        "totals": {"bookings": totalBookings, "income": totalIncome, "exp": totalExp, "profit": totalProfit, "owners": totalOwners, "workshops": totalWorkshops, "mrr": mrr, "avgRating": avgRating, "growth": growth},
        "topWorkshops": top,
    })