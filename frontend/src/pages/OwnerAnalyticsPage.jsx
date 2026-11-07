import { useState, useMemo, useEffect } from "react";

const API = "http://127.0.0.1:5000/api";
const FALLBACK_IMG = "https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=400&q=80";

function getOwnerId() {
  try {
    const raw = localStorage.getItem("autoville_user") || localStorage.getItem("autoville_owner") || "{}";
    const u = JSON.parse(raw);
    return u.id || u.owner_id || u.user_id || u.ownerId || null;
  } catch { return null; }
}
function fmtLabel(d) {
  if (!d) return "—";
  const dt = new Date(String(d).slice(0, 10) + "T12:00:00");
  if (isNaN(dt)) return String(d).slice(0, 10);
  return dt.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}
function last6Months() {
  const out = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      m: d.toLocaleDateString("en-US", { month: "short" }),
      label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      spend: 0,
    });
  }
  return out;
}
function normCategory(service) {
  const s = String(service || "").toLowerCase();
  if (s.includes("brake")) return "Brakes";
  if (s.includes("oil") || s.includes("fluid")) return "Oil & Fluids";
  if (s.includes("diagnos")) return "Diagnostics";
  if (s.includes("tire") || s.includes("tyre") || s.includes("wheel")) return "Tires";
  if (s.includes("ac") || s.includes("air con")) return "AC";
  if (s.includes("battery")) return "Battery";
  if (s.includes("cool") || s.includes("radiator")) return "Cooling";
  if (s.includes("engine")) return "Engine";
  return service || "Service";
}
function calcHealth(lastDate) {
  if (!lastDate) return 100;
  const last = new Date(String(lastDate).slice(0, 10));
  if (isNaN(last)) return 85;
  const monthsSince = Math.max(0, (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24 * 30));
  return Math.max(65, Math.min(98, Math.round(100 - monthsSince * 4)));
}
// Minimal PDF builder (no library)
function makePdfBlob(lines) {
  const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7E]/g, "");
  let y = 760; let stream = "";
  lines.forEach(({ text, size = 11, gap = 18 }) => {
    let t = esc(text);
    const chunks = [];
    while (t.length > 95) { chunks.push(t.slice(0, 95)); t = t.slice(95); }
    chunks.push(t);
    chunks.forEach((c) => { stream += `BT /F1 ${size} Tf 50 ${y} Td (${c}) Tj ET\n`; y -= gap; });
  });
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n"; const offs = [];
  objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offs.forEach((o) => { pdf += `${String(o).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export default function OwnerAnalyticsPage({ C, isDark }) {
  const [bookings, setBookings] = useState([]);
  const [carsRaw, setCarsRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const perPage = 4;
  const [selectedCar, setSelectedCar] = useState(null);

  const load = async () => {
    const ownerId = getOwnerId();
    if (!ownerId) { setError("Please log in again to see analytics."); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [bRes, cRes] = await Promise.allSettled([
        fetch(`${API}/bookings?owner_id=${ownerId}&limit=200`),
        fetch(`${API}/bookings/cars?owner_id=${ownerId}`),
      ]);
      const bData = bRes.status === "fulfilled" && bRes.value.ok ? await bRes.value.json().catch(() => []) : [];
      const cData = cRes.status === "fulfilled" && cRes.value.ok ? await cRes.value.json().catch(() => []) : [];
      setBookings(Array.isArray(bData) ? bData : (bData.bookings || bData.data || []));
      setCarsRaw(Array.isArray(cData) ? cData : (cData.cars || cData.data || []));
    } catch (e) {
      setError(e.message === "Failed to fetch" ? "Cannot reach backend at http://127.0.0.1:5000 — is 'py app.py' running?" : e.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // --- Derived analytics ---
  const valid = useMemo(() => bookings.filter(b => String(b.status || "").toLowerCase() !== "cancelled" && String(b.status || "").toLowerCase() !== "canceled"), [bookings]);
  const completed = useMemo(() => bookings.filter(b => ["completed", "done", "finished"].includes(String(b.status || "").toLowerCase())), [bookings]);

  const totalSpent = useMemo(() => valid.reduce((a, b) => a + Number(b.amount || 0), 0), [valid]);
  const jobsDone = completed.length;
  const avgCost = jobsDone ? totalSpent / Math.max(1, valid.length) : 0;

  const months = useMemo(() => {
    const m = last6Months();
    valid.forEach(b => {
      if (!b.booking_date) return;
      const key = String(b.booking_date).slice(0, 7);
      const hit = m.find(x => x.key === key);
      if (hit) hit.spend += Number(b.amount || 0);
    });
    return m;
  }, [valid]);
  const max = Math.max(1, ...months.map(x => x.spend));

  const favShop = useMemo(() => {
    if (!valid.length) return null;
    const counts = {};
    valid.forEach(b => {
      const name = b.workshop_name || b.shop || "Workshop";
      if (!counts[name]) counts[name] = { name, count: 0, ratingSum: 0, ratingN: 0, addr: b.workshop_address || b.address || "" };
      counts[name].count += 1;
      if (b.workshop_rating) { counts[name].ratingSum += Number(b.workshop_rating); counts[name].ratingN += 1; }
    });
    const top = Object.values(counts).sort((a, b) => b.count - a.count)[0];
    return { ...top, avgRating: top.ratingN ? (top.ratingSum / top.ratingN).toFixed(1) : null };
  }, [valid]);

  const carsOwned = useMemo(() => {
    // Start from cars table, add bookings even if car row missing (orphan car_id)
    const byId = {};
    carsRaw.forEach(c => {
      byId[String(c.id)] = {
        id: `CAR-${c.id}`, _dbId: c.id,
        name: [c.make, c.model].filter(Boolean).join(" ") || "Car",
        year: c.year || "", plate: `${c.license_plate || c.plate || ""} ${c.state || ""}`.trim(),
        mileage: c.mileage ? `${Number(c.mileage).toLocaleString()} mi` : "—",
        image: c.image_url || FALLBACK_IMG,
        bookings: [],
      };
    });
    valid.forEach(b => {
      const key = String(b.car_id);
      if (!byId[key]) {
        byId[key] = {
          id: `CAR-${b.car_id}`, _dbId: b.car_id,
          name: [b.car_make, b.car_model].filter(Boolean).join(" ") || b.vehicle || "Car",
          year: b.car_year || "", plate: b.plate || b.license_plate || "",
          mileage: "—", image: FALLBACK_IMG, bookings: [],
        };
      }
      byId[key].bookings.push(b);
    });
    return Object.values(byId).map(car => {
      const bs = [...car.bookings].sort((a, b) => new Date(b.booking_date) - new Date(a.booking_date));
      const spent = bs.reduce((a, b) => a + Number(b.amount || 0), 0);
      const times = bs.length;
      const avg = times ? spent / times : 0;
      const last = bs[0];
      const breakdownMap = {};
      bs.forEach(b => {
        const cat = normCategory(b.service_type || b.service);
        breakdownMap[cat] = (breakdownMap[cat] || 0) + Number(b.amount || 0);
      });
      return {
        ...car,
        health: calcHealth(last?.booking_date),
        totalSpent: spent, times, avgCost: Math.round(avg),
        lastService: last ? fmtLabel(last.booking_date) : "—",
        shop: last?.workshop_name || last?.shop || "—",
        history: bs.map(b => ({ date: fmtLabel(b.booking_date), service: b.service_type || b.service || "Service", cost: Number(b.amount || 0), shop: b.workshop_name || "—" })),
        breakdown: Object.entries(breakdownMap).map(([type, cost]) => ({ type, cost })),
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [carsRaw, valid]);

  const filteredCars = useMemo(() => {
    if (!search) return carsOwned;
    const s = search.toLowerCase();
    return carsOwned.filter(c => `${c.name} ${c.plate} ${c.year}`.toLowerCase().includes(s));
  }, [carsOwned, search]);

  const totalPages = Math.ceil(filteredCars.length / perPage);
  const pagedCars = filteredCars.slice(page * perPage, page * perPage + perPage);

  const downloadReport = () => {
    if (!selectedCar) return;
    const lines = [
      { text: "AutoVille - Car Analytics Report", size: 16, gap: 24 },
      { text: `${selectedCar.name} ${selectedCar.year}`, size: 13, gap: 20 },
      { text: `Plate: ${selectedCar.plate} | Mileage: ${selectedCar.mileage}`, size: 11 },
      { text: `Health: ${selectedCar.health}% | Total Spent: $${selectedCar.totalSpent}`, size: 11 },
      { text: `Jobs: ${selectedCar.times} | Avg Cost: $${selectedCar.avgCost} | Last Service: ${selectedCar.lastService}`, size: 11 },
      { text: "----------------------------------------", size: 11, gap: 20 },
      { text: "Spend by Category:", size: 12, gap: 20 },
      ...selectedCar.breakdown.map(b => ({ text: `${b.type} - $${b.cost}`, size: 11 })),
      { text: "----------------------------------------", size: 11, gap: 20 },
      { text: "Service History:", size: 12, gap: 20 },
      ...selectedCar.history.slice(0, 15).map(h => ({ text: `${h.date} - ${h.service} - $${h.cost} - ${h.shop}`, size: 10, gap: 16 })),
    ];
    const blob = makePdfBlob(lines);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `report-${selectedCar.id}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  const cardBg = C?.card || "#fff";
  const cardBorder = C?.cardBorder || "#E2E8F0";
  const text = C?.text || "#0A192F";
  const muted = C?.muted || "#6B7A90";
  const soft = C?.soft || "#F8FAFC";
  const monthRange = months.length ? `${months[0].label} - ${months[months.length - 1].label}` : "";

  return (
    <>
      <style>{`
        *{ box-sizing:border-box; }
        .an-wrap{ width:100%; max-width:100%; overflow:hidden; }
        .an-stat{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:18px; padding:18px; height:100%; }
        .an-stat .label{ font-size:12px; font-weight:800; color:${muted}; letter-spacing:0.06em; text-transform:uppercase; }
        .an-stat .value{ font-weight:900; font-size:26px; color:${text}; margin-top:6px; }
        .an-stat .sub{ font-size:13px; color:${muted}; font-weight:600; margin-top:4px; }
        .an-chart{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:18px; padding:20px; width:100%; }
        .chart-bars{ display:flex; gap:12px; align-items:end; height:160px; margin-top:18px; width:100%; }
        .chart-bar{ flex:1; min-width:0; display:grid; gap:8px; justify-items:center; }
        .an-toolbar{ display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center; margin:18px 0 12px; width:100%; }
        .an-search{ position:relative; flex:1; min-width:200px; max-width:360px; }
        .an-search input{ width:100%; height:46px; border:1.5px solid ${cardBorder}; border-radius:12px; padding:0 14px 0 42px; font-size:15px; font-weight:600; background:${soft}; color:${text}; outline:none; }
        .an-search i{ position:absolute; left:14px; top:50%; transform:translateY(-50%); color:${muted}; font-size:16px; }
        .an-table-wrap{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:18px; overflow:hidden; width:100%; }
        .an-table{ width:100%; border-collapse:collapse; table-layout:fixed; }
        .an-table th{ text-align:left; font-size:12px; font-weight:900; color:${muted}; padding:14px 12px; border-bottom:1.5px solid ${cardBorder}; background:${soft}; text-transform:uppercase; }
        .an-table th:nth-child(1){ width:36%; } .an-table th:nth-child(2){ width:20%; } .an-table th:nth-child(3){ width:14%; } .an-table th:nth-child(4){ width:16%; } .an-table th:nth-child(5){ width:14%; }
        .an-table td{ padding:14px 12px; font-size:14px; font-weight:600; color:${text}; border-bottom:1px solid ${cardBorder}; vertical-align:middle; overflow:hidden; }
        .an-table tr:last-child td{ border-bottom:none; }
        .an-table tr:hover td{ background:${soft}; }
        .car-cell{ display:flex; gap:10px; align-items:center; min-width:0; }
        .car-thumb{ width:44px; height:44px; border-radius:10px; background-size:cover; background-position:center; border:1.5px solid ${cardBorder}; flex-shrink:0; }
        .car-meta{ min-width:0; }
        .car-meta b{ display:block; font-size:15px; font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .car-meta span{ display:block; font-size:12.5px; color:${muted}; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .btn-view{ height:38px; border-radius:11px; border:1.5px solid ${text}; background:${text}; color:#fff; font-weight:800; font-size:13px; padding:0 14px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; white-space:nowrap; }
        .health-bar{ height:8px; background:${soft}; border-radius:10px; overflow:hidden; border:1px solid ${cardBorder}; width:100%; max-width:70px; }
        .health-fill{ height:100%; border-radius:10px; }
        .an-mobile{ display:none; }
        @media(max-width: 992px){
          .an-table th:nth-child(1){ width:40%; } .an-table th:nth-child(2){ width:22%; } .an-table th:nth-child(4){ display:none; } .an-table td:nth-child(4){ display:none; }
        }
        @media(max-width: 768px){
          .an-table-wrap.desktop{ display:none; }
          .an-mobile{ display:grid; gap:12px; }
          .an-mcard{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:16px; padding:16px; width:100%; }
          .an-toolbar{ flex-direction:column; align-items:stretch; }
          .an-search{ max-width:100%; }
          .chart-bars{ gap:8px; }
        }
        .an-modal-backdrop{ position:fixed; inset:0; background:rgba(10,25,47,0.55); backdrop-filter:blur(6px); z-index:99; display:grid; place-items:center; padding:16px; }
        .an-modal{ width:100%; max-width:800px; max-height:92vh; overflow:auto; background:${cardBg}; border:2px solid ${text}; border-radius:22px; box-shadow:0 30px 80px rgba(0,0,0,0.25); }
        .an-modal-grid{ display:grid; grid-template-columns:1.2fr 0.8fr; gap:14px; }
        @media(max-width: 768px){ .an-modal-grid{ grid-template-columns:1fr; } }
      `}</style>

      <div className="an-wrap">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontWeight: 900, fontSize: '30px', color: text, margin: '0 0 6px', letterSpacing: '-0.03em' }}>Analytics</h2>
          <p style={{ color: muted, fontSize: '15px', margin: 0, fontWeight: 500 }}>Spending, jobs and favorite shops</p>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#991B1B", borderRadius: 12, padding: 12, marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{error}</span>
            <button onClick={load} style={{ background: "#991B1B", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontWeight: 800, cursor: "pointer" }}>Retry</button>
          </div>
        )}

        {loading ? <div style={{ padding: 40, textAlign: "center", color: muted, fontWeight: 700 }}>Loading analytics…</div> : (
          <>
            <div className="row g-3 mb-3" style={{ margin: 0, width: '100%' }}>
              <div className="col-6 col-lg-3"><div className="an-stat"><div className="label">Total Spent</div><div className="value">${totalSpent.toFixed(0)}</div><div className="sub">{valid.length} bookings • {jobsDone} completed</div></div></div>
              <div className="col-6 col-lg-3"><div className="an-stat"><div className="label">Jobs Done</div><div className="value">{jobsDone}</div><div className="sub">{carsOwned.length} cars • {valid.length} bookings</div></div></div>
              <div className="col-6 col-lg-3"><div className="an-stat"><div className="label">Avg Cost</div><div className="value">${avgCost.toFixed(0)}</div><div className="sub">per booking</div></div></div>
              <div className="col-6 col-lg-3"><div style={{ background: '#0A192F', borderRadius: '18px', padding: '18px', color: '#fff', height: '100%' }}><div style={{ fontSize: '11px', fontWeight: 800, color: '#94A3B8' }}>FAVORITE SHOP</div><div style={{ fontWeight: 900, fontSize: '16px', marginTop: '8px' }}>{favShop ? favShop.name : "—"}</div><div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>{favShop ? `${favShop.addr} • ${favShop.count} visits${favShop.avgRating ? ` • ${favShop.avgRating}★` : ""}` : "No bookings yet"}</div></div></div>
            </div>

            <div className="an-chart">
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <h6 style={{ fontWeight: 900, color: text, fontSize: '16px', margin: 0 }}><i className="bi bi-bar-chart-fill me-2" style={{ color: '#FF5722' }}></i>Monthly Spend</h6>
                <span style={{ fontSize: '11px', fontWeight: 800, color: muted, background: soft, border: `1px solid ${cardBorder}`, padding: '6px 10px', borderRadius: '20px' }}>{monthRange}</span>
              </div>
              <div className="chart-bars">
                {months.map(m => (
                  <div key={m.m + m.key} className="chart-bar">
                    <div style={{ fontSize: '12px', fontWeight: 800, color: text }}>${m.spend.toFixed(0)}</div>
                    <div style={{ width: '100%', background: soft, borderRadius: '10px', height: '100px', display: 'flex', alignItems: 'end', border: `1px solid ${cardBorder}`, overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: `${(m.spend / max) * 100}%`, background: '#0A192F', borderRadius: '10px 10px 0 0' }}></div>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: muted }}>{m.m}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="an-toolbar">
              <h3 style={{ fontWeight: 900, fontSize: '19px', color: text, margin: 0 }}>Cars Owned • {filteredCars.length} cars</h3>
              <div className="an-search"><i className="bi bi-search"></i><input placeholder="Search car, plate..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></div>
            </div>

            {filteredCars.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: muted, fontWeight: 700 }}>No cars found. Add a car from Cars page.</div>
            ) : (
              <>
                <div className="an-table-wrap desktop">
                  <table className="an-table">
                    <thead><tr><th>Car</th><th>Spent / Jobs</th><th>Health</th><th>Last Service</th><th>Action</th></tr></thead>
                    <tbody>
                      {pagedCars.map(car => (
                        <tr key={car.id}>
                          <td>
                            <div className="car-cell">
                              <div className="car-thumb" style={{ backgroundImage: `url(${car.image})` }}></div>
                              <div className="car-meta"><b>{car.name} {car.year}</b><span>{car.plate} • {car.mileage}</span></div>
                            </div>
                          </td>
                          <td><div style={{ fontWeight: 900, fontSize: '15px' }}>${car.totalSpent}</div><div style={{ fontSize: '12px', color: muted, fontWeight: 700 }}>{car.times} jobs • ${car.avgCost} avg</div></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="health-bar"><div className="health-fill" style={{ width: `${car.health}%`, background: car.health > 85 ? '#22C55E' : car.health > 70 ? '#F59E0B' : '#EF4444' }}></div></div>
                              <span style={{ fontSize: '13px', fontWeight: 800 }}>{car.health}%</span>
                            </div>
                          </td>
                          <td style={{ fontSize: '13px', fontWeight: 600 }}>{car.lastService}<div style={{ fontSize: '11px', color: muted }}>{car.shop}</div></td>
                          <td><button className="btn-view" onClick={() => setSelectedCar(car)}><i className="bi bi-graph-up"></i> View</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderTop: `1.5px solid ${cardBorder}`, background: soft, flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: muted }}>{page * perPage + 1}–{Math.min((page + 1) * perPage, filteredCars.length)} of {filteredCars.length} • Page {page + 1}/{totalPages || 1}</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} style={{ height: '38px', borderRadius: '10px', border: `1.5px solid ${cardBorder}`, background: cardBg, fontWeight: 800, fontSize: '13px', padding: '0 14px', cursor: 'pointer', color: text }}>Prev</button>
                      <button disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} style={{ height: '38px', borderRadius: '10px', border: `1.5px solid ${cardBorder}`, background: cardBg, fontWeight: 800, fontSize: '13px', padding: '0 14px', cursor: 'pointer', color: text }}>Next</button>
                    </div>
                  </div>
                </div>

                <div className="an-mobile">
                  {pagedCars.map(car => (
                    <div key={car.id} className="an-mcard">
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                        <div className="car-thumb" style={{ width: '52px', height: '52px', backgroundImage: `url(${car.image})` }}></div>
                        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 900, fontSize: '16px', color: text }}>{car.name}</div><div style={{ fontSize: '13px', color: muted }}>{car.plate} • {car.mileage}</div></div>
                        <b style={{ fontSize: '16px' }}>${car.totalSpent}</b>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, background: soft, border: `1px solid ${cardBorder}`, padding: '6px 10px', borderRadius: '20px' }}>{car.times} jobs • {car.health}% health</span>
                        <span style={{ fontSize: '11px', color: muted, alignSelf: 'center' }}>{car.lastService}</span>
                      </div>
                      <button className="btn-view" style={{ width: '100%', justifyContent: 'center', height: '44px' }} onClick={() => setSelectedCar(car)}><i className="bi bi-graph-up"></i> View Analytics</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {selectedCar && (
        <div className="an-modal-backdrop" onClick={() => setSelectedCar(null)}>
          <div className="an-modal" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px', borderBottom: `1.5px solid ${cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: soft, position: 'sticky', top: 0, zIndex: 2 }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '12px', backgroundImage: `url(${selectedCar.image})`, backgroundSize: 'cover', border: `2px solid ${text}`, flexShrink: 0 }}></div>
                <div style={{ minWidth: 0 }}><div style={{ fontWeight: 900, fontSize: '18px', color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedCar.name} {selectedCar.year}</div><div style={{ fontSize: '13px', color: muted, fontWeight: 600 }}>{selectedCar.plate} • {selectedCar.mileage} • {selectedCar.shop}</div></div>
              </div>
              <button onClick={() => setSelectedCar(null)} style={{ width: '40px', height: '40px', borderRadius: '10px', border: `1.5px solid ${cardBorder}`, background: cardBg, cursor: 'pointer' }}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={{ padding: '20px', display: 'grid', gap: '16px' }}>
              <div className="row g-3" style={{ margin: 0 }}>
                <div className="col-6 col-lg-3"><div style={{ background: soft, border: `1.5px solid ${cardBorder}`, borderRadius: '14px', padding: '14px' }}><div style={{ fontSize: '11px', fontWeight: 900, color: muted }}>TOTAL SPENT</div><div style={{ fontWeight: 900, fontSize: '22px', marginTop: '4px' }}>${selectedCar.totalSpent}</div><div style={{ fontSize: '12px', color: muted }}>Lifetime</div></div></div>
                <div className="col-6 col-lg-3"><div style={{ background: soft, border: `1.5px solid ${cardBorder}`, borderRadius: '14px', padding: '14px' }}><div style={{ fontSize: '11px', fontWeight: 900, color: muted }}>MAINTAINED</div><div style={{ fontWeight: 900, fontSize: '22px', marginTop: '4px' }}>{selectedCar.times} times</div><div style={{ fontSize: '12px', color: muted }}>Avg ${selectedCar.avgCost}</div></div></div>
                <div className="col-6 col-lg-3"><div style={{ background: soft, border: `1.5px solid ${cardBorder}`, borderRadius: '14px', padding: '14px' }}><div style={{ fontSize: '11px', fontWeight: 900, color: muted }}>HEALTH</div><div style={{ fontWeight: 900, fontSize: '22px', marginTop: '4px', color: selectedCar.health > 85 ? '#166534' : '#92400E' }}>{selectedCar.health}%</div><div className="health-bar" style={{ marginTop: '6px', maxWidth: '100%' }}><div className="health-fill" style={{ width: `${selectedCar.health}%`, background: selectedCar.health > 85 ? '#22C55E' : '#F59E0B' }}></div></div></div></div>
                <div className="col-6 col-lg-3"><div style={{ background: '#0A192F', borderRadius: '14px', padding: '14px', color: '#fff', height: '100%' }}><div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 800 }}>LAST SERVICE</div><div style={{ fontWeight: 900, fontSize: '14px', marginTop: '6px' }}>{selectedCar.lastService}</div><div style={{ fontSize: '11px', color: '#94A3B8' }}>{selectedCar.shop}</div></div></div>
              </div>

              <div className="an-modal-grid">
                <div style={{ background: cardBg, border: `1.5px solid ${cardBorder}`, borderRadius: '14px', padding: '14px' }}>
                  <h6 style={{ fontWeight: 900, fontSize: '14px', color: text, margin: '0 0 12px' }}><i className="bi bi-pie-chart-fill me-2" style={{ color: '#FF5722' }}></i>Spend by Category</h6>
                  {selectedCar.breakdown.length === 0 ? <div style={{ fontSize: 13, color: muted }}>No spend yet for this car.</div> :
                    selectedCar.breakdown.map(b => (
                      <div key={b.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{b.type}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '80px', height: '7px', background: soft, borderRadius: '10px', border: `1px solid ${cardBorder}`, overflow: 'hidden' }}><div style={{ width: `${selectedCar.totalSpent ? (b.cost / selectedCar.totalSpent) * 100 : 0}%`, height: '100%', background: '#0A192F' }}></div></div><b style={{ fontSize: '13px', minWidth: '40px', textAlign: 'right' }}>${b.cost}</b></div>
                      </div>
                    ))}
                </div>
                <div style={{ background: soft, border: `1.5px solid ${cardBorder}`, borderRadius: '14px', padding: '14px' }}>
                  <h6 style={{ fontWeight: 900, fontSize: '14px', color: text, margin: '0 0 12px' }}><i className="bi bi-clock-history me-1"></i> Service History</h6>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {selectedCar.history.length === 0 ? <div style={{ fontSize: 13, color: muted }}>No history yet.</div> :
                      selectedCar.history.map((h, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '10px' }}>
                          <div><div style={{ fontWeight: 800, fontSize: '13px', color: text }}>{h.service}</div><div style={{ fontSize: '11px', color: muted }}>{h.date} • {h.shop}</div></div>
                          <b style={{ fontSize: '13px' }}>${h.cost}</b>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={downloadReport} style={{ flex: 1, height: '46px', borderRadius: '12px', border: `1.5px solid ${text}`, background: text, color: '#fff', fontWeight: 800, fontSize: '13px', cursor: "pointer" }}><i className="bi bi-download me-1"></i> Download Report (PDF)</button>
                <button style={{ flex: 1, height: '46px', borderRadius: '12px', border: `1.5px solid ${cardBorder}`, background: cardBg, color: text, fontWeight: 800, fontSize: '13px', cursor: "pointer" }} onClick={() => setSelectedCar(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}