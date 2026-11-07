import psycopg2, psycopg2.extras, os, uuid
from flask import request
from config import DB_CONFIG

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

def dict_cursor(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

def log_activity(actor, role, activity_type, workshop_id=None, owner_id=None, description="", ip=None, device=None, status="Success", session_id=None):
    try:
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""
            INSERT INTO activity_logs (actor, actor_role, activity_type, workshop_id, owner_id, description, ip_address, device, status, session_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (actor, role, activity_type, workshop_id, owner_id, description, ip or request.remote_addr, device or request.headers.get('User-Agent',''), status, session_id or str(uuid.uuid4())[:8]))
        conn.commit(); cur.close(); conn.close()
    except Exception as e:
        print("log error", e)

def init_db():
    from werkzeug.security import generate_password_hash
    conn = get_db_connection(); cur = conn.cursor()
    with open(os.path.join(os.path.dirname(__file__), 'schema.sql'), 'r') as f:
        cur.execute(f.read())
    cur.execute("SELECT id FROM admin_users WHERE email=%s", ("admin@autoville.la",))
    if not cur.fetchone():
        cur.execute("INSERT INTO admin_users (full_name,email,password_hash,pin_hash) VALUES (%s,%s,%s,%s)",
                    ("Ayinde Admin","admin@autoville.la", generate_password_hash("admin123"), generate_password_hash("1234")))
    conn.commit(); cur.close(); conn.close()
    print("DB initialized - AutoVille • 112 S Market St Inglewood CA 90301 PST")