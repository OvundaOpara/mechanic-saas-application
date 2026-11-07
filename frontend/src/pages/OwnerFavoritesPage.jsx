import { useState, useMemo, useEffect } from "react";
import Swal from "sweetalert2";

const API = "http://127.0.0.1:5000/api";
const FALLBACK_IMG = "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=600&q=80";

function getOwnerId() {
  try {
    const raw = localStorage.getItem("autoville_user") || localStorage.getItem("autoville_owner") || "{}";
    const u = JSON.parse(raw);
    return u.id || u.owner_id || u.user_id || u.ownerId || null;
  } catch { return null; }
}
function parseExpertise(w) {
  const raw = w.specialties || w.services || w.expertise || w.categories;
  if (Array.isArray(raw)) return raw.filter(Boolean).slice(0, 4);
  if (typeof raw === "string" && raw.trim()) return raw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 4);
  return [];
}
function asArray(d) {
  if (Array.isArray(d)) return d;
  return d?.favorites || d?.data || d?.workshops || d?.bookings || d?.cars || d?.reviews || [];
}

export default function OwnerFavoritesPage({ C, isDark }) {
  const [favorites, setFavorites] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const [bookShop, setBookShop] = useState(null);
  const [bookForm, setBookForm] = useState({ car_id: "", service: "", date: "", time: "", description: "" });
  const [bookingSaving, setBookingSaving] = useState(false);
  const perPage = 4;

  const load = async () => {
    const ownerId = getOwnerId();
    if (!ownerId) { setError("Please log in again to see your favorites."); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      // 1) Favorites — try owner-scoped route first, then query route
      let favRaw = [];
      let favRes = await fetch(`${API}/owners/${ownerId}/favorites`);
      if (favRes.ok) { favRaw = asArray(await favRes.json().catch(() => [])); }
      else {
        const alt = await fetch(`${API}/favorites?owner_id=${ownerId}`);
        if (alt.ok) favRaw = asArray(await alt.json().catch(() => []));
        else if (favRes.status !== 404) {
          // keep empty, don't throw on 404 — means no favorites endpoint yet
          favRaw = [];
        }
      }

      const [wRes, bRes, cRes, rRes] = await Promise.allSettled([
        fetch(`${API}/workshops/available`),
        fetch(`${API}/bookings?owner_id=${ownerId}&limit=200`),
        fetch(`${API}/bookings/cars?owner_id=${ownerId}`),
        fetch(`${API}/admin/reviews?limit=200`),
      ]);
      const workshops = wRes.status === "fulfilled" && wRes.value.ok ? asArray(await wRes.value.json().catch(() => [])) : [];
      const bookings = bRes.status === "fulfilled" && bRes.value.ok ? asArray(await bRes.value.json().catch(() => [])) : [];
      const carsData = cRes.status === "fulfilled" && cRes.value.ok ? asArray(await cRes.value.json().catch(() => [])) : [];
      const reviews = rRes.status === "fulfilled" && rRes.value.ok ? asArray(await rRes.value.json().catch(() => [])) : [];
      setCars(carsData);

      // Index workshops by id
      const wById = {};
      workshops.forEach(w => { wById[String(w.id)] = w; });

      // Visits / spent per workshop from real bookings
      const statsByWorkshop = {};
      bookings.forEach(b => {
        if (["cancelled", "canceled"].includes(String(b.status || "").toLowerCase())) return;
        const wid = String(b.workshop_id);
        if (!statsByWorkshop[wid]) statsByWorkshop[wid] = { visits: 0, spent: 0 };
        statsByWorkshop[wid].visits += 1;
        statsByWorkshop[wid].spent += Number(b.amount || 0);
      });

      // Rating per workshop from reviews (fallback to workshop rating)
      const ratingByWorkshop = {};
      reviews.forEach(r => {
        if (!r.workshop_id) return;
        const wid = String(r.workshop_id);
        if (!ratingByWorkshop[wid]) ratingByWorkshop[wid] = { sum: 0, n: 0 };
        ratingByWorkshop[wid].sum += Number(r.rating || 0);
        ratingByWorkshop[wid].n += 1;
      });

      const mapped = favRaw.map((f, idx) => {
        const workshopId = f.workshop_id || f.workshopId || f.id;
        const w = wById[String(workshopId)] || f.workshop || f || {};
        const stats = statsByWorkshop[String(workshopId)] || { visits: 0, spent: 0 };
        const rAgg = ratingByWorkshop[String(workshopId)];
        const rating = rAgg && rAgg.n ? Number((rAgg.sum / rAgg.n).toFixed(1)) : Number(w.rating || w.avg_rating || f.rating || 0);
        const reviewCount = rAgg ? rAgg.n : Number(w.review_count || w.reviews || f.reviews || 0);
        const expertise = parseExpertise(w);
        const address = w.address || w.location || f.address || "";
        const city = w.city || "";
        const state = w.state || "";
        const locationLabel = [address, city, state].filter(Boolean).join(", ") || w.location || "—";
        return {
          id: f.id ?? workshopId ?? idx,
          favId: f.id,
          workshop_id: workshopId,
          name: w.business_name || w.name || f.name || "Workshop",
          location: locationLabel,
          rating, reviews: reviewCount,
          image: w.logo || w.image_url || w.image || f.image || FALLBACK_IMG,
          expertise: expertise.length ? expertise : ["General Repair"],
          visits: stats.visits, spent: stats.spent,
          phone: w.phone || w.whatsapp || f.phone || "—",
          email: w.email || f.email || "—",
          address: address || locationLabel,
          hours: w.hours || w.opening_hours || w.working_hours || "Mon-Sat 8AM-6PM",
          bar: w.bar_license || w.bar_license_number || w.bar || f.bar || "—",
          liked: true,
          created_at: f.created_at || f.createdAt || f.date_added || null,
        };
      });

      setFavorites(mapped);
    } catch (e) {
      setError(e.message === "Failed to fetch" ? "Cannot reach backend at http://127.0.0.1:5000 — is 'py app.py' running?" : e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(0); }, [search, sort]);

  const filtered = useMemo(() => {
    let d = [...favorites];
    if (search) {
      const s = search.toLowerCase();
      d = d.filter(f => `${f.name} ${f.location} ${f.expertise.join(" ")}`.toLowerCase().includes(s));
    }
    if (sort === "rating") d.sort((a, b) => b.rating - a.rating);
    if (sort === "visits") d.sort((a, b) => b.visits - a.visits);
    if (sort === "name") d.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "spent") d.sort((a, b) => b.spent - a.spent);
    if (sort === "recent") d.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return d;
  }, [favorites, search, sort]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice(page * perPage, page * perPage + perPage);
  const avgRating = favorites.length ? (favorites.reduce((s, f) => s + Number(f.rating || 0), 0) / favorites.length).toFixed(1) : "0.0";
  const totalVisits = favorites.reduce((s, f) => s + f.visits, 0);
  const totalSpent = favorites.reduce((s, f) => s + f.spent, 0);

  const removeFav = async (shop) => {
    const ownerId = getOwnerId();
    const idToDelete = shop.workshop_id;
    // Optimistic
    const prev = favorites;
    setFavorites(prev => prev.filter(f => f.workshop_id !== idToDelete));
    setSelected(null);
    try {
      let res = await fetch(`${API}/owners/${ownerId}/favorites/${idToDelete}`, { method: "DELETE" });
      if (!res.ok) res = await fetch(`${API}/favorites/${shop.favId || idToDelete}?owner_id=${ownerId}`, { method: "DELETE" });
      if (!res.ok) {
        // Try POST toggle endpoint if DELETE not implemented
        const toggle = await fetch(`${API}/favorites/toggle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner_id: ownerId, workshop_id: idToDelete }) });
        if (!toggle.ok) throw new Error("Could not remove favorite on server");
      }
      Swal.fire({ icon: "success", title: "Removed", text: `${shop.name} removed from favorites`, timer: 1600, showConfirmButton: false });
    } catch (e) {
      setFavorites(prev); // rollback
      Swal.fire("Could not remove", e.message, "error");
    }
  };

  const openBook = (shop) => {
    setBookShop(shop);
    setBookForm({ car_id: cars[0]?.id ? String(cars[0].id) : "", service: "", date: "", time: "", description: "" });
  };

  const confirmBooking = async () => {
    if (!bookShop) return;
    const ownerId = getOwnerId();
    if (!bookForm.car_id) return Swal.fire("Select a car", "Pick one of your cars first.", "warning");
    if (!bookForm.service) return Swal.fire("Select service", "Pick a service type.", "warning");
    if (!bookForm.date) return Swal.fire("Select date", "Pick a booking date.", "warning");
    setBookingSaving(true);
    try {
      const payload = {
        owner_id: ownerId,
        workshop_id: bookShop.workshop_id,
        car_id: Number(bookForm.car_id),
        service_type: bookForm.service,
        booking_date: bookForm.date,
        booking_time: bookForm.time || "10:00 AM",
        description: bookForm.description || bookForm.service,
        status: "pending",
      };
      const res = await fetch(`${API}/bookings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Booking failed (${res.status})`);
      Swal.fire("Booked!", `Your ${bookForm.service} at ${bookShop.name} is pending confirmation.`, "success");
      setBookShop(null);
      load(); // refresh visits/spent
    } catch (e) { Swal.fire("Booking failed", e.message, "error"); }
    setBookingSaving(false);
  };

  const cardBg = C?.card || "#fff";
  const cardBorder = C?.cardBorder || "#E2E8F0";
  const text = C?.text || "#0A192F";
  const muted = C?.muted || "#6B7A90";
  const soft = C?.soft || "#F8FAFC";

  return (
    <>
      <style>{`
        *{ box-sizing:border-box; }
        .fav-wrap{ width:100%; max-width:100%; overflow:hidden; }
        .fav-stat{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:18px; padding:18px; height:100%; }
        .fav-stat .label{ font-size:12px; font-weight:800; color:${muted}; letter-spacing:0.06em; text-transform:uppercase; }
        .fav-stat .value{ font-weight:900; font-size:26px; color:${text}; margin-top:6px; }
        .fav-toolbar{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:18px; padding:14px; display:flex; gap:10px; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom:14px; }
        .fav-search{ position:relative; flex:1; min-width:220px; max-width:360px; }
        .fav-search input{ width:100%; height:46px; border:1.5px solid ${cardBorder}; border-radius:12px; padding:0 14px 0 42px; font-size:15px; font-weight:600; background:${soft}; color:${text}; outline:none; }
        .fav-search i{ position:absolute; left:14px; top:50%; transform:translateY(-50%); color:${muted}; font-size:16px; }
        .fav-grid{ display:grid; grid-template-columns:1fr 1fr; gap:14px; width:100%; }
        @media(max-width: 992px){ .fav-grid{ grid-template-columns:1fr; } }
        .fav-card{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:18px; overflow:hidden; transition:.2s; display:flex; flex-direction:column; }
        .fav-card:hover{ transform:translateY(-3px); box-shadow:0 12px 28px rgba(10,25,47,0.10); border-color:${text}; }
        .fav-img{ height:160px; background-size:cover; background-position:center; position:relative; }
        .fav-img::after{ content:""; position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,0.05), rgba(10,25,47,0.55)); }
        .fav-badge{ position:absolute; z-index:2; top:10px; left:10px; background:#fff; border:1.5px solid ${text}; border-radius:20px; padding:5px 10px; font-size:11px; font-weight:900; display:flex; align-items:center; gap:4px; }
        .fav-heart{ position:absolute; z-index:2; top:10px; right:10px; width:38px; height:38px; border-radius:50%; background:#fff; border:1.5px solid ${text}; display:grid; place-items:center; cursor:pointer; font-size:18px; color:#EF4444; }
        .fav-body{ padding:14px; flex:1; display:flex; flex-direction:column; }
        .fav-title{ font-weight:900; font-size:17px; color:${text}; margin:0; line-height:1.2; }
        .fav-meta{ font-size:13px; color:${muted}; font-weight:600; margin-top:4px; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        .fav-tags{ display:flex; gap:6px; flex-wrap:wrap; margin-top:10px; }
        .fav-tag{ font-size:11px; font-weight:800; background:${soft}; border:1px solid ${cardBorder}; padding:5px 9px; border-radius:20px; color:${text}; }
        .fav-foot{ display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:12px; border-top:1px dashed ${cardBorder}; }
        .btn-sm{ height:38px; border-radius:11px; font-weight:800; font-size:13px; padding:0 14px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; border:1.5px solid ${cardBorder}; background:${cardBg}; color:${text}; }
        .btn-sm.primary{ background:${text}; color:#fff; border-color:${text}; }
        .fav-modal-backdrop{ position:fixed; inset:0; background:rgba(10,25,47,0.55); backdrop-filter:blur(6px); z-index:99; display:grid; place-items:center; padding:16px; }
        .fav-modal{ width:100%; max-width:640px; max-height:92vh; overflow:auto; background:${cardBg}; border:2px solid ${text}; border-radius:22px; box-shadow:0 30px 80px rgba(0,0,0,0.25); }
      `}</style>

      <div className="fav-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontWeight: 900, fontSize: '30px', color: text, margin: '0 0 6px', letterSpacing: '-0.03em' }}>Favorite Workshops</h2>
            <p style={{ color: muted, fontSize: '15px', margin: 0, fontWeight: 500 }}>Verified shops you saved • {favorites.length} shops</p>
          </div>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#991B1B", borderRadius: 12, padding: 12, marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{error}</span>
            <button onClick={load} style={{ background: "#991B1B", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontWeight: 800, cursor: "pointer" }}>Retry</button>
          </div>
        )}

        <div className="row g-3 mb-3" style={{ margin: 0, width: '100%' }}>
          <div className="col-6 col-lg-3"><div className="fav-stat"><div className="label">Total Saved</div><div className="value">{favorites.length}</div><div style={{ fontSize: '12px', color: muted, marginTop: '4px', fontWeight: 600 }}>shops</div></div></div>
          <div className="col-6 col-lg-3"><div className="fav-stat"><div className="label">Avg Rating</div><div className="value">{avgRating} <span style={{ color: '#F59E0B', fontSize: '18px' }}><i className="bi bi-star-fill"></i></span></div><div style={{ fontSize: '12px', color: '#22C55E', fontWeight: 700 }}>From real reviews</div></div></div>
          <div className="col-6 col-lg-3"><div className="fav-stat"><div className="label">Total Visits</div><div className="value">{totalVisits}</div><div style={{ fontSize: '12px', color: muted }}>jobs across favs</div></div></div>
          <div className="col-6 col-lg-3"><div className="fav-stat" style={{ background: '#0A192F', borderColor: '#0A192F' }}><div className="label" style={{ color: '#94A3B8' }}>Total Spent at Favs</div><div className="value" style={{ color: '#fff' }}>${totalSpent}</div><div style={{ fontSize: '12px', color: '#94A3B8' }}>Lifetime</div></div></div>
        </div>

        <div className="fav-toolbar">
          <div className="fav-search"><i className="bi bi-search"></i><input placeholder="Search shop, location, expertise..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={sort} onChange={e => setSort(e.target.value)} style={{ height: '46px', borderRadius: '12px', border: `1.5px solid ${cardBorder}`, background: soft, color: text, fontWeight: 800, fontSize: '13px', padding: '0 12px' }}>
              <option value="recent">Most Recent</option><option value="rating">Highest Rated</option><option value="visits">Most Visited</option><option value="spent">Most Spent</option><option value="name">A - Z</option>
            </select>
            <span style={{ fontSize: '13px', fontWeight: 700, color: muted, background: soft, border: `1px solid ${cardBorder}`, padding: '8px 12px', borderRadius: '20px' }}>{filtered.length} shops • Page {page + 1}/{Math.ceil(filtered.length / perPage) || 1}</span>
          </div>
        </div>

        {loading ? <div style={{ padding: 40, textAlign: "center", color: muted, fontWeight: 700 }}>Loading favorites…</div>
          : filtered.length === 0 ? (
            <div style={{ background: cardBg, border: `1.5px solid ${cardBorder}`, borderRadius: '18px', padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '42px' }}><i className="bi bi-heart"></i></div>
              <h4 style={{ fontWeight: 900, color: text, marginTop: '12px' }}>No favorites yet</h4>
              <p style={{ color: muted, fontSize: '14px' }}>Tap the heart on Workshops page to save a shop here.</p>
            </div>
          ) : (
            <>
              <div className="fav-grid">
                {paged.map(shop => (
                  <div key={shop.workshop_id} className="fav-card">
                    <div className="fav-img" style={{ backgroundImage: `url(${shop.image})` }}>
                      <div className="fav-badge"><i className="bi bi-shield-check" style={{ color: '#22C55E' }}></i> BAR {shop.bar}</div>
                      <button className="fav-heart" onClick={() => removeFav(shop)} title="Remove from favorites"><i className="bi bi-heart-fill"></i></button>
                      <div style={{ position: 'absolute', bottom: '10px', left: '10px', zIndex: 2, background: 'rgba(10,25,47,0.85)', color: '#fff', padding: '6px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#FFEB3B' }}><i className="bi bi-star-fill"></i> {shop.rating || "—"}</span> <span style={{ color: '#94A3B8' }}>({shop.reviews})</span> • {shop.visits} visits • ${shop.spent} spent
                      </div>
                    </div>
                    <div className="fav-body">
                      <h3 className="fav-title">{shop.name}</h3>
                      <div className="fav-meta"><i className="bi bi-geo-alt-fill" style={{ color: '#FF5722' }}></i> {shop.location} • {shop.hours}</div>
                      <div className="fav-tags">{shop.expertise.map(t => <span key={t} className="fav-tag">{t}</span>)}</div>
                      <div className="fav-foot">
                        <div style={{ fontSize: '12px', color: muted, fontWeight: 700 }}><i className="bi bi-telephone me-1"></i>{shop.phone}</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-sm" onClick={() => setSelected(shop)}><i className="bi bi-eye"></i> View</button>
                          <button className="btn-sm primary" onClick={() => openBook(shop)}><i className="bi bi-calendar-plus"></i> Book</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', background: cardBg, border: `1.5px solid ${cardBorder}`, borderRadius: '14px', padding: '12px 14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: muted }}>{page * perPage + 1}–{Math.min((page + 1) * perPage, filtered.length)} of {filtered.length} favorite shops</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} style={{ height: '40px', borderRadius: '11px', border: `1.5px solid ${cardBorder}`, background: cardBg, fontWeight: 800, fontSize: '13px', padding: '0 16px', cursor: 'pointer', color: text }}>Prev</button>
                  <button disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} style={{ height: '40px', borderRadius: '11px', border: `1.5px solid ${cardBorder}`, background: cardBg, fontWeight: 800, fontSize: '13px', padding: '0 16px', cursor: 'pointer', color: text }}>Next</button>
                </div>
              </div>
            </>
          )}
      </div>

      {selected && (
        <div className="fav-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="fav-modal" onClick={e => e.stopPropagation()}>
            <div style={{ height: '200px', backgroundImage: `url(${selected.image})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.1), rgba(10,25,47,0.75))' }}></div>
              <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: '12px', right: '12px', width: '40px', height: '40px', borderRadius: '12px', background: '#fff', border: `1.5px solid ${text}`, cursor: 'pointer' }}><i className="bi bi-x-lg"></i></button>
              <div style={{ position: 'absolute', bottom: '12px', left: '14px', right: '14px', color: '#fff' }}>
                <h3 style={{ fontWeight: 900, fontSize: '20px', margin: 0 }}>{selected.name}</h3>
                <div style={{ fontSize: '13px', marginTop: '4px', fontWeight: 600 }}><i className="bi bi-geo-alt-fill"></i> {selected.address} • <i className="bi bi-star-fill" style={{ color: '#FFEB3B' }}></i> {selected.rating || "—"} ({selected.reviews} reviews) • BAR {selected.bar}</div>
              </div>
            </div>
            <div style={{ padding: '18px', display: 'grid', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: soft, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '12px' }}><div style={{ fontSize: '11px', fontWeight: 900, color: muted }}>PHONE</div><div style={{ fontWeight: 800, fontSize: '14px', marginTop: '4px', color: text }}>{selected.phone}</div></div>
                <div style={{ background: soft, border: `1px solid ${cardBorder}`, borderRadius: '12px', padding: '12px' }}><div style={{ fontSize: '11px', fontWeight: 900, color: muted }}>EMAIL</div><div style={{ fontWeight: 700, fontSize: '13px', marginTop: '4px', color: text }}>{selected.email}</div></div>
              </div>
              <div style={{ background: cardBg, border: `1.5px solid ${cardBorder}`, borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontWeight: 900, fontSize: '14px', color: text, marginBottom: '8px' }}><i className="bi bi-tools me-1"></i> Expertise • BAR Verified</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{selected.expertise.map(t => <span key={t} style={{ fontSize: '12px', fontWeight: 800, background: soft, border: `1px solid ${cardBorder}`, padding: '6px 12px', borderRadius: '20px', color: text }}>{t}</span>)}</div>
                <div style={{ marginTop: '12px', fontSize: '13px', color: muted, fontWeight: 600 }}><i className="bi bi-clock me-1"></i>{selected.hours} • {selected.location}</div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button style={{ flex: 1, height: '46px', borderRadius: '12px', background: text, color: '#fff', border: `1.5px solid ${text}`, fontWeight: 800, fontSize: '14px', cursor: "pointer" }} onClick={() => { setSelected(null); openBook(selected); }}><i className="bi bi-calendar-plus me-1"></i> Book Service</button>
                <button style={{ flex: 1, height: '46px', borderRadius: '12px', background: cardBg, color: text, border: `1.5px solid ${cardBorder}`, fontWeight: 800, fontSize: '14px', cursor: "pointer" }} onClick={() => removeFav(selected)}><i className="bi bi-heartbreak me-1"></i> Remove Favorite</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bookShop && (
        <div className="fav-modal-backdrop" onClick={() => setBookShop(null)}>
          <div className="fav-modal" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px', borderBottom: `1.5px solid ${cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: soft }}>
              <div><div style={{ fontWeight: 900, fontSize: '16px', color: text }}>Book Service • {bookShop.name}</div><div style={{ fontSize: '12px', color: muted }}>{bookShop.address}</div></div>
              <button onClick={() => setBookShop(null)} style={{ width: '36px', height: '36px', borderRadius: '10px', border: `1.5px solid ${cardBorder}`, background: cardBg, cursor: 'pointer' }}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={{ padding: '18px', display: 'grid', gap: '12px' }}>
              <select value={bookForm.car_id} onChange={e => setBookForm(f => ({ ...f, car_id: e.target.value }))} style={{ height: '46px', borderRadius: '12px', border: `1.5px solid ${cardBorder}`, background: soft, color: text, fontWeight: 700, padding: '0 12px' }}>
                <option value="">Select your car…</option>
                {cars.map(c => <option key={c.id} value={String(c.id)}>{[c.make, c.model, c.year].filter(Boolean).join(" ")} • {c.license_plate || c.plate || ""}</option>)}
              </select>
              <select value={bookForm.service} onChange={e => setBookForm(f => ({ ...f, service: e.target.value }))} style={{ height: '46px', borderRadius: '12px', border: `1.5px solid ${cardBorder}`, background: soft, color: text, fontWeight: 700, padding: '0 12px' }}>
                <option value="">Select service…</option>
                <option>Oil Change</option><option>Brake Pad + Rotor</option><option>AC Service</option><option>Engine Diagnostics</option><option>Tire Rotation</option><option>Battery Replacement</option><option>General Inspection</option>
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input type="date" value={bookForm.date} onChange={e => setBookForm(f => ({ ...f, date: e.target.value }))} style={{ height: '46px', borderRadius: '12px', border: `1.5px solid ${cardBorder}`, background: soft, color: text, fontWeight: 700, padding: '0 12px' }} />
                <input type="time" value={bookForm.time} onChange={e => setBookForm(f => ({ ...f, time: e.target.value }))} style={{ height: '46px', borderRadius: '12px', border: `1.5px solid ${cardBorder}`, background: soft, color: text, fontWeight: 700, padding: '0 12px' }} />
              </div>
              <textarea value={bookForm.description} onChange={e => setBookForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the issue (optional)" style={{ minHeight: 70, borderRadius: 12, border: `1.5px solid ${cardBorder}`, background: soft, color: text, padding: 12, fontWeight: 600 }} />
              <button disabled={bookingSaving} style={{ height: '48px', borderRadius: '12px', background: text, color: '#fff', border: `1.5px solid ${text}`, fontWeight: 800, fontSize: '14px', cursor: "pointer" }} onClick={confirmBooking}><i className="bi bi-check2 me-1"></i> {bookingSaving ? "Booking…" : `Confirm Booking • ${bookShop.name}`}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}