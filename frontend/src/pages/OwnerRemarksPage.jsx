import { useState, useMemo, useEffect } from "react";
import Swal from "sweetalert2";

const API = "http://127.0.0.1:5000/api";

function getOwnerId() {
  try {
    const raw = localStorage.getItem("autoville_user") || localStorage.getItem("autoville_owner") || "{}";
    const u = JSON.parse(raw);
    return u.id || u.owner_id || u.user_id || u.ownerId || null;
  } catch { return null; }
}
function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(String(d).slice(0, 10) + "T12:00:00");
  if (isNaN(dt)) return String(d).slice(0, 10);
  return dt.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}
function asArray(d) {
  if (Array.isArray(d)) return d;
  return d?.reviews || d?.data || d?.workshops || d?.bookings || [];
}
const sentimentFromRating = (r) => r >= 4 ? "Positive" : r === 3 ? "Neutral" : "Negative";

export default function OwnerRemarksPage({ C, isDark }) {
  const [workshops, setWorkshops] = useState([]);
  const [servicesHistory, setServicesHistory] = useState([]);
  const [remarks, setRemarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterRating, setFilterRating] = useState("All");
  const [filterSentiment, setFilterSentiment] = useState("All");
  const [page, setPage] = useState(0);
  const perPage = 5;
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ shop: "", service: "", rating: 0, hover: 0, title: "", comment: "", tags: [], recommend: true });

  const load = async () => {
    const ownerId = getOwnerId();
    if (!ownerId) { setError("Please log in again to see your remarks."); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [wRes, bRes, rRes] = await Promise.allSettled([
        fetch(`${API}/workshops/available`),
        fetch(`${API}/bookings?owner_id=${ownerId}&limit=200`),
        fetch(`${API}/admin/reviews?owner_id=${ownerId}&limit=200`),
      ]);
      const wData = wRes.status === "fulfilled" && wRes.value.ok ? asArray(await wRes.value.json().catch(() => [])) : [];
      const bData = bRes.status === "fulfilled" && bRes.value.ok ? asArray(await bRes.value.json().catch(() => [])) : [];
      let rData = [];
      if (rRes.status === "fulfilled" && rRes.value.ok) {
        rData = asArray(await rRes.value.json().catch(() => []));
      } else {
        const alt = await fetch(`${API}/reviews?owner_id=${ownerId}&limit=200`);
        if (alt.ok) rData = asArray(await alt.json().catch(() => []));
      }

      // Workshops
      const mappedW = wData.map(w => ({
        id: w.id, name: w.business_name || w.name || "Workshop",
        addr: w.address || [w.city, w.state].filter(Boolean).join(", ") || "—",
        bar: w.bar_license || w.bar_license_number || w.bar || "—",
        overall: Number(w.rating || w.avg_rating || w.overall || 0),
        totalReviews: Number(w.review_count || w.reviews || w.total_reviews || 0),
      }));
      setWorkshops(mappedW);

      // Bookings -> servicesHistory
      const wById = {};
      mappedW.forEach(w => { wById[String(w.id)] = w; });
      const mappedBookings = bData.map(b => ({
        _dbId: b.id,
        id: `#AV-${b.id}`,
        date: fmtDate(b.booking_date),
        rawDate: String(b.booking_date || "").slice(0, 10),
        shop: b.workshop_name || wById[String(b.workshop_id)]?.name || "Workshop",
        workshop_id: b.workshop_id,
        service: b.service_type || b.service || "Service",
        cost: Number(b.amount || 0),
        status: b.status,
      }));
      setServicesHistory(mappedBookings);

      // Reviews -> remarks (only this owner)
      const myReviews = rData.filter(r => String(r.owner_id || r.ownerId || ownerId) === String(ownerId) || !r.owner_id);
      const mappedR = myReviews.map(r => {
        const booking = mappedBookings.find(b => String(b._dbId) === String(r.booking_id)) || {};
        const workshop = wById[String(r.workshop_id)] || {};
        const rating = Number(r.rating || 0);
        const tags = Array.isArray(r.tags) ? r.tags : (typeof r.tags === "string" && r.tags ? r.tags.split(",").map(s => s.trim()) : []);
        return {
          _dbId: r.id,
          id: `RV-${r.id}`,
          date: String(r.created_at || r.date || "").slice(0, 10),
          dateLabel: fmtDate(r.created_at || r.date),
          shop: r.workshop_name || workshop.name || booking.shop || "Workshop",
          workshop_id: r.workshop_id || booking.workshop_id,
          shopAddr: workshop.addr || r.workshop_address || "—",
          bar: workshop.bar || r.bar_license || "—",
          service: r.service_type || r.service || booking.service || "Service",
          serviceId: booking.id || (r.booking_id ? `#AV-${r.booking_id}` : ""),
          booking_id: r.booking_id || booking._dbId,
          cost: booking.cost ?? Number(r.cost || 0),
          rating,
          title: r.title || r.subject || `${rating} star experience`,
          comment: r.comment || r.review || r.text || "",
          sentiment: sentimentFromRating(rating),
          tags,
          recommend: r.recommend !== undefined ? !!r.recommend : rating >= 4,
          helpful: Number(r.helpful || r.helpful_count || 0),
        };
      }).sort((a, b) => new Date(b.date) - new Date(a.date));
      setRemarks(mappedR);
    } catch (e) {
      setError(e.message === "Failed to fetch" ? "Cannot reach backend at http://127.0.0.1:5000 — is 'py app.py' running?" : e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(0); }, [search, filterRating, filterSentiment]);

  const workshopAccumulated = useMemo(() => {
    const map = {};
    // Start from real workshops
    workshops.forEach(w => {
      const myRatings = remarks.filter(r => r.shop === w.name).map(r => r.rating);
      const sum = myRatings.reduce((a, b) => a + b, 0);
      const total = w.totalReviews + myRatings.length;
      const avg = total === 0 ? 0 : ((w.overall * w.totalReviews + sum) / total);
      // If workshop has no base reviews, accumulated = avg of my reviews
      const finalAvg = w.totalReviews === 0 && myRatings.length ? (sum / myRatings.length) : avg;
      map[w.name] = { ...w, myCount: myRatings.length, accumulated: finalAvg.toFixed(1), myAvg: myRatings.length ? (sum / myRatings.length).toFixed(1) : "-" };
    });
    // Include shops that have remarks but are no longer in /available
    remarks.forEach(r => {
      if (!map[r.shop]) {
        const myRatings = remarks.filter(x => x.shop === r.shop).map(x => x.rating);
        const sum = myRatings.reduce((a, b) => a + b, 0);
        map[r.shop] = { name: r.shop, addr: r.shopAddr, bar: r.bar, overall: 0, totalReviews: 0, myCount: myRatings.length, accumulated: (sum / myRatings.length).toFixed(1), myAvg: (sum / myRatings.length).toFixed(1) };
      }
    });
    return map;
  }, [remarks, workshops]);

  const filtered = useMemo(() => {
    let d = [...remarks];
    if (search) { const s = search.toLowerCase(); d = d.filter(r => `${r.id} ${r.shop} ${r.service} ${r.title} ${r.comment}`.toLowerCase().includes(s)); }
    if (filterRating !== "All") d = d.filter(r => r.rating === Number(filterRating));
    if (filterSentiment !== "All") d = d.filter(r => r.sentiment === filterSentiment);
    d.sort((a, b) => new Date(b.date) - new Date(a.date));
    return d;
  }, [remarks, search, filterRating, filterSentiment]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice(page * perPage, page * perPage + perPage);
  const avgGiven = remarks.length ? (remarks.reduce((a, b) => a + b.rating, 0) / remarks.length).toFixed(1) : "0.0";
  const positive = remarks.filter(r => r.rating >= 4).length;
  const negative = remarks.filter(r => r.rating <= 2).length;

  const toggleTag = (tag) => {
    setForm(f => {
      const has = f.tags.includes(tag);
      return { ...f, tags: has ? f.tags.filter(t => t !== tag) : [...f.tags, tag] };
    });
  };

  const handleSubmit = async () => {
    if (!form.shop || !form.service || !form.rating || !form.comment) {
      Swal.fire("Missing fields", "Select workshop, service, rating (stars) and write remark", "warning");
      return;
    }
    // form.service is "#AV-1024 • Brake Pad..." — parse booking
    const svc = servicesHistory.find(s => `${s.service} • ${s.id}` === form.service || s.id === form.service) || servicesHistory.find(s => `${s.id}` === form.service);
    const workshop = workshops.find(w => w.name === form.shop);
    if (!workshop && !svc) { Swal.fire("Workshop not found", "Please pick a workshop from the list.", "warning"); return; }
    const ownerId = getOwnerId();
    setSaving(true);
    try {
      const payload = {
        workshop_id: workshop?.id || svc?.workshop_id,
        owner_id: ownerId,
        booking_id: svc?._dbId || null,
        rating: form.rating,
        title: form.title || `${form.rating} star experience`,
        comment: form.comment,
        review: form.comment,
        tags: form.tags,
        recommend: form.recommend,
        service_type: svc?.service || form.service,
      };
      let res = await fetch(`${API}/admin/reviews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) res = await fetch(`${API}/reviews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      Swal.fire("Submitted!", "Your remark was saved and workshop rating updated.", "success");
      setShowNew(false);
      setForm({ shop: "", service: "", rating: 0, hover: 0, title: "", comment: "", tags: [], recommend: true });
      load();
    } catch (e) { Swal.fire("Could not save", e.message, "error"); }
    setSaving(false);
  };

  const markHelpful = (r) => {
    setRemarks(prev => prev.map(x => x._dbId === r._dbId ? { ...x, helpful: x.helpful + 1 } : x));
    if (selected?._dbId === r._dbId) setSelected(s => s ? { ...s, helpful: s.helpful + 1 } : s);
  };

  const cardBg = C?.card || "#fff";
  const cardBorder = C?.cardBorder || "#E2E8F0";
  const text = C?.text || "#0A192F";
  const muted = C?.muted || "#6B7A90";
  const soft = C?.soft || "#F8FAFC";
  const Star = ({ filled, size = 18 }) => <i className={`bi ${filled ? "bi-star-fill" : "bi-star"}`} style={{ color: filled ? "#F59E0B" : "#CBD5E1", fontSize: size }}></i>;

  // Services filtered by selected shop in form
  const servicesForForm = form.shop
    ? servicesHistory.filter(s => s.shop === form.shop)
    : servicesHistory;

  return (
    <>
      <style>{`
        *{ box-sizing:border-box; }
        .rk-wrap{ width:100%; max-width:100%; overflow:hidden; }
        .rk-stat{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:18px; padding:18px; height:100%; }
        .rk-stat .label{ font-size:12px; font-weight:800; color:${muted}; letter-spacing:0.06em; text-transform:uppercase; }
        .rk-stat .value{ font-weight:900; font-size:26px; color:${text}; margin-top:6px; }
        .rk-toolbar{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:18px; padding:14px; display:flex; gap:10px; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom:14px; }
        .rk-search{ position:relative; flex:1; min-width:220px; max-width:360px; }
        .rk-search input{ width:100%; height:46px; border:1.5px solid ${cardBorder}; border-radius:12px; padding:0 14px 0 42px; font-size:15px; font-weight:600; background:${soft}; color:${text}; outline:none; }
        .rk-search i{ position:absolute; left:14px; top:50%; transform:translateY(-50%); color:${muted}; font-size:16px; }
        .rk-table-wrap{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:18px; overflow:hidden; width:100%; }
        .rk-table{ width:100%; border-collapse:collapse; table-layout:fixed; }
        .rk-table th{ text-align:left; font-size:12px; font-weight:900; color:${muted}; padding:14px 12px; border-bottom:1.5px solid ${cardBorder}; background:${soft}; text-transform:uppercase; }
        .rk-table th:nth-child(1){ width:20%; } .rk-table th:nth-child(2){ width:28%; } .rk-table th:nth-child(3){ width:22%; } .rk-table th:nth-child(4){ width:18%; } .rk-table th:nth-child(5){ width:12%; }
        .rk-table td{ padding:14px 12px; font-size:14px; font-weight:600; color:${text}; border-bottom:1px solid ${cardBorder}; vertical-align:middle; }
        .rk-table tr:hover td{ background:${soft}; }
        .badge{ font-size:11px; font-weight:800; padding:5px 10px; border-radius:20px; }
        .badge.positive{ background:#DCFCE7; color:#166534; } .badge.negative{ background:#FEE2E2; color:#991B1B; } .badge.neutral{ background:#FEF3C7; color:#92400E; }
        .btn-view{ height:38px; border-radius:11px; border:1.5px solid ${text}; background:${text}; color:#fff; font-weight:800; font-size:13px; padding:0 14px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; }
        .rk-mobile{ display:none; }
        @media(max-width: 992px){ .rk-table th:nth-child(2){ width:32%; } .rk-table th:nth-child(3){ display:none; } .rk-table td:nth-child(3){ display:none; } }
        @media(max-width: 768px){ .rk-table-wrap.desktop{ display:none; } .rk-mobile{ display:grid; gap:12px; } .rk-mcard{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:16px; padding:16px; } .rk-toolbar{ flex-direction:column; align-items:stretch; } .rk-search{ max-width:100%; } }
        .rk-modal-backdrop{ position:fixed; inset:0; background:rgba(10,25,47,0.55); backdrop-filter:blur(6px); z-index:99; display:grid; place-items:center; padding:16px; }
        .rk-modal{ width:100%; max-width:700px; max-height:92vh; overflow:auto; background:${cardBg}; border:2px solid ${text}; border-radius:22px; box-shadow:0 30px 80px rgba(0,0,0,0.25); }
        .rk-input, .rk-select, .rk-textarea{ width:100%; border:1.5px solid ${cardBorder}; border-radius:12px; background:${soft}; color:${text}; font-weight:600; font-size:14px; padding:0 14px; }
        .rk-input, .rk-select{ height:46px; } .rk-textarea{ padding:12px 14px; min-height:110px; resize:vertical; }
        .star-btn{ background:transparent; border:none; cursor:pointer; padding:4px; }
        .tag-pill{ font-size:12px; font-weight:700; padding:6px 12px; border-radius:20px; border:1.5px solid ${cardBorder}; background:${cardBg}; color:${text}; cursor:pointer; }
        .tag-pill.on{ background:${text}; color:#fff; border-color:${text}; }
      `}</style>

      <div className="rk-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontWeight: 900, fontSize: '30px', color: text, margin: '0 0 6px' }}>Remarks & Ratings</h2>
            <p style={{ color: muted, fontSize: '15px', margin: 0, fontWeight: 500 }}>Rate a specific service from a specific workshop • Ratings accumulate to workshop overall • BAR verified</p>
          </div>
          <button onClick={() => setShowNew(true)} style={{ height: '46px', borderRadius: '12px', background: text, color: '#fff', border: `1.5px solid ${text}`, fontWeight: 800, fontSize: '14px', padding: '0 18px', cursor: "pointer" }}><i className="bi bi-star-fill me-2" style={{ color: '#F59E0B' }}></i>New Remark + Rating</button>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#991B1B", borderRadius: 12, padding: 12, marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{error}</span>
            <button onClick={load} style={{ background: "#991B1B", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontWeight: 800, cursor: "pointer" }}>Retry</button>
          </div>
        )}

        {loading ? <div style={{ padding: 40, textAlign: "center", color: muted, fontWeight: 700 }}>Loading remarks…</div> : (
          <>
            <div className="row g-3 mb-3" style={{ margin: 0, width: '100%' }}>
              <div className="col-6 col-lg-3"><div className="rk-stat"><div className="label">Your Reviews</div><div className="value">{remarks.length}</div><div style={{ fontSize: '12px', color: muted, marginTop: '4px' }}>Avg you gave: {avgGiven} <i className="bi bi-star-fill" style={{ color: '#F59E0B' }}></i></div></div></div>
              <div className="col-6 col-lg-3"><div className="rk-stat"><div className="label">Positive Remarks</div><div className="value" style={{ color: '#166534' }}>{positive}</div><div style={{ fontSize: '12px', color: '#22C55E', fontWeight: 700 }}><i className="bi bi-hand-thumbs-up-fill me-1"></i>Rating ≥4</div></div></div>
              <div className="col-6 col-lg-3"><div className="rk-stat"><div className="label">Negative Remarks</div><div className="value" style={{ color: '#991B1B' }}>{negative}</div><div style={{ fontSize: '12px', color: '#EF4444', fontWeight: 700 }}><i className="bi bi-hand-thumbs-down-fill me-1"></i>Rating ≤2</div></div></div>
              <div className="col-6 col-lg-3"><div className="rk-stat" style={{ background: '#0A192F', borderColor: '#0A192F' }}><div className="label" style={{ color: '#94A3B8' }}>HOW RATING WORKS</div><div style={{ fontSize: '13px', color: '#E2E8F0', fontWeight: 600, marginTop: '6px', lineHeight: 1.4 }}>Each service rating adds to workshop overall. Your reviews update the cards below.</div></div></div>
            </div>

            <div className="row g-3 mb-3" style={{ margin: 0, width: '100%' }}>
              {Object.values(workshopAccumulated).length === 0 ? <div style={{ padding: 20, color: muted }}>No workshops found.</div> :
                Object.values(workshopAccumulated).map(w => (
                  <div key={w.name} className="col-md-6 col-xl-3">
                    <div style={{ background: cardBg, border: `1.5px solid ${cardBorder}`, borderRadius: '16px', padding: '14px', height: '100%' }}>
                      <div style={{ fontWeight: 900, fontSize: '14px', color: text }}>{w.name}</div>
                      <div style={{ fontSize: '11px', color: muted, marginBottom: '8px' }}>{w.bar} • {String(w.addr || "").split(",")[1] || w.addr}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 900, fontSize: '22px', color: text }}>{w.accumulated}</span>
                        <span style={{ display: 'flex', gap: '2px' }}>{[1, 2, 3, 4, 5].map(i => <Star key={i} filled={i <= Math.round(Number(w.accumulated))} size={14} />)}</span>
                        <span style={{ fontSize: '11px', color: muted }}>({w.totalReviews + w.myCount})</span>
                      </div>
                      <div style={{ fontSize: '11px', color: muted }}>Base: {w.overall} ({w.totalReviews}) + Your: {w.myCount} reviews = <b style={{ color: text }}>{w.accumulated}</b></div>
                      <div style={{ marginTop: '8px', background: soft, height: '6px', borderRadius: '10px', overflow: 'hidden' }}><div style={{ width: `${(Number(w.accumulated) / 5) * 100}%`, height: '100%', background: '#0A192F' }}></div></div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="rk-toolbar">
              <div className="rk-search"><i className="bi bi-search"></i><input placeholder="Search shop, service, remark..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={filterRating} onChange={e => { setFilterRating(e.target.value); setPage(0); }} style={{ height: '46px', borderRadius: '12px', border: `1.5px solid ${cardBorder}`, background: soft, color: text, fontWeight: 800, fontSize: '13px', padding: '0 12px' }}>
                  <option value="All">All Ratings</option><option value="5">5 Stars</option><option value="4">4 Stars</option><option value="3">3 Stars</option><option value="2">2 Stars</option><option value="1">1 Star</option>
                </select>
                <select value={filterSentiment} onChange={e => { setFilterSentiment(e.target.value); setPage(0); }} style={{ height: '46px', borderRadius: '12px', border: `1.5px solid ${cardBorder}`, background: soft, color: text, fontWeight: 800, fontSize: '13px', padding: '0 12px' }}>
                  <option value="All">All Sentiments</option><option value="Positive">Positive</option><option value="Neutral">Neutral</option><option value="Negative">Negative</option>
                </select>
                <span style={{ fontSize: '13px', fontWeight: 700, color: muted, background: soft, border: `1px solid ${cardBorder}`, padding: '8px 12px', borderRadius: '20px' }}>{filtered.length} remarks</span>
              </div>
            </div>

            <div className="rk-table-wrap desktop">
              <table className="rk-table">
                <thead><tr><th>Review ID • Date</th><th>Workshop • Service</th><th>Rating • Sentiment</th><th>Remark Title</th><th>Action</th></tr></thead>
                <tbody>
                  {paged.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: muted, fontSize: '15px' }}>No remarks found — add your first remark.</td></tr> :
                    paged.map(r => (
                      <tr key={r.id}>
                        <td><b style={{ fontSize: '14px' }}>{r.id}</b><div style={{ fontSize: '11px', color: muted }}>{r.dateLabel} • ${r.cost}</div></td>
                        <td><div style={{ fontWeight: 800, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.shop}</div><div style={{ fontSize: '11px', color: muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.service} • {r.serviceId} • {r.bar}</div></td>
                        <td>
                          <div style={{ display: 'flex', gap: '2px' }}>{[1, 2, 3, 4, 5].map(i => <Star key={i} filled={i <= r.rating} size={13} />)}</div>
                          <div style={{ marginTop: '4px' }}><span className={`badge ${r.sentiment.toLowerCase()}`}>{r.sentiment.toUpperCase()} • {r.rating}.0</span></div>
                        </td>
                        <td><div style={{ fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div><div style={{ fontSize: '11px', color: muted }}>{r.tags?.slice(0, 2).join(" • ")} {r.recommend ? "• Recommend" : "• Not recommend"}</div></td>
                        <td><button className="btn-view" onClick={() => setSelected(r)}><i className="bi bi-eye"></i> View</button></td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderTop: `1.5px solid ${cardBorder}`, background: soft }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: muted }}>{filtered.length === 0 ? 0 : page * perPage + 1}–{Math.min((page + 1) * perPage, filtered.length)} of {filtered.length} • Page {page + 1}/{totalPages || 1}</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} style={{ height: '38px', borderRadius: '10px', border: `1.5px solid ${cardBorder}`, background: cardBg, fontWeight: 800, fontSize: '13px', padding: '0 14px', cursor: 'pointer', color: text }}>Prev</button>
                  <button disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} style={{ height: '38px', borderRadius: '10px', border: `1.5px solid ${cardBorder}`, background: cardBg, fontWeight: 800, fontSize: '13px', padding: '0 14px', cursor: 'pointer', color: text }}>Next</button>
                </div>
              </div>
            </div>

            <div className="rk-mobile">
              {paged.map(r => (
                <div key={r.id} className="rk-mcard">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <b style={{ fontSize: '15px', color: text }}>{r.id} • {r.dateLabel}</b><span className={`badge ${r.sentiment.toLowerCase()}`}>{r.sentiment} • {r.rating}</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: text }}>{r.shop}</div>
                  <div style={{ fontSize: '12px', color: muted, marginBottom: '4px' }}>{r.service} • {r.serviceId}</div>
                  <div style={{ display: 'flex', gap: '3px', marginBottom: '6px' }}>{[1, 2, 3, 4, 5].map(i => <Star key={i} filled={i <= r.rating} size={14} />)}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: text, marginBottom: '10px' }}>{r.title}</div>
                  <button className="btn-view" style={{ width: '100%', justifyContent: 'center', height: '44px' }} onClick={() => setSelected(r)}><i className="bi bi-eye"></i> View Remark</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showNew && (
        <div className="rk-modal-backdrop" onClick={() => setShowNew(false)}>
          <div className="rk-modal" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px', borderBottom: `1.5px solid ${cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: soft, position: 'sticky', top: 0, zIndex: 2 }}>
              <div><div style={{ fontWeight: 900, fontSize: '18px', color: text }}><i className="bi bi-star-fill me-2" style={{ color: '#F59E0B' }}></i>Remark + Rating • Specific Service + Workshop</div><div style={{ fontSize: '12px', color: muted, marginTop: '2px' }}>Your rating will update workshop overall • {workshopAccumulated[form.shop]?.accumulated || "—"} new overall if you submit</div></div>
              <button onClick={() => setShowNew(false)} style={{ width: '36px', height: '36px', borderRadius: '10px', border: `1.5px solid ${cardBorder}`, background: cardBg, cursor: 'pointer' }}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={{ padding: '18px', display: 'grid', gap: '14px' }}>
              <div><div style={{ fontSize: '12px', fontWeight: 800, color: muted, marginBottom: '6px' }}>WORKSHOP • REQUIRED • BAR Verified</div>
                <select className="rk-select" value={form.shop} onChange={e => setForm({ ...form, shop: e.target.value, service: "" })}>
                  <option value="">Select workshop where service was done</option>
                  {workshops.map(w => <option key={w.name} value={w.name}>{w.name} • {w.addr} • Overall {w.overall} ({w.totalReviews} reviews)</option>)}
                </select>
              </div>
              <div><div style={{ fontSize: '12px', fontWeight: 800, color: muted, marginBottom: '6px' }}>SERVICE / JOB ID • REQUIRED • From your history</div>
                <select className="rk-select" value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}>
                  <option value="">Select service/job</option>
                  {servicesForForm.map(s => <option key={s.id} value={`${s.service} • ${s.id}`}>{s.id} • {s.service} • {s.shop} • {s.date} • ${s.cost}</option>)}
                </select>
                {form.shop && servicesForForm.length === 0 && <div style={{ fontSize: 12, color: muted, marginTop: 6 }}>No bookings yet for this workshop — pick another workshop or book first.</div>}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: muted, marginBottom: '8px' }}>RATE THE SERVICE • REQUIRED • 1-5 stars</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: soft, border: `1.5px solid ${cardBorder}`, borderRadius: '12px', padding: '10px 14px' }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} className="star-btn" onMouseEnter={() => setForm({ ...form, hover: n })} onMouseLeave={() => setForm({ ...form, hover: 0 })} onClick={() => setForm({ ...form, rating: n })}>
                      <i className={`bi ${(form.hover || form.rating) >= n ? "bi-star-fill" : "bi-star"}`} style={{ color: (form.hover || form.rating) >= n ? "#F59E0B" : "#CBD5E1", fontSize: '28px' }}></i>
                    </button>
                  ))}
                  <span style={{ marginLeft: '10px', fontWeight: 900, fontSize: '16px', color: text }}>{form.rating ? `${form.rating}.0 • ${sentimentFromRating(form.rating)}` : "Tap to rate"}</span>
                </div>
                {form.shop && form.rating > 0 && <div style={{ fontSize: '12px', color: muted, marginTop: '6px' }}>This will update <b style={{ color: text }}>{form.shop}</b> overall to approx <b style={{ color: '#F59E0B' }}>{workshopAccumulated[form.shop]?.accumulated}</b> (accumulated)</div>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><div style={{ fontSize: '12px', fontWeight: 800, color: muted, marginBottom: '6px' }}>REMARK TITLE</div><input className="rk-input" placeholder="e.g. Perfect brake job!" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div><div style={{ fontSize: '12px', fontWeight: 800, color: muted, marginBottom: '6px' }}>RECOMMEND?</div>
                  <div style={{ height: '46px', display: 'flex', gap: '8px' }}>
                    <button onClick={() => setForm({ ...form, recommend: true })} style={{ flex: 1, borderRadius: '12px', border: `1.5px solid ${form.recommend ? text : cardBorder}`, background: form.recommend ? text : cardBg, color: form.recommend ? "#fff" : text, fontWeight: 800, fontSize: '13px', cursor: "pointer" }}>Yes • Recommend</button>
                    <button onClick={() => setForm({ ...form, recommend: false })} style={{ flex: 1, borderRadius: '12px', border: `1.5px solid ${!form.recommend ? "#EF4444" : cardBorder}`, background: !form.recommend ? "#FEE2E2" : cardBg, color: !form.recommend ? "#991B1B" : text, fontWeight: 800, fontSize: '13px', cursor: "pointer" }}>No</button>
                  </div>
                </div>
              </div>
              <div><div style={{ fontSize: '12px', fontWeight: 800, color: muted, marginBottom: '6px' }}>TAGS • What was good/bad</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {["Quality", "Timely", "Price", "Communication", "Professionalism", "Cleanliness"].map(t => (
                    <button key={t} className={`tag-pill ${form.tags.includes(t) ? "on" : ""}`} onClick={() => toggleTag(t)}>{t}</button>
                  ))}
                </div>
              </div>
              <div><div style={{ fontSize: '12px', fontWeight: 800, color: muted, marginBottom: '6px' }}>YOUR REMARK • Positive or Negative • Required</div>
                <textarea className="rk-textarea" placeholder="Describe the service experience, mechanic name, what was fixed, any issues..." value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })}></textarea>
              </div>
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '12px', fontSize: '12px', color: '#92400E', fontWeight: 500 }}>
                <i className="bi bi-info-circle me-1"></i> Your service rating contributes to workshop overall rating. It is saved to the workshop's reviews.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleSubmit} disabled={saving} style={{ flex: 1, height: '48px', borderRadius: '12px', background: text, color: '#fff', border: `1.5px solid ${text}`, fontWeight: 800, fontSize: '14px', cursor: "pointer" }}><i className="bi bi-send-fill me-2"></i>{saving ? "Submitting…" : "Submit Remark"}</button>
                <button onClick={() => setShowNew(false)} style={{ height: '48px', borderRadius: '12px', background: cardBg, color: text, border: `1.5px solid ${cardBorder}`, fontWeight: 800, fontSize: '14px', padding: '0 18px', cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="rk-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="rk-modal" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px', borderBottom: `1.5px solid ${cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: soft }}>
              <div><div style={{ fontWeight: 900, fontSize: '18px', color: text }}>{selected.id} • {selected.shop}</div><div style={{ fontSize: '12px', color: muted }}>{selected.service} • {selected.serviceId} • {selected.dateLabel} • ${selected.cost}</div></div>
              <button onClick={() => setSelected(null)} style={{ width: '36px', height: '36px', borderRadius: '10px', border: `1.5px solid ${cardBorder}`, background: cardBg, cursor: 'pointer' }}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={{ padding: '18px', display: 'grid', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ display: 'flex', gap: '3px' }}>{[1, 2, 3, 4, 5].map(i => <Star key={i} filled={i <= selected.rating} size={18} />)}</span>
                <span style={{ fontWeight: 900, fontSize: '16px', color: text }}>{selected.rating}.0</span>
                <span className={`badge ${selected.sentiment.toLowerCase()}`} style={{ fontSize: '12px' }}>{selected.sentiment.toUpperCase()}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: muted }}>{selected.recommend ? "✔ Recommends" : "✖ Not recommend"}</span>
              </div>
              <div style={{ fontWeight: 900, fontSize: '16px', color: text }}>{selected.title}</div>
              <div style={{ background: soft, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '14px', fontSize: '14px', color: text, lineHeight: 1.6, fontWeight: 500 }}>{selected.comment}</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{selected.tags?.map(t => <span key={t} style={{ fontSize: '11px', fontWeight: 700, background: cardBg, border: `1px solid ${cardBorder}`, padding: '6px 10px', borderRadius: '20px' }}>{t}</span>)}</div>
              <div style={{ fontSize: '12px', color: muted }}>This rating contributed to <b style={{ color: text }}>{selected.shop}</b> overall: <b style={{ color: '#F59E0B' }}>{workshopAccumulated[selected.shop]?.accumulated} ★</b> (accumulated from {workshopAccumulated[selected.shop]?.totalReviews + workshopAccumulated[selected.shop]?.myCount} reviews)</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => markHelpful(selected)} style={{ flex: 1, height: '46px', borderRadius: '12px', background: cardBg, border: `1.5px solid ${cardBorder}`, color: text, fontWeight: 800, fontSize: '13px', cursor: "pointer" }}><i className="bi bi-hand-thumbs-up me-1"></i> Helpful ({selected.helpful})</button>
                <button onClick={() => setSelected(null)} style={{ flex: 1, height: '46px', borderRadius: '12px', background: text, color: '#fff', border: `1.5px solid ${text}`, fontWeight: 800, fontSize: '13px', cursor: "pointer" }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}