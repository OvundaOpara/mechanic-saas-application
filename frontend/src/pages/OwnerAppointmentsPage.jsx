// src/pages/OwnerAppointmentsPage.jsx
import { useState, useMemo, useEffect } from "react";
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
function to12h(t) {
  if (!t) return "—";
  const s = String(t).trim();
  if (/AM|PM/i.test(s)) return s;
  const parts = s.split(":");
  if (parts.length < 2) return s;
  let h = parseInt(parts[0], 10); const m = parts[1];
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}
function to24h(t) {
  if (!t) return t;
  if (/AM|PM/i.test(t)) {
    const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) return t;
    let h = parseInt(m[1], 10);
    if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
    if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m[2]}:00`;
  }
  return t.length === 5 ? `${t}:00` : t;
}
function mapStatus(s) {
  const v = String(s || "").toLowerCase().trim();
  if (["pending", "confirmed", "upcoming", "scheduled", "accepted"].includes(v)) return "Upcoming";
  if (["in_progress", "in progress", "in-progress", "ongoing", "inprogress"].includes(v)) return "In Progress";
  if (["completed", "done", "finished"].includes(v)) return "Completed";
  if (["cancelled", "canceled", "rejected"].includes(v)) return "Cancelled";
  return "Upcoming";
}
function mapBooking(b) {
  const numericId = b.id;
  const car = [b.car_make, b.car_model].filter(Boolean).join(" ") || b.vehicle || b.car || b.car_name || "—";
  const plate = b.car_plate || b.car_plate2 || b.plate || b.plate_number || "—";
  const shop = b.workshop_name || b.shop || b.business_name || "Workshop";
  const priceNum = b.amount ?? b.price ?? 0;
  return {
    _dbId: numericId,
    id: `#AV-${numericId}`,
    shop,
    location: b.workshop_city || b.location || "",
    image: b.workshop_image || b.image || FALLBACK_IMG,
    date: b.booking_date ? String(b.booking_date).slice(0, 10) : "",
    time: to12h(b.booking_time || b.time),
    service: b.service_type || b.service || "General Service",
    car,
    plate,
    price: `$${Number(priceNum || 0).toFixed(0)}`,
    status: mapStatus(b.status),
    mechanic: b.mechanic || b.mechanic_name || "Assigned on arrival",
    phone: b.workshop_phone || b.phone || "",
    likes: b.likes || 0,
    rating: b.workshop_rating || b.rating || 0,
    address: b.workshop_address || b.address || "",
    duration: b.duration || "—",
    progress: b.progress ?? (mapStatus(b.status) === "In Progress" ? 50 : mapStatus(b.status) === "Completed" ? 100 : 0),
    remarks: b.remarks || b.description || "",
    description: b.description || "",
  };
}

export default function OwnerAppointmentsPage({ C, isDark }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 5;
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showResched, setShowResched] = useState(false);
  const [showTrack, setShowTrack] = useState(false);
  const [reschedForm, setReschedForm] = useState({ date: "", time: "10:00 AM" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const ownerId = getOwnerId();
    if (!ownerId) { setError("Please log in again to see your appointments."); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/bookings?owner_id=${ownerId}&limit=200`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      const arr = Array.isArray(data) ? data : (data.bookings || data.data || []);
      setList(arr.map(mapBooking));
    } catch (e) {
      setError(e.message === "Failed to fetch" ? "Cannot reach backend at http://127.0.0.1:5000 — is 'py app.py' running?" : e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => list.filter(a => {
    const mStatus = filter === "All" || a.status === filter;
    const mQ = `${a.id} ${a.shop} ${a.service} ${a.car}`.toLowerCase().includes(q.toLowerCase());
    return mStatus && mQ;
  }), [list, filter, q]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const openDetail = (a) => { setSelected(a); setShowDetail(true); };
  const openResched = (a) => { setSelected(a); setReschedForm({ date: a.date, time: a.time }); setShowResched(true); };
  const openTrack = (a) => { setSelected(a); setShowTrack(true); };

  const cancelAppt = async (a) => {
    const r = await Swal.fire({ title: "Cancel appointment?", text: `${a.id} • ${a.shop} on ${a.date}`, icon: "warning", showCancelButton: true, confirmButtonText: "Yes, cancel", confirmButtonColor: "#DC2626" });
    if (!r.isConfirmed) return;
    try {
      const res = await fetch(`${API}/bookings/${a._dbId}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setList(p => p.map(x => x._dbId === a._dbId ? { ...x, status: "Cancelled" } : x));
      Swal.fire("Cancelled", "Appointment cancelled.", "success");
    } catch (e) { Swal.fire("Could not cancel", e.message, "error"); }
  };

  const submitResched = async (e) => {
    e.preventDefault();
    if (!reschedForm.date) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/bookings/${selected._dbId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking_date: reschedForm.date, booking_time: to24h(reschedForm.time) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setList(prev => prev.map(x => x._dbId === selected._dbId ? { ...x, date: reschedForm.date, time: reschedForm.time } : x));
      setShowResched(false);
      Swal.fire("Rescheduled", `Moved to ${reschedForm.date} at ${reschedForm.time}`, "success");
    } catch (err) { Swal.fire("Could not reschedule", err.message, "error"); }
    setSaving(false);
  };

  const stStyle = (s) => {
    if (s === "Upcoming") return { bg: "#DBEAFE", color: "#1E40AF", dot: "#2563EB" };
    if (s === "In Progress") return { bg: "#FEF3C7", color: "#92400E", dot: "#D97706" };
    if (s === "Completed") return { bg: "#DCFCE7", color: "#166534", dot: "#22C55E" };
    if (s === "Cancelled") return { bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" };
    return { bg: C.soft, color: C.muted, dot: C.muted };
  };

  return (
    <>
      <style>{`
        .ap-root{ width:100%; max-width:100vw; box-sizing:border-box; }
        .ap-toolbar{ background:${C.card}; border:1.5px solid ${C.cardBorder}; border-radius:16px; padding:12px; display:flex; flex-direction:column; gap:10px; width:100%; box-sizing:border-box; }
        .ap-search-wrap{ position:relative; width:100%; }
        .ap-input{ width:100%; height:46px; background:${C.soft}; border:1.5px solid ${C.cardBorder}; border-radius:12px; padding:0 12px 0 40px; color:${C.text}; font-weight:600; font-size:14px; box-sizing:border-box; }
        .ap-filter-row{ display:flex; gap:8px; overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; scrollbar-width:none; width:100%; padding-bottom:2px; }
        .ap-filter-row::-webkit-scrollbar{ display:none; }
        .ap-filter-btn{ height:40px; padding:0 14px; border-radius:10px; font-weight:800; font-size:12px; white-space:nowrap; border:1.5px solid ${C.cardBorder}; flex:0 0 auto; cursor:pointer; }
        .ap-wrap{ background:${C.card}; border:1.5px solid ${C.cardBorder}; border-radius:16px; overflow:hidden; width:100%; box-sizing:border-box; }
        .mobile-only{ display:grid; gap:10px; width:100%; padding:10px; box-sizing:border-box; }
        .desktop-only{ display:none; }
        .ap-card{ background:${C.card}; border:1.5px solid ${C.cardBorder}; border-radius:14px; padding:12px; width:100%; box-sizing:border-box; }
        .ap-btn{ height:40px; border-radius:9px; font-weight:800; font-size:12.5px; display:flex; align-items:center; justify-content:center; gap:6px; border:1.5px solid ${C.cardBorder}; cursor:pointer; width:100%; box-sizing:border-box; min-width:0; }
        .ap-btn.detail{ background:${C.soft}; color:${C.text}; }
        .ap-btn.track{ background:#0A192F; color:#fff; border-color:#0A192F; }
        .ap-btn.resched{ background:#fff; color:#0A192F; border-color:#0A192F; }
        .ap-btn.cancel{ background:#FEF2F2; color:#DC2626; border-color:#FECACA; }
        .ap-btn:disabled{ opacity:.4; pointer-events:none; }
        .ap-table-wrapper { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .ap-table{ width:100%; border-collapse:collapse; min-width: 650px; }
        .ap-table th{ background:${C.soft}; color:${C.muted}; font-size:11px; font-weight:800; padding:12px 14px; text-align:left; border-bottom:1.5px solid ${C.cardBorder}; white-space:nowrap; }
        .ap-table td{ padding:12px 14px; border-bottom:1px solid ${C.cardBorder}; vertical-align:middle; white-space:nowrap; }
        .modal-overlay{ position:fixed; inset:0; background:rgba(5,12,28,0.7); backdrop-filter:blur(8px); z-index:110; display:grid; place-items:center; padding:12px; }
        .modal-box{ width:100%; max-width:760px; background:${C.card}; border:1.5px solid ${C.cardBorder}; border-radius:20px; max-height:92vh; overflow-y:auto; box-sizing:border-box; }
        .owner-main{ width:100%; max-width:100%; box-sizing:border-box; overflow-x:hidden; padding:12px; }
        @media(max-width:991px){ .owner-main{ margin-left:0 !important; width:100% !important; } }
        @media(min-width:769px){
          .mobile-only{ display:none !important; }
          .desktop-only{ display:block !important; }
          .ap-toolbar{ flex-direction:row; align-items:center; }
          .ap-search-wrap{ flex:1; }
          .ap-filter-row{ width:auto; }
        }
      `}</style>

      <div className="ap-root">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <div><h2 style={{ fontWeight: 900, fontSize: '22px', color: C.text, margin: 0 }}>Appointments</h2><p style={{ color: C.muted, fontSize: '13px', margin: '4px 0 0' }}>Bookings • {filtered.length} records</p></div>
          <span style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: '20px', padding: '7px 12px', fontSize: '12px', fontWeight: 800, color: C.muted, height: 'fit-content' }}>{filtered.length} found</span>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#991B1B", borderRadius: "12px", padding: "12px", marginBottom: "12px", display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: 700 }}>{error}</span>
            <button onClick={load} style={{ background: "#991B1B", color: "#fff", border: "none", borderRadius: "8px", padding: "6px 12px", fontWeight: 800, cursor: "pointer" }}>Retry</button>
          </div>
        )}

        <div className="row g-2 mb-3" style={{ margin: 0 }}>
          <div className="col-6 col-md-3 p-1"><div style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: '14px', padding: '12px' }}><div style={{ fontSize: '10px', fontWeight: 800, color: C.muted }}>UPCOMING</div><div style={{ fontSize: '22px', fontWeight: 900, color: C.text }}>{list.filter(a => a.status === "Upcoming").length}</div></div></div>
          <div className="col-6 col-md-3 p-1"><div style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: '14px', padding: '12px' }}><div style={{ fontSize: '10px', fontWeight: 800, color: C.muted }}>IN PROGRESS</div><div style={{ fontSize: '22px', fontWeight: 900, color: '#D97706' }}>{list.filter(a => a.status === "In Progress").length}</div></div></div>
          <div className="col-6 col-md-3 p-1"><div style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: '14px', padding: '12px' }}><div style={{ fontSize: '10px', fontWeight: 800, color: C.muted }}>COMPLETED</div><div style={{ fontSize: '22px', fontWeight: 900, color: C.text }}>{list.filter(a => a.status === "Completed").length}</div></div></div>
          <div className="col-6 col-md-3 p-1"><div style={{ background: '#0A192F', borderRadius: '14px', padding: '12px', color: '#fff' }}><div style={{ fontSize: '10px', fontWeight: 800, color: '#94A3B8' }}>SUPPORT</div><div style={{ fontSize: '12px', fontWeight: 800, marginTop: '2px' }}>+1-201-534-2657</div></div></div>
        </div>

        <div className="ap-toolbar mb-3">
          <div className="ap-search-wrap"><i className="bi bi-search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: C.muted }}></i><input className="ap-input" placeholder="Search shop, service, ID..." value={q} onChange={e => { setQ(e.target.value); setPage(1) }} /></div>
          <div className="ap-filter-row">
            {["All", "Upcoming", "In Progress", "Completed", "Cancelled"].map(f => {
              const active = filter === f;
              return <button key={f} onClick={() => { setFilter(f); setPage(1) }} className="ap-filter-btn" style={{ background: active ? '#0A192F' : '#fff', color: active ? '#fff' : C.text, borderColor: active ? '#0A192F' : C.cardBorder }}>{f}</button>
            })}
            {(q || filter !== "All") && <button onClick={() => { setQ(""); setFilter("All"); setPage(1) }} className="ap-filter-btn" style={{ background: C.soft }}><i className="bi bi-x-lg"></i></button>}
          </div>
        </div>

        <div className="ap-wrap">
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: C.muted, fontWeight: 700 }}>Loading appointments…</div>
          ) : paginated.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: C.muted, fontWeight: 700 }}>No appointments found. Book a workshop from Workshops page.</div>
          ) : (
            <>
              <div className="desktop-only">
                <div className="ap-table-wrapper">
                  <table className="ap-table">
                    <thead><tr><th>WORKSHOP</th><th>DATE & TIME</th><th>STATUS & ACTIONS</th></tr></thead>
                    <tbody>
                      {paginated.map(a => {
                        const st = stStyle(a.status);
                        return (
                          <tr key={a._dbId}>
                            <td>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <img src={a.image} alt="" style={{ width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover' }} />
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: '14px', color: C.text }}>{a.shop}</div>
                                  <div style={{ fontSize: '11px', color: C.muted }}>{a.id} • {a.likes} likes</div>
                                  <div style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>{a.service}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 800, fontSize: '13px', color: C.text }}>{a.date}</div>
                              <div style={{ fontSize: '12px', color: C.muted }}>{a.time} • {a.price}</div>
                              <div style={{ fontSize: '11px', color: C.muted }}>{a.car}</div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ background: st.bg, color: st.color, fontSize: '11px', fontWeight: 900, padding: '5px 10px', borderRadius: '20px' }}>{a.status}</span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button className="ap-btn detail" style={{ width: 'auto', padding: '0 12px' }} onClick={() => openDetail(a)}><i className="bi bi-eye"></i> Detail</button>
                                  {a.status === "In Progress" ?
                                    <button className="ap-btn track" style={{ width: 'auto', padding: '0 12px' }} onClick={() => openTrack(a)}><i className="bi bi-geo-alt-fill"></i> Track</button>
                                    : <button className="ap-btn resched" style={{ width: 'auto', padding: '0 12px' }} onClick={() => openResched(a)} disabled={a.status === "Cancelled" || a.status === "Completed"}><i className="bi bi-calendar-event"></i> Resched</button>
                                  }
                                  <button className="ap-btn cancel" style={{ width: 'auto', padding: '0 10px' }} onClick={() => cancelAppt(a)} disabled={a.status === "Cancelled" || a.status === "Completed"}><i className="bi bi-x-lg"></i></button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mobile-only">
                {paginated.map(a => {
                  const st = stStyle(a.status);
                  return (
                    <div key={a._dbId} className="ap-card">
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <img src={a.image} alt="" style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0, border: `1px solid ${C.cardBorder}` }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ fontWeight: 900, fontSize: '14px', color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{a.shop}</div>
                            <span style={{ background: st.bg, color: st.color, fontSize: '10px', fontWeight: 900, padding: '4px 8px', borderRadius: '20px', flexShrink: 0, whiteSpace: 'nowrap' }}>{a.status}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.id} • {a.likes} likes • {a.rating}★</div>
                          <div style={{ fontSize: '12.5px', fontWeight: 700, color: C.text, marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.service} • {a.price}</div>
                          <div style={{ fontSize: '11.5px', color: C.muted }}>{a.date} • {a.time}</div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                        <button className="ap-btn detail" onClick={() => openDetail(a)}><i className="bi bi-eye"></i> Detail</button>
                        {a.status === "In Progress" ?
                          <button className="ap-btn track" onClick={() => openTrack(a)}><i className="bi bi-geo-alt-fill"></i> Track</button>
                          : <button className="ap-btn resched" onClick={() => openResched(a)} disabled={a.status === "Cancelled" || a.status === "Completed"}><i className="bi bi-calendar-event"></i> Resched</button>
                        }
                      </div>
                      <button className="ap-btn cancel" style={{ marginTop: '8px' }} onClick={() => cancelAppt(a)} disabled={a.status === "Cancelled" || a.status === "Completed"}><i className="bi bi-x-lg"></i> Cancel</button>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderTop: `1.5px solid ${C.cardBorder}`, background: C.soft, flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '12px', color: C.muted, fontWeight: 700 }}>Page {page}/{totalPages || 1} • {filtered.length} rec</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ width: '36px', height: '36px', borderRadius: '8px', border: `1.5px solid ${C.cardBorder}`, background: C.card }}><i className="bi bi-chevron-left"></i></button>
              <button disabled={page === totalPages || totalPages === 0} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ width: '36px', height: '36px', borderRadius: '8px', border: `1.5px solid ${C.cardBorder}`, background: C.card }}><i className="bi bi-chevron-right"></i></button>
            </div>
          </div>
        </div>
      </div>

      {showDetail && selected && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ height: '160px', backgroundImage: `url(${selected.image})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
              <button onClick={() => setShowDetail(false)} style={{ position: 'absolute', top: '12px', right: '12px', width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: '#fff', display: 'grid', placeItems: 'center' }}><i className="bi bi-x-lg"></i></button>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0A192F 30%, transparent)' }}></div>
              <div style={{ position: 'absolute', bottom: '12px', left: '16px', right: '16px' }}><h2 style={{ color: '#fff', fontWeight: 900, margin: 0, fontSize: '18px' }}>{selected.shop}</h2><div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px' }}>{selected.address}</div></div>
            </div>
            <div style={{ padding: '16px', display: 'grid', gap: '12px' }}>
              <div style={{ background: C.soft, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', padding: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: C.muted }}>SERVICE • CAR • PRICE</div>
                <div style={{ fontWeight: 800, fontSize: '13px', color: C.text, marginTop: '4px' }}>{selected.id} • {selected.service} • {selected.price}</div>
                <div style={{ fontSize: '12px', color: C.muted }}>{selected.car} • {selected.plate} • {selected.duration}</div>
                <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px' }}>Mechanic: {selected.mechanic} • {selected.date} {selected.time}</div>
                {selected.remarks && <div style={{ fontSize: '12px', color: C.text, marginTop: '6px' }}>{selected.remarks}</div>}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <a href={`tel:${selected.phone}`} style={{ flex: '1', height: '44px', borderRadius: '10px', fontWeight: 800, background: C.soft, border: `1.5px solid ${C.cardBorder}`, color: C.text, display: 'grid', placeItems: 'center', textDecoration: 'none' }}>Call</a>
                <button style={{ flex: '1', height: '44px', borderRadius: '10px', fontWeight: 900, background: '#0A192F', color: '#fff', border: 'none' }} onClick={() => { setShowDetail(false); setTimeout(() => openResched(selected), 150) }}>Resched</button>
                <button style={{ height: '44px', borderRadius: '10px', fontWeight: 800, background: '#fff', border: `1.5px solid ${C.cardBorder}`, padding: '0 16px' }} onClick={() => setShowDetail(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showResched && selected && (
        <div className="modal-overlay" onClick={() => setShowResched(false)}>
          <div className="modal-box" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontWeight: 900, fontSize: '15px', color: C.text, margin: 0 }}>Reschedule {selected.id}</h4>
              <button onClick={() => setShowResched(false)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: `1.5px solid ${C.cardBorder}`, background: C.soft, display: 'grid', placeItems: 'center' }}><i className="bi bi-x-lg"></i></button>
            </div>
            <form onSubmit={submitResched} style={{ padding: '0 16px 16px' }}>
              <input required type="date" style={{ width: '100%', height: '44px', background: C.soft, border: `1.5px solid ${C.cardBorder}`, borderRadius: '10px', padding: '0 12px', boxSizing: 'border-box' }} value={reschedForm.date} onChange={e => setReschedForm({ ...reschedForm, date: e.target.value })} />
              <select style={{ width: '100%', height: '44px', background: C.soft, border: `1.5px solid ${C.cardBorder}`, borderRadius: '10px', padding: '0 12px', marginTop: '10px', boxSizing: 'border-box' }} value={reschedForm.time} onChange={e => setReschedForm({ ...reschedForm, time: e.target.value })}>
                <option>09:00 AM</option><option>10:00 AM</option><option>11:30 AM</option><option>01:00 PM</option><option>02:30 PM</option>
              </select>
              <button type="submit" disabled={saving} className="btn btn-dark w-100 mt-3" style={{ height: '44px', borderRadius: '10px', fontWeight: 900 }}>{saving ? "Saving..." : "Confirm"}</button>
            </form>
          </div>
        </div>
      )}

      {showTrack && selected && (
        <div className="modal-overlay" onClick={() => setShowTrack(false)}>
          <div className="modal-box" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between' }}>
              <h4 style={{ fontWeight: 900, fontSize: '15px', color: C.text, margin: 0 }}><i className="bi bi-geo-alt-fill me-1" style={{ color: '#FF5722' }}></i>Live {selected.id}</h4>
              <button onClick={() => setShowTrack(false)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: `1.5px solid ${C.cardBorder}`, background: C.soft, display: 'grid', placeItems: 'center' }}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={{ padding: '0 16px 16px', display: 'grid', gap: '12px' }}>
              <div style={{ background: '#0A192F', borderRadius: '12px', padding: '12px', display: 'flex', gap: '10px', color: '#fff' }}>
                <img src={selected.image} style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' }} alt="" />
                <div>
                  <div style={{ fontWeight: 900, fontSize: '13px' }}>{selected.shop}</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>{selected.service} • {selected.mechanic}</div>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 800, color: C.muted }}><span>Progress</span><span>{selected.progress}%</span></div>
                <div style={{ height: "8px", background: C.soft, borderRadius: "20px", overflow: "hidden", marginTop: "6px" }}><div style={{ width: `${selected.progress}%`, height: "100%", background: "#F97316" }} /></div>
                <div style={{ fontSize: "12px", color: C.muted, marginTop: "8px" }}>{selected.remarks || "Your vehicle is being worked on. Workshop will update progress."}</div>
              </div>
              <button className="btn btn-dark w-100" style={{ height: '44px', borderRadius: '10px', fontWeight: 900 }} onClick={() => setShowTrack(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}