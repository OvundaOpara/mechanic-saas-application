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
function fmtLabel(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(String(dateStr).slice(0, 10) + "T12:00:00");
  if (isNaN(d)) return String(dateStr).slice(0, 10);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}
function mapStatus(s) {
  const v = String(s || "").toLowerCase();
  if (["completed", "done", "finished"].includes(v)) return "Completed";
  if (v.includes("progress") || v === "in_progress") return "In Progress";
  if (["cancelled", "canceled", "rejected"].includes(v)) return "Cancelled";
  if (["pending", "confirmed", "upcoming", "scheduled", "accepted"].includes(v)) return "Upcoming";
  return "Completed";
}

// --- Minimal PDF builder (no library needed) ---
function makePdfBlob(lines) {
  const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7E]/g, "");
  let y = 760;
  let stream = "";
  lines.forEach(({ text, size = 11, gap = 18 }) => {
    let t = esc(text);
    // wrap long lines at ~95 chars so nothing runs off the page
    const chunks = [];
    while (t.length > 95) { chunks.push(t.slice(0, 95)); t = t.slice(95); }
    chunks.push(t);
    chunks.forEach((chunk) => {
      stream += `BT /F1 ${size} Tf 50 ${y} Td (${chunk}) Tj ET\n`;
      y -= gap;
    });
  });
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((obj, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { pdf += `${String(o).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export default function OwnerHistoryPage({ C, isDark }) {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(5);
  const [selected, setSelected] = useState(null);
  const [rateStars, setRateStars] = useState(5);
  const [rateComment, setRateComment] = useState("");
  const [ratingSaving, setRatingSaving] = useState(false);

  const load = async () => {
    const ownerId = getOwnerId();
    if (!ownerId) { setError("Please log in again to see your history."); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [bRes, jRes, cRes, rRes] = await Promise.allSettled([
        fetch(`${API}/bookings?owner_id=${ownerId}&limit=200`),
        fetch(`${API}/bookings/jobs?owner_id=${ownerId}&limit=200`),
        fetch(`${API}/bookings/cars?owner_id=${ownerId}`),
        fetch(`${API}/admin/reviews?owner_id=${ownerId}&limit=200`),
      ]);
      const bookings = bRes.status === "fulfilled" && bRes.value.ok ? await bRes.value.json().catch(() => []) : [];
      const jobs = jRes.status === "fulfilled" && jRes.value.ok ? await jRes.value.json().catch(() => []) : [];
      const cars = cRes.status === "fulfilled" && cRes.value.ok ? await cRes.value.json().catch(() => []) : [];
      const reviews = rRes.status === "fulfilled" && rRes.value.ok ? await rRes.value.json().catch(() => []) : [];
      const bArr = Array.isArray(bookings) ? bookings : (bookings.bookings || bookings.data || []);
      const jArr = Array.isArray(jobs) ? jobs : (jobs.jobs || jobs.data || []);
      const cArr = Array.isArray(cars) ? cars : (cars.cars || cars.data || []);
      const rArr = Array.isArray(reviews) ? reviews : (reviews.reviews || reviews.data || []);

      const jobByBooking = {};
      jArr.forEach(j => { if (j.booking_id) jobByBooking[String(j.booking_id)] = j; });
      const carById = {};
      cArr.forEach(c => { carById[String(c.id)] = c; });
      const reviewByBooking = {};
      const reviewByWorkshop = {};
      rArr.forEach(r => {
        if (r.booking_id) reviewByBooking[String(r.booking_id)] = r;
        if (r.workshop_id) reviewByWorkshop[String(r.workshop_id)] = r;
      });

      const mapped = bArr.map(b => {
        const job = jobByBooking[String(b.id)] || null;
        const car = carById[String(b.car_id)] || null;
        const rev = reviewByBooking[String(b.id)] || reviewByWorkshop[String(b.workshop_id)] || null;
        const carLabel = [b.car_make, b.car_model, b.car_year].filter(Boolean).join(" ") || b.vehicle || b.car || "—";
        const plate = b.plate || b.license_plate || car?.license_plate || car?.plate || "";
        const cost = Number(b.amount ?? b.price ?? 0);
        return {
          _dbId: b.id,
          id: `#AV-${b.id}`,
          date: String(b.booking_date || "").slice(0, 10),
          dateLabel: fmtLabel(b.booking_date),
          car: plate ? `${carLabel} • ${plate}` : carLabel,
          shop: b.workshop_name || b.shop || "Workshop",
          shopAddr: b.workshop_address || b.address || "",
          workshop_id: b.workshop_id,
          service: b.service_type || b.service || "Service",
          cost,
          status: mapStatus(b.status),
          rating: rev ? Number(rev.rating || 0) : 0,
          reviewId: rev?.id || null,
          mechanic: job?.mechanic || b.mechanic || b.mechanic_name || "—",
          mileage: car?.mileage ? `${Number(car.mileage).toLocaleString()} mi` : "—",
          parts: [{ name: b.service_type || "Service", price: cost }],
          notes: job?.remarks || b.description || b.note || "",
          photos: [job?.image_url, b.image_url].filter(Boolean),
          progress: job?.progress ?? 0,
          raw: b,
        };
      });
      setHistoryData(mapped);
    } catch (e) {
      setError(e.message === "Failed to fetch" ? "Cannot reach backend at http://127.0.0.1:5000 — is 'py app.py' running?" : e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(0); }, [search, fromDate, toDate, sort, perPage]);
  useEffect(() => { if (selected) { setRateStars(selected.rating || 5); setRateComment(""); } }, [selected]);

  const filtered = useMemo(() => {
    let d = [...historyData];
    if (search) {
      const s = search.toLowerCase();
      d = d.filter(h => `${h.id} ${h.car} ${h.shop} ${h.service}`.toLowerCase().includes(s));
    }
    if (fromDate) d = d.filter(h => new Date(h.date) >= new Date(fromDate));
    if (toDate) d = d.filter(h => new Date(h.date) <= new Date(toDate));
    if (sort === "newest") d.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sort === "oldest") d.sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sort === "costHigh") d.sort((a, b) => b.cost - a.cost);
    if (sort === "costLow") d.sort((a, b) => a.cost - b.cost);
    return d;
  }, [historyData, search, fromDate, toDate, sort]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice(page * perPage, page * perPage + perPage);

  const submitRating = async () => {
    if (!selected) return;
    const ownerId = getOwnerId();
    setRatingSaving(true);
    try {
      const payload = { workshop_id: selected.workshop_id, owner_id: ownerId, booking_id: selected._dbId, rating: rateStars, comment: rateComment, review: rateComment };
      let res = await fetch(`${API}/admin/reviews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) res = await fetch(`${API}/reviews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setHistoryData(prev => prev.map(h => h._dbId === selected._dbId ? { ...h, rating: rateStars } : h));
      setSelected(prev => prev ? { ...prev, rating: rateStars } : prev);
      Swal.fire("Thanks!", "Your rating was saved.", "success");
    } catch (e) { Swal.fire("Could not save rating", e.message, "error"); }
    setRatingSaving(false);
  };

  // --- PDF INVOICE ---
  const downloadInvoicePDF = () => {
    if (!selected) return;
    const lines = [
      { text: "AutoVille - Invoice", size: 18, gap: 26 },
      { text: `Job: ${selected.id}`, size: 12, gap: 20 },
      { text: `Date: ${selected.dateLabel}`, size: 11 },
      { text: `Shop: ${selected.shop}`, size: 11 },
      { text: `Address: ${selected.shopAddr || "-"}`, size: 11 },
      { text: `Car: ${selected.car}`, size: 11 },
      { text: `Mileage: ${selected.mileage}`, size: 11 },
      { text: `Service: ${selected.service}`, size: 11 },
      { text: `Mechanic: ${selected.mechanic}`, size: 11 },
      { text: `Status: ${selected.status}`, size: 11 },
      { text: "----------------------------------------", size: 11, gap: 20 },
      { text: `${selected.service} - $${selected.cost}`, size: 12, gap: 22 },
      { text: `Total Paid: $${selected.cost}`, size: 13, gap: 24 },
      { text: "Thank you for using AutoVille.", size: 11 },
    ];
    const blob = makePdfBlob(lines);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `invoice-${selected.id.replace("#", "")}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };


  const cardBg = C?.card || "#fff";
  const cardBorder = C?.cardBorder || "#E2E8F0";
  const text = C?.text || "#0A192F";
  const muted = C?.muted || "#6B7A90";
  const soft = C?.soft || "#F8FAFC";
  const badgeClass = (s) => s === "Completed" ? "completed" : s === "In Progress" ? "progress" : s === "Cancelled" ? "cancelled" : "upcoming";
  const totalSpent = filtered.filter(h => h.status === "Completed").reduce((a, h) => a + h.cost, 0);

  return (
    <>
      <style>{`
        .h-toolbar{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:18px; padding:16px; display:flex; gap:12px; flex-wrap:wrap; align-items:center; justify-content:space-between; margin-bottom:16px; }
        .h-search{ flex:1; min-width:240px; position:relative; }
        .h-search input{ width:100%; height:48px; border:1.5px solid ${cardBorder}; border-radius:12px; padding:0 14px 0 42px; font-size:15px; font-weight:600; background:${soft}; color:${text}; outline:none; }
        .h-search i{ position:absolute; left:14px; top:50%; transform:translateY(-50%); color:${muted}; font-size:16px; }
        .h-filter{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
        .h-filter input, .h-filter select{ height:48px; border:1.5px solid ${cardBorder}; border-radius:12px; padding:0 14px; font-size:14px; font-weight:700; background:${soft}; color:${text}; }
        .h-table-wrap{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:18px; overflow:hidden; }
        .h-table{ width:100%; border-collapse:collapse; }
        .h-table th{ text-align:left; font-size:13px; font-weight:900; letter-spacing:0.06em; color:${muted}; padding:16px 14px; border-bottom:1.5px solid ${cardBorder}; background:${soft}; text-transform:uppercase; white-space:nowrap; }
        .h-table td{ padding:16px 14px; font-size:15px; font-weight:600; color:${text}; border-bottom:1px solid ${cardBorder}; vertical-align:middle; line-height:1.4; }
        .h-table tr:last-child td{ border-bottom:none; }
        .h-table tr:hover td{ background:${soft}; }
        .badge{ font-size:12px; font-weight:800; padding:6px 12px; border-radius:20px; letter-spacing:0.05em; }
        .badge.completed{ background:#DCFCE7; color:#166534; }
        .badge.progress{ background:#FEF3C7; color:#92400E; }
        .badge.cancelled{ background:#FEE2E2; color:#991B1B; }
        .badge.upcoming{ background:#DBEAFE; color:#1E40AF; }
        .btn-view{ height:38px; border-radius:11px; border:1.5px solid ${text}; background:${text}; color:#fff; font-weight:800; font-size:13.5px; padding:0 16px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; }
        .h-mobile{ display:none; }
        @media(max-width: 768px){
          .h-table-wrap{ display:none; }
          .h-mobile{ display:grid; gap:12px; }
          .h-mcard{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:16px; padding:16px; }
          .h-toolbar{ flex-direction:column; align-items:stretch; }
          .h-search{ min-width:100%; }
        }
        .h-modal-backdrop{ position:fixed; inset:0; background:rgba(10,25,47,0.55); backdrop-filter:blur(6px); z-index:99; display:grid; place-items:center; padding:16px; }
        .h-modal{ width:100%; max-width:740px; max-height:90vh; overflow:auto; background:${cardBg}; border:2px solid ${text}; border-radius:22px; box-shadow:0 30px 80px rgba(0,0,0,0.25); }
        .h-pag{ display:flex; justify-content:space-between; align-items:center; padding:14px 16px; border-top:1.5px solid ${cardBorder}; background:${soft}; flex-wrap:wrap; gap:10px; }
        .h-pag button{ height:40px; border-radius:11px; border:1.5px solid ${cardBorder}; background:${cardBg}; font-weight:800; font-size:13px; padding:0 14px; cursor:pointer; color:${text}; }
        .h-pag button:disabled{ opacity:0.4; cursor:not-allowed; }
        .h-pag .active{ background:${text}; color:#fff; border-color:${text}; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontWeight: 900, fontSize: '30px', color: text, margin: '0 0 6px', letterSpacing: '-0.03em' }}>Service History</h2>
          <p style={{ color: muted, fontSize: '15px', margin: 0, fontWeight: 500 }}>All bookings, invoices & shops • {filtered.length} of {historyData.length} jobs • Total spent (completed): ${totalSpent.toFixed(0)}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: muted }}>SHOW</span>
          <select value={perPage} onChange={e => setPerPage(Number(e.target.value))} style={{ height: '40px', borderRadius: '11px', border: `1.5px solid ${cardBorder}`, background: cardBg, color: text, fontWeight: 800, fontSize: '14px', padding: '0 12px' }}>
            <option value={5}>5 per page</option><option value={10}>10 per page</option><option value={20}>20 per page</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#991B1B", borderRadius: 12, padding: 12, marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{error}</span>
          <button onClick={load} style={{ background: "#991B1B", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontWeight: 800, cursor: "pointer" }}>Retry</button>
        </div>
      )}

      <div className="h-toolbar">
        <div className="h-search"><i className="bi bi-search"></i><input placeholder="Search car, shop, service, job ID..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="h-filter">
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <span style={{ fontWeight: 800, fontSize: '13px', color: muted }}>TO</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="costHigh">Cost High → Low</option>
            <option value="costLow">Cost Low → High</option>
          </select>
          {(search || fromDate || toDate) && <button onClick={() => { setSearch(""); setFromDate(""); setToDate(""); }} style={{ height: '48px', borderRadius: '12px', border: `1.5px solid ${cardBorder}`, background: cardBg, fontWeight: 800, fontSize: '13px', padding: '0 16px', cursor: 'pointer', color: text }}>Clear</button>}
        </div>
      </div>

      <div className="h-table-wrap">
        <table className="h-table">
          <thead>
            <tr><th>Job ID</th><th>Date</th><th>Car • Plate</th><th>Shop</th><th>Service</th><th>Cost</th><th>Status</th><th>Rating</th><th>Action</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: muted }}>Loading history…</td></tr>
              : paged.length === 0 ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: muted, fontSize: '15px' }}>No records found for selected filters</td></tr> :
                paged.map(h => (
                  <tr key={h.id}>
                    <td style={{ fontWeight: 900, fontSize: '14px' }}>{h.id}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '14px' }}>{h.dateLabel}</td>
                    <td style={{ fontSize: '14px', maxWidth: '200px' }}>{h.car}</td>
                    <td style={{ fontSize: '14px' }}>{h.shop}</td>
                    <td style={{ fontSize: '14px', fontWeight: 700 }}>{h.service}</td>
                    <td style={{ fontWeight: 900, fontSize: '15px' }}>${h.cost}</td>
                    <td><span className={`badge ${badgeClass(h.status)}`}>{h.status.toUpperCase()}</span></td>
                    <td>{h.status === "Completed" ? <span style={{ color: '#F59E0B', fontWeight: 800, fontSize: '14px' }}><i className="bi bi-star-fill"></i> {h.rating || "—"}</span> : <span style={{ color: muted, fontSize: '13px' }}>—</span>}</td>
                    <td><button className="btn-view" onClick={() => setSelected(h)}><i className="bi bi-eye"></i> View</button></td>
                  </tr>
                ))}
          </tbody>
        </table>
        <div className="h-pag">
          <div style={{ fontSize: '14px', fontWeight: 700, color: muted }}>{filtered.length === 0 ? 0 : page * perPage + 1}–{Math.min((page + 1) * perPage, filtered.length)} of {filtered.length} • Page {page + 1}/{totalPages || 1}</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}><i className="bi bi-chevron-left"></i> Prev</button>
            {Array.from({ length: totalPages }).slice(0, 5).map((_, i) => (<button key={i} className={i === page ? "active" : ""} onClick={() => setPage(i)}>{i + 1}</button>))}
            {totalPages > 5 && <span style={{ fontSize: '13px', color: muted }}>...{totalPages}</span>}
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>Next <i className="bi bi-chevron-right"></i></button>
          </div>
        </div>
      </div>

      <div className="h-mobile">
        {paged.map(h => (
          <div key={h.id} className="h-mcard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <b style={{ fontSize: '15px', color: text }}>{h.id} • {h.dateLabel}</b>
              <span className={`badge ${badgeClass(h.status)}`}>{h.status}</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: text, marginBottom: '6px' }}>{h.service}</div>
            <div style={{ fontSize: '13px', color: muted, marginBottom: '12px' }}>{h.car} • {h.shop}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b style={{ color: text, fontSize: '16px' }}>${h.cost}</b>
              <button className="btn-view" onClick={() => setSelected(h)}><i className="bi bi-eye"></i> View Detail</button>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
          <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} style={{ height: '44px', borderRadius: '12px', border: `1.5px solid ${cardBorder}`, background: cardBg, fontWeight: 800, fontSize: '14px', padding: '0 18px' }}>Prev</button>
          <span style={{ fontSize: '14px', fontWeight: 700, color: muted, alignSelf: 'center' }}>{page + 1}/{totalPages || 1}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} style={{ height: '44px', borderRadius: '12px', border: `1.5px solid ${cardBorder}`, background: cardBg, fontWeight: 800, fontSize: '14px', padding: '0 18px' }}>Next</button>
        </div>
      </div>

      {selected && (
        <div className="h-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="h-modal" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px', borderBottom: `1.5px solid ${cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: soft }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '18px', color: text }}>{selected.id} • {selected.service}</div>
                <div style={{ fontSize: '13px', color: muted, fontWeight: 600, marginTop: '4px' }}>{selected.dateLabel} • {selected.shopAddr} • {selected.mileage}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ width: '40px', height: '40px', borderRadius: '12px', border: `1.5px solid ${cardBorder}`, background: cardBg, cursor: 'pointer', fontSize: '16px' }}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={{ padding: '20px', display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: soft, border: `1px solid ${cardBorder}`, borderRadius: '14px', padding: '14px' }}><div style={{ fontSize: '11px', fontWeight: 900, color: muted, letterSpacing: '0.08em' }}>CAR</div><div style={{ fontWeight: 800, fontSize: '15px', color: text, marginTop: '6px' }}>{selected.car}</div></div>
                <div style={{ background: soft, border: `1px solid ${cardBorder}`, borderRadius: '14px', padding: '14px' }}><div style={{ fontSize: '11px', fontWeight: 900, color: muted }}>SHOP • MECHANIC</div><div style={{ fontWeight: 800, fontSize: '14px', color: text, marginTop: '6px' }}>{selected.shop}</div><div style={{ fontSize: '13px', color: muted, marginTop: '2px' }}>{selected.mechanic}</div></div>
              </div>

              <div>
                <h4 style={{ fontWeight: 900, fontSize: '15px', color: text, margin: '0 0 10px' }}><i className="bi bi-tools me-1"></i> Invoice</h4>
                <div style={{ background: cardBg, border: `1.5px solid ${cardBorder}`, borderRadius: '14px', overflow: 'hidden' }}>
                  {selected.parts.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderBottom: `1px solid ${cardBorder}`, fontSize: '14px', fontWeight: 600 }}>
                      <span>{p.name}</span><b>${p.price}</b>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px', fontWeight: 900, fontSize: '16px', background: soft }}><span>Total Paid</span><b>${selected.cost}</b></div>
                </div>
              </div>

              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '14px', padding: '14px', fontSize: '14px', color: '#92400E', fontWeight: 500, lineHeight: 1.5 }}>
                <i className="bi bi-info-circle me-1"></i> <b>Mechanic Note:</b> {selected.notes || "No notes for this job."}
              </div>

              {selected.photos.length > 0 && (
                <div>
                  <h4 style={{ fontWeight: 900, fontSize: '14px', color: text, margin: '0 0 10px' }}><i className="bi bi-camera me-1"></i> Photos from shop</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {selected.photos.map((ph, i) => <div key={i} style={{ height: '130px', borderRadius: '14px', backgroundImage: `url(${ph})`, backgroundSize: 'cover', backgroundPosition: 'center', border: `1.5px solid ${cardBorder}` }}></div>)}
                  </div>
                </div>
              )}

              {selected.status === "Completed" && (
                <div style={{ background: soft, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 14 }}>
                  <div style={{ fontWeight: 900, fontSize: 14, color: text, marginBottom: 8 }}>Rate this service {selected.rating ? `(You rated ${selected.rating}★)` : ""}</div>
                  <div style={{ display: "flex", gap: 6, fontSize: 24, cursor: "pointer" }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <span key={n} onClick={() => setRateStars(n)} style={{ color: n <= rateStars ? "#F59E0B" : "#CBD5E1" }}>★</span>
                    ))}
                  </div>
                  <textarea value={rateComment} onChange={e => setRateComment(e.target.value)} placeholder="Tell the shop how it went (optional)" style={{ width: "100%", minHeight: 60, marginTop: 10, borderRadius: 10, border: `1.5px solid ${cardBorder}`, padding: 10, boxSizing: "border-box" }} />
                  <button onClick={submitRating} disabled={ratingSaving} style={{ marginTop: 10, height: 40, borderRadius: 10, background: text, color: "#fff", border: "none", fontWeight: 800, padding: "0 16px", cursor: "pointer" }}>{ratingSaving ? "Saving..." : "Submit Rating"}</button>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={downloadInvoicePDF} style={{ flex: 1, height: '48px', borderRadius: '14px', border: `1.5px solid ${text}`, background: text, color: '#fff', fontWeight: 800, fontSize: '14px', cursor: "pointer" }}><i className="bi bi-file-earmark-pdf me-1"></i> Download Invoice (PDF)</button>
                <button style={{ flex: 1, height: '48px', borderRadius: '14px', border: `1.5px solid ${cardBorder}`, background: cardBg, color: text, fontWeight: 800, fontSize: '14px', cursor: "pointer" }} onClick={() => setSelected(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}