import { useState, useMemo, useEffect, useCallback } from "react";

const API = "http://127.0.0.1:5000/api";

function getStoredUser(){ try{ return JSON.parse(localStorage.getItem("autoville_user")||"{}"); }catch{ return {}; } }

// Backend status (pending, confirmed, in_progress, awaiting_parts, ready, completed, cancelled)
// -> UI status (New, Confirmed, In Progress, Awaiting Parts, Ready, Completed, Cancelled)
function mapStatusToUI(raw){
  const s = String(raw||"").toLowerCase().replace(/-/g,"_").trim();
  if(["pending","new","requested"].includes(s)) return "New";
  if(s==="confirmed") return "Confirmed";
  if(["in_progress","inprogress","ongoing","diagnosing","diagnostics"].includes(s)) return "In Progress";
  if(["awaiting_parts","awaiting","waiting_parts"].includes(s)) return "Awaiting Parts";
  if(s==="ready") return "Ready";
  if(["completed","done","finished"].includes(s)) return "Completed";
  if(["cancelled","canceled"].includes(s)) return "Cancelled";
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "New";
}
function mapStatusToBackend(ui){
  const s = String(ui||"").toLowerCase();
  if(s==="new") return "pending";
  if(s==="confirmed") return "confirmed";
  if(s==="in progress") return "in_progress";
  if(s==="awaiting parts") return "awaiting_parts";
  if(s==="ready") return "ready";
  if(s==="completed") return "completed";
  if(s==="cancelled") return "cancelled";
  return s;
}
function normalizeBooking(b, workshop){
  const carMake = b.car_make || b.make || "";
  const carModel = b.car_model || b.model || "";
  const carYear = b.car_year || b.year || "";
  const carPlate = b.plate || b.license_plate || b.vin || "";
  const carStr = [carMake, carModel, carYear].filter(Boolean).join(" ") || b.car || b.vehicle || "Vehicle";
  const carFull = carPlate ? `${carStr} • ${carPlate}` : carStr;
  const dateStr = String(b.booking_date || b.date || b.created_at || "").slice(0,10);
  const timeStr = b.booking_time || b.time || "";
  return {
    dbId: b.id,
    id: `#AV-${b.id}`,
    date: dateStr,
    time: timeStr ? `${timeStr} PST` : "",
    customer: b.owner_name || b.customer_name || b.customer || b.full_name || "Customer",
    phone: b.owner_phone || b.phone || b.customer_phone || "",
    email: b.owner_email || b.email || b.customer_email || "",
    car: carFull,
    service: b.service_type || b.service || b.description || "Service",
    amount: Number(b.amount ?? b.price ?? 0),
    status: mapStatusToUI(b.status),
    address: b.address || b.pickup_address || workshop?.address || "112 S Market St, Inglewood, CA 90301",
    notes: b.description || b.notes || "",
    mechanic: b.mechanic_name || b.mechanic || "Unassigned",
    bar: b.bar_license || "ARD 284719",
    vin: b.vin || "",
    raw: b,
  };
}

export default function MechanicBookingsPage({ workshopId: propWorkshopId, workshop, onLogPayment }) {
  const storedUser = getStoredUser();
  const workshopId = propWorkshopId || workshop?.id || storedUser.id || storedUser.workshop_id || storedUser.workshopId;

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [page, setPage] = useState(0);
  const perPage = 5;
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(false);

  const fetchBookings = useCallback(async ()=>{
    if(!workshopId){ setLoading(false); setError("No workshop ID. Please login again."); return; }
    setLoading(true); setError("");
    try{
      const res = await fetch(`${API}/bookings?workshop_id=${workshopId}&limit=200`);
      const data = await res.json().catch(()=>[]);
      if(!res.ok) throw new Error(data.error || "Failed to load bookings");
      const list = Array.isArray(data) ? data : (data.bookings || data.data || []);
      setBookings(list.map(b=> normalizeBooking(b, workshop)));
    }catch(e){
      setError(e.message || "Could not load bookings. Is Flask running on :5000?");
      setBookings([]);
    }
    setLoading(false);
  }, [workshopId]);

  useEffect(()=>{ fetchBookings(); }, [fetchBookings]);

  const filtered = useMemo(()=>{
    let d=[...bookings];
    if(search){ const s=search.toLowerCase(); d=d.filter(b=> `${b.id} ${b.customer} ${b.car} ${b.service} ${b.phone} ${b.email}`.toLowerCase().includes(s)); }
    if(status!=="All") d=d.filter(b=> b.status===status);
    if(dateFilter!=="All"){
      const today = new Date().toISOString().slice(0,10);
      if(dateFilter==="Today") d=d.filter(b=> b.date===today);
      if(dateFilter==="This Week") d=d.filter(b=> b.date && new Date(b.date) >= new Date(Date.now()-7*24*60*60*1000));
    }
    d.sort((a,b)=> new Date(b.date||"1970-01-01") - new Date(a.date||"1970-01-01"));
    return d;
  }, [bookings, search, status, dateFilter]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice(page*perPage, page*perPage+perPage);

  const updateStatus = async (id, newStatus) => {
    const target = bookings.find(b=> b.id===id);
    if(!target) return;
    const oldStatus = target.status;
    // Optimistic UI
    setBookings(prev=> prev.map(b=> b.id===id ? {...b, status:newStatus} : b));
    if(selected && selected.id===id) setSelected({...selected, status:newStatus});
    setUpdating(true);
    try{
      const res = await fetch(`${API}/bookings/${target.dbId}/status`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ status: mapStatusToBackend(newStatus) })
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || "Status update failed");
      // Re-fetch to get server truth (also updates jobs if backend auto-creates job)
      await fetchBookings();
    }catch(e){
      // Rollback on failure
      setBookings(prev=> prev.map(b=> b.id===id ? {...b, status:oldStatus} : b));
      if(selected && selected.id===id) setSelected({...selected, status:oldStatus});
      alert(e.message);
    }
    setUpdating(false);
  };

  const stats = {
    total: bookings.length,
    new: bookings.filter(b=> b.status==="New").length,
    active: bookings.filter(b=> ["Confirmed","In Progress","Awaiting Parts"].includes(b.status)).length,
    ready: bookings.filter(b=> b.status==="Ready").length,
  };

  const statusColor = (s)=>{
    if(s==="New") return {bg:"#DBEAFE", color:"#1E40AF"};
    if(s==="Confirmed") return {bg:"#FEF3C7", color:"#92400E"};
    if(s==="In Progress") return {bg:"#E0E7FF", color:"#3730A3"};
    if(s==="Awaiting Parts") return {bg:"#FCE7F3", color:"#9D174D"};
    if(s==="Ready") return {bg:"#DCFCE7", color:"#166534"};
    if(s==="Completed") return {bg:"#F1F5F9", color:"#475569"};
    return {bg:"#FEE2E2", color:"#991B1B"};
  };

  if(loading) return <div style={{padding:"40px", textAlign:"center", color:"#64748B"}}>Loading bookings from backend...</div>;

  return (
    <>
      <style>{`
        *{ box-sizing:border-box; }
        .bk-wrap{ width:100%; max-width:100%; overflow:hidden; }
        .bk-stat{ background:#fff; border:1.5px solid #0A192F; border-radius:16px; padding:16px; height:100%; }
        .bk-stat .label{ font-size:11px; font-weight:800; color:#6B7A90; letter-spacing:0.06em; text-transform:uppercase; }
        .bk-stat .value{ font-weight:900; font-size:26px; color:#0A192F; margin-top:6px; }
        .bk-toolbar{ background:#fff; border:1.5px solid #E2E8F0; border-radius:16px; padding:14px; display:flex; gap:10px; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom:14px; }
        .bk-search{ position:relative; flex:1; min-width:220px; max-width:360px; }
        .bk-search input{ width:100%; height:46px; border:1.5px solid #E2E8F0; border-radius:12px; padding:0 14px 0 42px; font-size:15px; font-weight:600; background:#F8FAFC; color:#0A192F; outline:none; }
        .bk-search i{ position:absolute; left:14px; top:50%; transform:translateY(-50%); color:#6B7A90; font-size:16px; }
        .bk-table-wrap{ background:#fff; border:1.5px solid #E2E8F0; border-radius:16px; overflow:hidden; width:100%; }
        .bk-table{ width:100%; border-collapse:collapse; table-layout:fixed; }
        .bk-table th{ text-align:left; font-size:11px; font-weight:900; color:#6B7A90; padding:14px 12px; border-bottom:1.5px solid #E2E8F0; background:#F8FAFC; text-transform:uppercase; }
        .bk-table th:nth-child(1){ width:18%; } .bk-table th:nth-child(2){ width:26%; } .bk-table th:nth-child(3){ width:26%; } .bk-table th:nth-child(4){ width:15%; } .bk-table th:nth-child(5){ width:15%; }
        .bk-table td{ padding:14px 12px; font-size:14px; font-weight:600; color:#0A192F; border-bottom:1px solid #E2E8F0; vertical-align:middle; }
        .bk-table tr:hover td{ background:#F8FAFC; }
        .bk-mobile{ display:none; }
        @media(max-width: 992px){ .bk-table th:nth-child(3){ width:32%; } .bk-table th:nth-child(2){ width:30%; } }
        @media(max-width: 768px){ .bk-table-wrap.desktop{ display:none; } .bk-mobile{ display:grid; gap:12px; } .bk-mcard{ background:#fff; border:1.5px solid #E2E8F0; border-radius:16px; padding:16px; } .bk-toolbar{ flex-direction:column; align-items:stretch; } .bk-search{ max-width:100%; } }
        .bk-modal-backdrop{ position:fixed; inset:0; background:rgba(10,25,47,0.55); backdrop-filter:blur(6px); z-index:99; display:grid; place-items:center; padding:16px; }
        .bk-modal{ width:100%; max-width:620px; max-height:92vh; overflow:auto; background:#fff; border:2px solid #0A192F; border-radius:22px; box-shadow:0 30px 80px rgba(0,0,0,0.25); }
      `}</style>

      <div className="bk-wrap">
        <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', marginBottom:'16px'}}>
          <div>
            <h2 style={{fontWeight:900, fontSize:'28px', color:'#0A192F', margin:'0 0 6px'}}>Bookings • Inglewood, CA</h2>
            <p style={{color:'#6B7A90', fontSize:'15px', margin:0, fontWeight:500}}>Manage appointments from vehicle owners • BAR ARD 284719 • PST • USD</p>
          </div>
          <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
            <button onClick={fetchBookings} style={{height:'38px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff', fontWeight:800, fontSize:'12px', padding:'0 14px', cursor:'pointer'}}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
            <span style={{fontSize:'12px', fontWeight:700, background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'8px 12px', borderRadius:'20px'}}>{filtered.length} bookings</span>
          </div>
        </div>

        {error && <div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", color:"#991B1B", padding:"12px 14px", borderRadius:"12px", marginBottom:"12px", fontSize:"13px", fontWeight:700}}>{error}</div>}

        <div className="row g-3 mb-3" style={{margin:0, width:'100%'}}>
          <div className="col-6 col-lg-3"><div className="bk-stat"><div className="label">Total Bookings</div><div className="value">{stats.total}</div><div style={{fontSize:'11px', color:'#6B7A90', marginTop:'4px'}}>LA County • 30 days</div></div></div>
          <div className="col-6 col-lg-3"><div className="bk-stat"><div className="label">New Leads</div><div className="value" style={{color:'#1E40AF'}}>{stats.new}</div><div style={{fontSize:'11px', color:'#3B82F6', fontWeight:700}}>+{stats.new} needs action</div></div></div>
          <div className="col-6 col-lg-3"><div className="bk-stat"><div className="label">Active Jobs</div><div className="value">{stats.active}</div><div style={{fontSize:'11px', color:'#6B7A90'}}>Confirmed + In Progress</div></div></div>
          <div className="col-6 col-lg-3"><div className="bk-stat" style={{background:'#0A192F', borderColor:'#0A192F'}}><div className="label" style={{color:'#94A3B8'}}>Ready for Pickup</div><div className="value" style={{color:'#fff'}}>{stats.ready}</div><div style={{fontSize:'11px', color:'#22C55E'}}>Customer notify</div></div></div>
        </div>

        <div className="bk-toolbar">
          <div className="bk-search"><i className="bi bi-search"></i><input placeholder="Search customer, car, service, phone..." value={search} onChange={e=>{setSearch(e.target.value); setPage(0);}} /></div>
          <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
            <select value={status} onChange={e=>{setStatus(e.target.value); setPage(0);}} style={{height:'46px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:800, fontSize:'13px', padding:'0 12px'}}>
              <option value="All">All Status</option><option>New</option><option>Confirmed</option><option>In Progress</option><option>Awaiting Parts</option><option>Ready</option><option>Completed</option><option>Cancelled</option>
            </select>
            <select value={dateFilter} onChange={e=>{setDateFilter(e.target.value); setPage(0);}} style={{height:'46px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:800, fontSize:'13px', padding:'0 12px'}}>
              <option value="All">All Dates</option><option value="Today">Today</option><option value="This Week">This Week</option>
            </select>
          </div>
        </div>

        <div className="bk-table-wrap desktop">
          <table className="bk-table">
            <thead><tr><th>Booking ID • Date • PST</th><th>Customer • Car • LA</th><th>Service • Amount • USD</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {paged.length===0 ? <tr><td colSpan={5} style={{textAlign:'center', padding:'32px', color:'#6B7A90', fontSize:'15px'}}>{bookings.length===0 ? "No bookings yet for this workshop. Owners will appear here when they book." : "No bookings found"}</td></tr> :
              paged.map(b=>{
                const sc = statusColor(b.status);
                return (
                  <tr key={b.id}>
                    <td><b style={{fontSize:'14px'}}>{b.id}</b><div style={{fontSize:'11px', color:'#6B7A90'}}>{b.date} • {b.time}</div><div style={{fontSize:'10px', color:'#6B7A90'}}>{b.bar}</div></td>
                    <td><div style={{fontWeight:800, fontSize:'13px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{b.customer}</div><div style={{fontSize:'11px', color:'#6B7A90', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{b.car}</div><div style={{fontSize:'11px', color:'#6B7A90'}}>{b.phone}</div></td>
                    <td><div style={{fontWeight:700, fontSize:'13px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{b.service}</div><div style={{fontSize:'12px', fontWeight:800, color:'#166534'}}>${b.amount} • {b.mechanic}</div></td>
                    <td><span style={{fontSize:'11px', fontWeight:800, padding:'5px 10px', borderRadius:'20px', background:sc.bg, color:sc.color}}>{b.status.toUpperCase()}</span></td>
                    <td><button onClick={()=>setSelected(b)} style={{height:'38px', borderRadius:'10px', border:'1.5px solid #0A192F', background:'#0A192F', color:'#fff', fontWeight:800, fontSize:'12px', padding:'0 14px', cursor:'pointer'}}>Manage</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', borderTop:'1.5px solid #E2E8F0', background:'#F8FAFC'}}>
            <div style={{fontSize:'13px', fontWeight:700, color:'#6B7A90'}}>{filtered.length===0 ? "0" : `${page*perPage+1}–${Math.min((page+1)*perPage, filtered.length)}`} of {filtered.length} • Page {page+1}/{totalPages||1}</div>
            <div style={{display:'flex', gap:'8px'}}>
              <button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))} style={{height:'38px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff', fontWeight:800, fontSize:'13px', padding:'0 14px', cursor:'pointer'}}>Prev</button>
              <button disabled={page>=totalPages-1} onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} style={{height:'38px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff', fontWeight:800, fontSize:'13px', padding:'0 14px', cursor:'pointer'}}>Next</button>
            </div>
          </div>
        </div>

        <div className="bk-mobile">
          {paged.map(b=>{
            const sc = statusColor(b.status);
            return (
              <div key={b.id} className="bk-mcard">
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px'}}><b style={{fontSize:'14px'}}>{b.id} • {b.date}</b><span style={{fontSize:'11px', fontWeight:800, padding:'4px 8px', borderRadius:'20px', background:sc.bg, color:sc.color}}>{b.status}</span></div>
                <div style={{fontSize:'14px', fontWeight:800}}>{b.customer} • {b.car.split(" • ")[0]}</div>
                <div style={{fontSize:'12px', color:'#6B7A90', marginBottom:'4px'}}>{b.service} • ${b.amount}</div>
                <div style={{fontSize:'11px', color:'#6B7A90', marginBottom:'10px'}}><i className="bi bi-geo-alt me-1"></i>{b.address}</div>
                <button onClick={()=>setSelected(b)} style={{width:'100%', height:'44px', borderRadius:'10px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, fontSize:'13px'}}>Manage Booking</button>
              </div>
            );
          })}
          {paged.length===0 && <div style={{padding:"24px", textAlign:"center", color:"#6B7A90"}}>No bookings found</div>}
        </div>
      </div>

      {selected && (
        <div className="bk-modal-backdrop" onClick={()=>setSelected(null)}>
          <div className="bk-modal" onClick={e=>e.stopPropagation()}>
            <div style={{padding:'16px', borderBottom:'1.5px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#F8FAFC', position:'sticky', top:0, zIndex:2}}>
              <div><div style={{fontWeight:900, fontSize:'16px'}}>{selected.id} • {selected.customer}</div><div style={{fontSize:'11px', color:'#6B7A90'}}>{selected.date} • {selected.time} • {selected.bar} • Inglewood, CA</div></div>
              <button onClick={()=>setSelected(null)} style={{width:'36px', height:'36px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff', cursor:'pointer'}}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={{padding:'16px', display:'grid', gap:'14px'}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                <div style={{background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'12px', padding:'12px'}}><div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90'}}>CUSTOMER</div><div style={{fontWeight:800, fontSize:'13px', marginTop:'4px'}}>{selected.customer}</div><div style={{fontSize:'12px', color:'#6B7A90'}}>{selected.phone}</div><div style={{fontSize:'12px', color:'#6B7A90'}}>{selected.email}</div></div>
                <div style={{background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'12px', padding:'12px'}}><div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90'}}>CAR • SERVICE</div><div style={{fontWeight:800, fontSize:'13px', marginTop:'4px'}}>{selected.car}</div><div style={{fontSize:'12px', color:'#0A192F', fontWeight:700}}>{selected.service} • ${selected.amount}</div><div style={{fontSize:'11px', color:'#6B7A90'}}>Mechanic: {selected.mechanic}</div>{selected.vin && <div style={{fontSize:'11px', color:'#6B7A90'}}>VIN: {selected.vin}</div>}</div>
              </div>
              <div style={{background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:'12px', padding:'12px', fontSize:'13px', color:'#92400E'}}><i className="bi bi-geo-alt-fill me-1"></i><b>Pickup/Drop:</b> {selected.address}<br/><i className="bi bi-chat-left-text me-1"></i><b>Notes:</b> {selected.notes || "No notes"}</div>
              <div>
                <div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90', marginBottom:'6px'}}>UPDATE STATUS • BAR COMPLIANT {updating ? "• Saving..." : ""}</div>
                <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
                  {["New","Confirmed","In Progress","Awaiting Parts","Ready","Completed","Cancelled"].map(s=>(
                    <button key={s} disabled={updating} onClick={()=>updateStatus(selected.id, s)} style={{height:'38px', borderRadius:'20px', padding:'0 14px', fontWeight:800, fontSize:'12px', border:`1.5px solid ${selected.status===s ? '#0A192F' : '#E2E8F0'}`, background: selected.status===s ? '#0A192F' : '#fff', color: selected.status===s ? '#fff' : '#0A192F', cursor:'pointer', opacity: updating ? 0.6 : 1}}>{s}</button>
                  ))}
                </div>
              </div>
              <div style={{display:'flex', gap:'10px'}}>
                <button onClick={()=>{ if(onLogPayment) onLogPayment(selected); }} style={{flex:1, height:'46px', borderRadius:'12px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, fontSize:'13px'}}><i className="bi bi-cash-coin me-1"></i> Log Payment • ${selected.amount}</button>
                <button onClick={()=>setSelected(null)} style={{flex:1, height:'46px', borderRadius:'12px', background:'#fff', color:'#0A192F', border:'1.5px solid #E2E8F0', fontWeight:800, fontSize:'13px'}}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}