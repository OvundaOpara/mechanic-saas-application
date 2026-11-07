import { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";

const API = "http://127.0.0.1:5000/api";
const FALLBACK_IMG = "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=400&q=80";

function getOwnerId() {
  try {
    const raw = localStorage.getItem("autoville_user") || localStorage.getItem("autoville_owner") || "{}";
    const u = JSON.parse(raw);
    return u.id || u.owner_id || u.user_id || u.ownerId || null;
  } catch { return null; }
}
function fmtTime(v) {
  if (!v) return "—";
  const s = String(v).trim();
  if (/AM|PM/i.test(s)) return s;
  // "14:30:00" or "2026-11-06T14:30:00"
  const d = new Date(s.includes("T") ? s : `2000-01-01T${s}`);
  if (!isNaN(d)) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return s;
}
function fmtDate(v) {
  if (!v) return "";
  return String(v).slice(0, 10);
}

export default function OwnerTrackingPage({ C, isDark, onBack, bookingId, booking: bookingProp }) {
  const [now, setNow] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [selectedId, setSelectedId] = useState(bookingId || bookingProp?.id || bookingProp?._dbId || null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Sync if parent passes a new booking
  useEffect(() => {
    const id = bookingId || bookingProp?.id || bookingProp?._dbId;
    if (id) setSelectedId(id);
    if (bookingProp && !bookingId) setBookings((p) => p.length ? p : [bookingProp]);
  }, [bookingId, bookingProp]);

  const loadBookings = async () => {
    const ownerId = getOwnerId();
    if (!ownerId && !bookingProp) { setError("Please log in again to track your job."); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      let list = [];
      if (bookingProp) list = [bookingProp];
      else {
        const res = await fetch(`${API}/bookings?owner_id=${ownerId}&limit=200`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
        list = Array.isArray(data) ? data : (data.bookings || data.data || []);
      }
      setBookings(list);
      // Auto-pick: In Progress first, then Upcoming/Pending, then latest
      if (!selectedId && list.length) {
        const norm = (s) => String(s || "").toLowerCase();
        const inProg = list.find(b => norm(b.status).includes("progress") || norm(b.status) === "in_progress");
        const upcoming = list.find(b => ["pending", "confirmed", "upcoming", "scheduled"].includes(norm(b.status)));
        const pick = inProg || upcoming || list[0];
        setSelectedId(pick.id);
      }
    } catch (e) {
      setError(e.message === "Failed to fetch" ? "Cannot reach backend at http://127.0.0.1:5000 — is 'py app.py' running?" : e.message);
    } finally { setLoading(false); }
  };

  const loadJob = async (bid) => {
    if (!bid) return;
    try {
      const res = await fetch(`${API}/bookings/jobs?booking_id=${bid}&limit=5`);
      const data = await res.json().catch(() => []);
      if (res.ok && Array.isArray(data) && data.length) setJob(data[0]);
      else setJob(null);
    } catch { setJob(null); }
  };

  useEffect(() => { loadBookings(); }, []);
  useEffect(() => { if (selectedId) loadJob(selectedId); }, [selectedId]);
  // Live poll every 30s
  useEffect(() => {
    if (!selectedId) return;
    const t = setInterval(() => loadJob(selectedId), 30000);
    return () => clearInterval(t);
  }, [selectedId]);

  const booking = useMemo(() => {
    if (!selectedId) return null;
    return bookings.find(b => String(b.id) === String(selectedId)) || bookingProp || null;
  }, [bookings, selectedId, bookingProp]);

  const progress = useMemo(() => {
    if (job?.progress != null) return Number(job.progress) || 0;
    const s = String(booking?.status || "").toLowerCase();
    if (s.includes("complete")) return 100;
    if (s.includes("progress")) return 50;
    if (["pending", "confirmed"].includes(s)) return 10;
    return 0;
  }, [job, booking]);

  const activeStep = useMemo(() => {
    if (progress >= 95 || String(booking?.status || "").toLowerCase() === "completed") return 5;
    if (progress >= 80) return 4;
    if (progress >= 50) return 3;
    if (progress >= 30) return 2;
    if (progress >= 15) return 1;
    return 0;
  }, [progress, booking]);

  const steps = useMemo(() => {
    if (!booking) return [];
    const car = [booking.car_make, booking.car_model].filter(Boolean).join(" ") || booking.vehicle || booking.car || "Your vehicle";
    const shop = booking.workshop_name || booking.shop || "Workshop";
    const addr = booking.workshop_address || booking.address || "";
    const mech = job?.mechanic || booking.mechanic || booking.mechanic_name || "Assigned technician";
    const updated = job?.updated_at ? fmtTime(job.updated_at) : "—";
    const bookTime = fmtTime(booking.booking_time || booking.time);
    return [
      { id: 0, title: "Booking Confirmed", time: bookTime, desc: `Job #AV-${booking.id} • ${car} • ${fmtDate(booking.booking_date)}`, icon: "bi-check2", done: activeStep > 0 },
      { id: 1, title: "Mechanic Assigned", time: activeStep >= 1 ? updated : "—", desc: `${mech} • ${shop} • ${booking.workshop_phone || ""}`.trim(), icon: "bi-person-check", done: activeStep > 1 },
      { id: 2, title: "Parts Ordered", time: activeStep >= 2 ? updated : "—", desc: booking.service_type ? `Parts for ${booking.service_type} • ${shop}` : `Parts ordered • ${shop}`, icon: "bi-box-seam", done: activeStep > 2 },
      { id: 3, title: "Work In Progress", time: activeStep === 3 ? `${updated} • LIVE` : (activeStep > 3 ? updated : "—"), desc: `${booking.service_type || "Service"} ongoing • ${addr}`, icon: "bi-tools", done: activeStep > 3, active: activeStep === 3 },
      { id: 4, title: "Quality Check", time: activeStep >= 4 ? updated : "—", desc: job?.remarks || "Road test + final inspection", icon: "bi-shield-check", done: activeStep > 4 },
      { id: 5, title: "Ready for Pickup", time: activeStep >= 5 ? updated : "—", desc: "Pay & pickup or request delivery", icon: "bi-car-front", done: activeStep >= 5 },
    ];
  }, [booking, job, activeStep]);

  const cardBg = C?.card || "#fff";
  const cardBorder = C?.cardBorder || "#E2E8F0";
  const text = C?.text || "#0A192F";
  const muted = C?.muted || "#6B7A90";
  const soft = C?.soft || "#F8FAFC";
  const total = booking ? Number(booking.amount ?? booking.price ?? 0) : 0;
  const shopName = booking?.workshop_name || booking?.shop || "—";
  const carLabel = booking ? ([booking.car_make, booking.car_model].filter(Boolean).join(" ") || booking.vehicle || booking.car || "—") : "—";
  const mechName = job?.mechanic || booking?.mechanic || "Assigned technician";
  const shopPhone = booking?.workshop_phone || booking?.phone || "";
  const shopAddr = booking?.workshop_address || booking?.address || "";

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: muted, fontWeight: 700 }}>Loading live tracking…</div>;
  if (error) return (
    <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#991B1B", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{error}</span>
      <button onClick={loadBookings} style={{ background: "#991B1B", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontWeight: 800, cursor: "pointer" }}>Retry</button>
    </div>
  );
  if (!booking) return <div style={{ padding: 40, textAlign: "center", color: muted, fontWeight: 700 }}>No appointment to track. Book from Workshops first.</div>;

  return (
    <>
      <style>{`
        .trk-head{ display:flex; justify-content:space-between; align-items:flex-end; gap:16px; margin-bottom:18px; flex-wrap:wrap; }
        .trk-head h1{ font-weight:900; font-size:32px; letter-spacing:-0.04em; line-height:0.92; margin:0; }
        .trk-head h1 span{ font-weight:600; font-size:14px; display:block; margin-top:6px; letter-spacing:-0.01em; }
        .live-badge{ display:inline-flex; align-items:center; gap:8px; background:#0A192F; color:#fff; border-radius:24px; padding:8px 14px; font-weight:800; font-size:11px; letter-spacing:0.06em; }
        .live-dot{ width:8px; height:8px; background:#22C55E; border-radius:50%; box-shadow:0 0 0 6px rgba(34,197,94,0.15); animation:pulse 1.5s infinite; }
        @keyframes pulse{ 0%{ box-shadow:0 0 0 0 rgba(34,197,94,0.4)} 70%{ box-shadow:0 0 0 10px rgba(34,197,94,0)} 100%{ box-shadow:0 0 0 0 rgba(34,197,94,0)} }
        .trk-grid{ display:grid; grid-template-columns:1.25fr 0.85fr; gap:16px; }
        @media(max-width: 991px){ .trk-grid{ grid-template-columns:1fr; } .trk-head h1{ font-size:26px; } }
        .map-card{ border-radius:24px; overflow:hidden; position:relative; min-height:520px; border:2px solid #0A192F; background:#fff; }
        .map-bg{ position:absolute; inset:0; background:url(https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1200&q=80) center/cover; filter:grayscale(0.2) contrast(1.05); }
        .map-overlay{ position:absolute; inset:0; background:linear-gradient(180deg, rgba(10,25,47,0.1), rgba(10,25,47,0.82)); }
        .map-top{ position:relative; z-index:2; display:flex; justify-content:space-between; padding:14px; gap:8px; flex-wrap:wrap; }
        .map-chip{ background:#fff; border:1.5px solid #0A192F; border-radius:14px; padding:9px 12px; font-weight:800; font-size:11px; display:flex; align-items:center; gap:6px; box-shadow:0 4px 12px rgba(0,0,0,0.12); }
        .map-center{ position:relative; z-index:2; height:340px; display:grid; place-items:center; }
        .route-line{ width:300px; height:4px; background:repeating-linear-gradient(90deg,#fff 0 14px, transparent 14px 22px); border-radius:4px; position:relative; }
        .shop-pin{ position:absolute; left:6%; top:50%; transform:translateY(-50%); background:#fff; border:2px solid #0A192F; border-radius:14px; padding:8px 10px; font-weight:900; font-size:11px; display:flex; align-items:center; gap:6px; }
        .car-pin{ position:absolute; left:64%; top:50%; transform:translate(-50%,-50%); background:#FFEB3B; border:2px solid #0A192F; width:54px; height:54px; border-radius:16px; display:grid; place-items:center; font-size:22px; box-shadow:0 10px 24px rgba(0,0,0,0.28); animation:carMove 3s ease-in-out infinite; }
        @keyframes carMove{ 0%,100%{ transform:translate(-50%,-50%) rotate(-2deg)} 50%{ transform:translate(-48%,-52%) rotate(2deg)} }
        .map-bottom{ position:relative; z-index:2; background:#fff; margin:0 12px 12px; border-radius:18px; border:1.5px solid #0A192F; padding:12px; display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center; }
        .mech{ display:flex; gap:12px; align-items:center; }
        .mech-avatar{ width:48px; height:48px; border-radius:14px; background:url(${booking.workshop_logo || FALLBACK_IMG}) center/cover; border:2px solid #0A192F; }
        .timeline-card{ background:#0A192F; color:#fff; border-radius:24px; padding:18px; border:2px solid #0A192F; position:relative; overflow:hidden; }
        .timeline-card::before{ content:""; position:absolute; top:-40%; right:-20%; width:320px; height:320px; background:radial-gradient(circle, rgba(255,235,59,0.18), transparent 70%); }
        .tl-item{ display:grid; grid-template-columns:42px 1fr; gap:12px; padding:12px 0; border-bottom:1px dashed rgba(255,255,255,0.12); position:relative; z-index:1; }
        .tl-item:last-child{ border-bottom:none; }
        .tl-icon{ width:42px; height:42px; border-radius:12px; display:grid; place-items:center; font-size:18px; border:1.5px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.06); color:#8FA0B8; }
        .tl-item.done .tl-icon{ background:#FFEB3B; color:#0A192F; border-color:#FFEB3B; }
        .tl-item.active .tl-icon{ background:#fff; color:#0A192F; animation:pop 0.8s infinite alternate; }
        @keyframes pop{ from{ transform:scale(1)} to{ transform:scale(1.08)} }
        .parts-card{ border-radius:20px; padding:14px; margin-top:12px; border:1.5px solid; }
        .part-row{ display:flex; justify-content:space-between; font-size:12.5px; font-weight:600; padding:9px 0; border-bottom:1px solid rgba(0,0,0,0.06); }
        .live-photos{ display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
        .live-photos div{ height:96px; border-radius:12px; background-size:cover; background-position:center; border:1.5px solid #0A192F; position:relative; }
      `}</style>

      {/* Booking picker */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: muted }}>TRACKING:</span>
        <select value={selectedId || ""} onChange={(e) => setSelectedId(e.target.value)} style={{ height: 40, borderRadius: 10, border: `1.5px solid ${cardBorder}`, background: cardBg, color: text, fontWeight: 700, padding: "0 10px", minWidth: 220 }}>
          {bookings.map(b => <option key={b.id} value={b.id}>#AV-{b.id} • {b.workshop_name || b.shop || "Workshop"} • {b.service_type || b.service} • {fmtDate(b.booking_date)}</option>)}
        </select>
        <button onClick={() => { if (selectedId) loadJob(selectedId); }} style={{ height: 40, borderRadius: 10, border: `1.5px solid ${cardBorder}`, background: soft, color: text, fontWeight: 800, padding: "0 12px", cursor: "pointer" }}>Refresh</button>
      </div>

      <div className="trk-head">
        <h1 style={{ color: text }}>Live tracking <span style={{ color: muted }}>{carLabel} • {shopName} • {shopAddr} • #AV-{booking.id}</span></h1>
        <div className="live-badge"><span className="live-dot"></span> {String(booking.status || "").toUpperCase()} • {now.toLocaleTimeString()} • PST</div>
      </div>

      <div className="trk-grid">
        <div className="map-card">
          <div className="map-bg"></div>
          <div className="map-overlay"></div>
          <div className="map-top">
            <div className="map-chip"><i className="bi bi-geo-alt-fill" style={{ color: '#FF5722' }}></i> {shopAddr || shopName}</div>
            <div className="map-chip"><i className="bi bi-clock-fill"></i> {fmtDate(booking.booking_date)} • {fmtTime(booking.booking_time)}</div>
            <div className="map-chip"><i className="bi bi-shield-check"></i> {booking.status || "Pending"}</div>
          </div>
          <div className="map-center">
            <div className="route-line">
              <div className="shop-pin"><i className="bi bi-tools"></i> {shopName}</div>
              <div className="car-pin"><i className="bi bi-car-front-fill"></i></div>
            </div>
          </div>
          <div className="map-bottom">
            <div className="mech">
              <div className="mech-avatar"></div>
              <div>
                <b style={{ fontSize: '13px', color: '#0A192F', display: 'block' }}>{mechName} • {shopName}</b>
                <span style={{ fontSize: '11px', color: '#6B7A90', fontWeight: 600 }}>{shopAddr} {shopPhone ? `• ${shopPhone}` : ""}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {shopPhone && <button onClick={() => window.open(`tel:${shopPhone}`)} style={{ height: '38px', borderRadius: '12px', border: '1.5px solid #0A192F', background: '#fff', fontWeight: 800, fontSize: '11px', padding: '0 12px', cursor: 'pointer' }}><i className="bi bi-telephone-fill"></i> Call Shop</button>}
            </div>
          </div>
        </div>

        <div>
          <div className="timeline-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', position: 'relative', zIndex: 1 }}>
              <h3 style={{ fontWeight: 900, fontSize: '15px', margin: 0 }}>Job Progress • {shopName}</h3>
              <small style={{ fontSize: '11px', color: '#8FA0B8', fontWeight: 700 }}>{activeStep + 1}/{steps.length} • {Math.round(progress)}%</small>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', marginBottom: '12px', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
              <div style={{ width: `${progress}%`, height: '100%', background: '#FFEB3B', transition: '0.5s' }}></div>
            </div>
            {steps.map(s => (
              <div key={s.id} className={`tl-item ${s.done ? 'done' : ''} ${s.id === activeStep ? 'active' : ''}`}>
                <div className="tl-icon"><i className={`bi ${s.icon}`}></i></div>
                <div>
                  <b style={{ fontSize: '13px', fontWeight: 800 }}>{s.title}</b>
                  <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: '#8FA0B8', lineHeight: 1.4 }}>{s.desc}</p>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#FFEB3B', marginTop: '4px', display: 'block', letterSpacing: '0.05em' }}>{s.time}</span>
                </div>
              </div>
            ))}
            {job?.remarks && <div style={{ marginTop: 12, background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: 10, fontSize: 12, color: "#fff" }}><b>Latest remark:</b> {job.remarks}</div>}
          </div>

          <div className="parts-card" style={{ background: cardBg, borderColor: cardBorder }}>
            <h4 style={{ fontSize: '13px', fontWeight: 900, margin: '0 0 10px', color: text, display: 'flex', alignItems: 'center', gap: '6px' }}><i className="bi bi-receipt"></i> Invoice • No hidden fees</h4>
            <div className="part-row"><span>{booking.service_type || booking.service || "Service"}</span><b>${total.toFixed(0)}</b></div>
            <div className="part-row" style={{ fontWeight: 900, color: text, borderBottom: 'none', fontSize: '13px' }}><span>Total • {total === 0 ? "To be confirmed on pickup" : "Pay on pickup"}</span><b>${total.toFixed(0)}</b></div>

            <h4 style={{ fontSize: '12px', fontWeight: 900, margin: '14px 0 8px', color: text }}><i className="bi bi-camera"></i> Live from bay • {shopName}</h4>
            {job?.image_url || booking?.image_url ? (
              <div className="live-photos"><div style={{ backgroundImage: `url(${job?.image_url || booking?.image_url})` }}></div></div>
            ) : (
              <div style={{ background: soft, border: `1px solid ${cardBorder}`, borderRadius: '10px', padding: '10px', fontSize: '11px', color: muted, fontWeight: 500 }}>
                <i className="bi bi-info-circle me-1"></i> No photos uploaded yet for this job. Mechanic will add photos as work progresses.
              </div>
            )}
            <div style={{ marginTop: '10px', background: soft, border: `1px solid ${cardBorder}`, borderRadius: '10px', padding: '10px', fontSize: '11px', color: muted, fontWeight: 500 }}>
              <i className="bi bi-info-circle me-1"></i> {job ? `Job updated ${fmtTime(job.updated_at)} • Progress ${progress}%` : "Waiting for workshop to update job progress."}
            </div>
          </div>

          {onBack && <button onClick={onBack} style={{ width: '100%', marginTop: '12px', height: '44px', borderRadius: '14px', border: `1.5px solid ${cardBorder}`, background: cardBg, color: text, fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}><i className="bi bi-arrow-left me-1"></i> Back to Appointments</button>}
        </div>
      </div>
    </>
  );
}