import { useState, useMemo, useEffect, useCallback } from "react";

const API = "http://127.0.0.1:5000/api";
function getStoredUser(){ try{ return JSON.parse(localStorage.getItem("autoville_user")||"{}"); }catch{ return {}; } }
function mapStatus(raw){
  const s = String(raw||"").toLowerCase();
  if(["completed","done","paid"].includes(s)) return "Completed";
  if(["in_progress","in-progress","diagnosing","diagnosis","awaiting_parts","qc","on_hold"].includes(s)) return "In Progress";
  if(["pending","confirmed","booked","new","scheduled","awaiting"].includes(s)) return "Booked";
  if(["cancelled","canceled"].includes(s)) return "Cancelled";
  return raw ? raw.charAt(0).toUpperCase()+raw.slice(1) : "Booked";
}
function normCustomer(c, idx){
  const cars = c.cars && c.cars.length ? c.cars : [{make: c.car || "Vehicle", plate: c.plate || "", vin: c.vin || "", health: 85}];
  return {
    id: c.id || `#CUST-${3000+idx}`,
    dbId: c.dbId || c.owner_id || c.id,
    name: c.name || c.owner_name || c.customer_name || "Customer",
    email: c.email || c.owner_email || "-",
    phone: c.phone || c.owner_phone || "-",
    avatar: c.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || "Customer")}&background=0A192F&color=fff`,
    car: c.car || "Vehicle",
    plate: c.plate || "CA",
    lastDate: String(c.lastDate || c.last_date || c.booking_date || c.date || "").slice(0,10) || "-",
    nextDate: c.nextDate || c.next_date || "-",
    totalSpent: Number(c.totalSpent ?? c.total_spent ?? 0),
    jobs: Number(c.jobs ?? c.jobCount ?? c.history?.length ?? 0),
    status: mapStatus(c.status),
    rating: c.rating ?? null,
    location: c.location || c.address || "Inglewood, CA",
    loyalty: c.loyalty || (c.jobs>=5 ? `VIP • ${c.jobs} visits` : c.jobs>=2 ? `Repeat • ${c.jobs} visits` : "First Visit"),
    cars,
    history: (c.history || []).map(h=> ({date: String(h.date || h.booking_date || "").slice(0,10), service: h.service || h.service_type || "General Repair", amount: Number(h.amount ?? 0), status: mapStatus(h.status), rating: h.rating ?? null})),
  };
}

export default function MechanicCustomersPage({ workshopId: propWorkshopId, workshop, changeTab }) {
  const storedUser = getStoredUser();
  const workshopId = propWorkshopId || workshop?.id || storedUser.id || storedUser.workshop_id || storedUser.workshopId;
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("All");
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(0);
  const perPage = 6;

  const fetchCustomers = useCallback(async ()=>{
    if(!workshopId){ setLoading(false); return; }
    setLoading(true); setError("");
    try{
      let res = await fetch(`${API}/workshops/${workshopId}/customers?limit=200`);
      let data = await res.json().catch(()=>[]);
      if(!res.ok){
        // Fallback: aggregate from bookings + incomes client-side
        const [bRes, iRes] = await Promise.all([
          fetch(`${API}/bookings?workshop_id=${workshopId}&limit=500`),
          fetch(`${API}/workshops/${workshopId}/incomes?limit=500`),
        ]);
        const bData = await bRes.json().catch(()=>[]);
        const iData = await iRes.json().catch(()=>[]);
        if(!bRes.ok) throw new Error(data.error || "Failed to load customers");
        const bookings = Array.isArray(bData) ? bData : (bData.bookings || []);
        const incomes = Array.isArray(iData) ? iData : (iData.incomes || []);
        // group by owner_name
        const groups = {};
        bookings.forEach(b=>{
          const name = b.owner_name || b.customer_name || b.name || "Customer";
          const key = (b.owner_id ? String(b.owner_id) : name.toLowerCase());
          if(!groups[key]) groups[key] = {name, email: b.owner_email || b.customer_email || "-", phone: b.owner_phone || b.customer_phone || "-", location: "Inglewood, CA", bookings: []};
          groups[key].bookings.push(b);
        });
        const incByName = {};
        incomes.forEach(inc=>{ if(String(inc.status||"").toLowerCase()==="paid") incByName[String(inc.customer_name||"").toLowerCase()] = (incByName[String(inc.customer_name||"").toLowerCase()]||0)+Number(inc.amount||0); });
        const built = Object.values(groups).map((g, idx)=>{
          const bs = [...g.bookings].sort((a,b)=> String(b.booking_date||"").localeCompare(String(a.booking_date||"")));
          const latest = bs[0] || {};
          const carStr = latest.car || latest.vehicle || [latest.car_make, latest.car_model, latest.car_year].filter(Boolean).join(" ") || "Vehicle";
          return {
            id: `#CUST-${3000+idx}`, name: g.name, email: g.email, phone: g.phone, location: g.location,
            car: carStr, plate: latest.plate || latest.license_plate || "CA",
            lastDate: String(latest.booking_date||"").slice(0,10) || "-", nextDate: "-",
            totalSpent: incByName[g.name.toLowerCase()] || bs.filter(x=>mapStatus(x.status)==="Completed").reduce((s,x)=>s+Number(x.amount||0),0),
            jobs: bs.length, status: mapStatus(latest.status), rating: null, loyalty: bs.length>=5?`VIP • ${bs.length} visits`:bs.length>=2?`Repeat • ${bs.length} visits`:"First Visit",
            cars: [{make: carStr, plate: latest.plate||"", vin: latest.vin||"", health: 85}],
            history: bs.map(b=> ({date: String(b.booking_date||"").slice(0,10), service: b.service_type||b.service||"General Repair", amount: Number(b.amount||0), status: mapStatus(b.status), rating: null})),
          };
        });
        setCustomers(built.map((c,i)=> normCustomer(c,i)));
        setLoading(false);
        return;
      }
      const list = Array.isArray(data) ? data : (data.customers || data.data || []);
      setCustomers(list.map((c,i)=> normCustomer(c,i)));
    }catch(e){ setError(e.message || "Could not load customers. Is Flask running on :5000?"); setCustomers([]); }
    setLoading(false);
  }, [workshopId]);

  useEffect(()=>{ fetchCustomers(); }, [fetchCustomers]);

  const filtered = useMemo(()=>{
    let d=[...customers];
    if(search){ const s=search.toLowerCase(); d=d.filter(c=> `${c.name} ${c.email} ${c.car} ${c.plate} ${c.phone} ${c.id}`.toLowerCase().includes(s)); }
    if(statusF!=="All") d=d.filter(c=>c.status===statusF);
    d.sort((a,b)=> new Date(b.lastDate)-new Date(a.lastDate));
    return d;
  },[customers, search, statusF]);

  const totalPages = Math.ceil(filtered.length/perPage);
  const paged = filtered.slice(page*perPage, page*perPage+perPage);

  const stats = {
    total: customers.length,
    booked: customers.filter(c=>c.status==="Booked").length,
    progress: customers.filter(c=>c.status==="In Progress").length,
    completed: customers.filter(c=>c.status==="Completed").length,
    revenue: customers.reduce((s,c)=>s+c.totalSpent,0),
    repeat: customers.filter(c=>c.loyalty.includes("Repeat")||c.loyalty.includes("VIP")).length,
  };

  const statusStyle=(s)=> s==="Completed"?{bg:"#DCFCE7", color:"#166534", dot:"#22C55E"}: s==="In Progress"?{bg:"#DBEAFE", color:"#1E40AF", dot:"#3B82F6"}: {bg:"#FEF3C7", color:"#92400E", dot:"#F59E0B"};

  if(loading) return <div style={{padding:"40px", textAlign:"center", color:"#64748B"}}>Loading customers from backend...</div>;

  return (
    <>
    <style>{`
      .cust-wrap{ width:100%; max-width:100%; overflow:hidden; }
      .cust-stat{ background:#fff; border:1.5px solid #0A192F; border-radius:18px; padding:18px; height:100%; }
      .cust-toolbar{ background:#fff; border:1.5px solid #E2E8F0; border-radius:16px; padding:16px; display:flex; gap:12px; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom:16px; }
      .cust-search{ position:relative; flex:1; min-width:240px; max-width:360px; } .cust-search input{ width:100%; height:48px; border:1.5px solid #E2E8F0; border-radius:14px; padding:0 14px 0 44px; font-size:15px; font-weight:600; background:#F8FAFC; outline:none; } .cust-search i{ position:absolute; left:16px; top:50%; transform:translateY(-50%); color:#6B7A90; font-size:16px; }
      .cust-table-wrap{ background:#fff; border:1.5px solid #E2E8F0; border-radius:18px; overflow:hidden; width:100%; }
      .cust-table{ width:100%; border-collapse:collapse; } .cust-table th{ text-align:left; font-size:12px; font-weight:900; color:#6B7A90; padding:14px 14px; border-bottom:1.5px solid #E2E8F0; background:#F8FAFC; text-transform:uppercase; letter-spacing:0.04em; }
      .cust-table td{ padding:14px; font-size:14px; font-weight:600; color:#0A192F; border-bottom:1px solid #F1F5F9; vertical-align:middle; }
      .cust-mobile{ display:none; } @media(max-width: 768px){ .cust-table-wrap.desktop{ display:none; } .cust-mobile{ display:grid; gap:14px; } .cust-toolbar{ flex-direction:column; align-items:stretch; } .cust-search{ max-width:100%; } }
      .cust-modal-backdrop{ position:fixed; inset:0; background:rgba(10,25,47,0.55); backdrop-filter:blur(6px); z-index:99; display:grid; place-items:center; padding:16px; } .cust-modal{ width:100%; max-width:720px; max-height:92vh; overflow:auto; background:#fff; border:2px solid #0A192F; border-radius:22px; box-shadow:0 30px 80px rgba(0,0,0,0.25); }
    `}</style>

    <div className="cust-wrap">
      <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', marginBottom:'14px'}}>
        <div><h2 style={{fontWeight:900, fontSize:'30px', color:'#0A192F', margin:'0 0 8px', lineHeight:1.15}}>Customers • Car Owners</h2><p style={{color:'#6B7A90', fontSize:'16px', margin:0, fontWeight:500}}>Owners who completed service + Booked + In Progress • BAR ARD 284719 • Inglewood, CA • USD • PST</p></div>
        <div style={{display:'flex', gap:'8px', alignSelf:'flex-start'}}>
          <button onClick={fetchCustomers} style={{height:'46px', borderRadius:'12px', background:'#fff', border:'1.5px solid #E2E8F0', fontWeight:800, fontSize:'13px', padding:'0 14px'}}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
          <span style={{height:'46px', borderRadius:'12px', background:'#0A192F', color:'#fff', fontWeight:800, fontSize:'14px', padding:'0 16px', display:'grid', placeItems:'center'}}>{filtered.length} customers • ${stats.revenue} lifetime</span>
        </div>
      </div>

      {error && <div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", color:"#991B1B", padding:"12px 14px", borderRadius:"12px", marginBottom:"12px", fontSize:"13px", fontWeight:700}}>{error}</div>}

      <div className="row g-3 mb-3" style={{margin:0, width:'100%'}}>
        <div className="col-6 col-lg-3"><div className="cust-stat"><div style={{fontSize:'13px', fontWeight:800, color:'#6B7A90'}}>TOTAL CUSTOMERS</div><div style={{fontWeight:900, fontSize:'30px', marginTop:'8px', color:'#0A192F'}}>{stats.total}</div><div style={{fontSize:'13px', color:'#6B7A90', fontWeight:600, marginTop:'4px'}}>{stats.repeat} repeat • VIP</div></div></div>
        <div className="col-6 col-lg-3"><div className="cust-stat" style={{borderColor:'#F59E0B', background:'#FFFBEB'}}><div style={{fontSize:'13px', fontWeight:800, color:'#92400E'}}>BOOKED • UPCOMING</div><div style={{fontWeight:900, fontSize:'30px', marginTop:'8px', color:'#92400E'}}>{stats.booked}</div><div style={{fontSize:'13px', color:'#92400E', fontWeight:600, marginTop:'4px'}}>Scheduled maintenance</div></div></div>
        <div className="col-6 col-lg-3"><div className="cust-stat" style={{borderColor:'#3B82F6', background:'#EFF6FF'}}><div style={{fontSize:'13px', fontWeight:800, color:'#1E40AF'}}>IN PROGRESS</div><div style={{fontWeight:900, fontSize:'30px', marginTop:'8px', color:'#1E40AF'}}>{stats.progress}</div><div style={{fontSize:'13px', color:'#1E40AF', fontWeight:600, marginTop:'4px'}}>Live in garage now</div></div></div>
        <div className="col-6 col-lg-3"><div className="cust-stat" style={{borderColor:'#22C55E', background:'#F0FDF4'}}><div style={{fontSize:'13px', fontWeight:800, color:'#166534'}}>COMPLETED • SERVICED</div><div style={{fontWeight:900, fontSize:'30px', marginTop:'8px', color:'#166534'}}>{stats.completed}</div><div style={{fontSize:'13px', color:'#166534', fontWeight:600, marginTop:'4px'}}>Successfully serviced</div></div></div>
      </div>

      <div className="cust-toolbar">
        <div className="cust-search"><i className="bi bi-search"></i><input placeholder="Search name, car, plate, phone..." value={search} onChange={e=>{setSearch(e.target.value); setPage(0);}} /></div>
        <div style={{display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center'}}>
          <span style={{fontSize:'13px', fontWeight:900, color:'#6B7A90'}}>STATUS:</span>
          {["All","Booked","In Progress","Completed"].map(s=>(
            <button key={s} onClick={()=>{setStatusF(s); setPage(0);}} style={{height:'44px', borderRadius:'22px', padding:'0 18px', fontWeight:800, fontSize:'14px', border:`1.5px solid ${statusF===s ? '#0A192F' : '#E2E8F0'}`, background: statusF===s ? '#0A192F' : '#fff', color: statusF===s ? '#fff' : '#0A192F', cursor:'pointer'}}>{s} {s!=="All" && `• ${s==="Booked"?stats.booked:s==="In Progress"?stats.progress:stats.completed}`}</button>
          ))}
        </div>
      </div>

      <div className="cust-table-wrap desktop">
        <table className="cust-table">
          <thead><tr><th>Customer • Loyalty</th><th>Car • Plate • CA</th><th>Last • Next Service</th><th>Spent • Jobs</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {paged.length===0 ? <tr><td colSpan={6} style={{textAlign:'center', padding:'30px', color:'#6B7A90', fontSize:'15px', fontWeight:600}}>{customers.length===0 ? "No customers yet. Customers appear after an owner books with your workshop." : `No customers found for ${statusF}`}</td></tr> :
            paged.map(c=>{
              const st=statusStyle(c.status);
              return (
                <tr key={c.id}>
                  <td><div style={{display:'flex', gap:'12px', alignItems:'center'}}><img src={c.avatar} alt={c.name} style={{width:'48px', height:'48px', borderRadius:'50%', objectFit:'cover', border:'2px solid #E2E8F0'}} /><div><div style={{fontWeight:800, fontSize:'15px'}}>{c.name}</div><div style={{fontSize:'12px', color:'#6B7A90'}}>{c.id} • {c.loyalty}</div><div style={{fontSize:'12px', color:'#6B7A90'}}>{c.phone} • {c.location}</div></div></div></td>
                  <td><div style={{fontSize:'14px', fontWeight:700}}>{String(c.car||"").split('•')[0]}</div><div style={{fontSize:'12px', color:'#6B7A90'}}>{c.plate}</div><div style={{fontSize:'11px', color:'#6B7A90'}}>{String(c.cars?.[0]?.vin || "").slice(-6)} • Health {c.cars?.[0]?.health ?? 85}%</div></td>
                  <td><div style={{fontSize:'13px', fontWeight:700}}>{c.lastDate}</div><div style={{fontSize:'12px', color:'#6B7A90'}}>Next: {c.nextDate}</div></td>
                  <td><div style={{fontSize:'15px', fontWeight:800, color:'#0A192F'}}>${c.totalSpent}</div><div style={{fontSize:'12px', color:'#6B7A90'}}>{c.jobs} jobs • {c.rating ? `${c.rating}★` : 'No rating'}</div></td>
                  <td><span style={{fontSize:'12px', fontWeight:800, padding:'6px 12px', borderRadius:'20px', background:st.bg, color:st.color, display:'inline-flex', alignItems:'center', gap:'6px'}}><span style={{width:'8px', height:'8px', borderRadius:'50%', background:st.dot, display:'inline-block'}}></span>{c.status.toUpperCase()}</span></td>
                  <td><button onClick={()=>setSelected(c)} style={{height:'38px', borderRadius:'10px', border:'1.5px solid #0A192F', background:'#0A192F', color:'#fff', fontWeight:800, fontSize:'13px', padding:'0 14px'}}>View</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', borderTop:'1.5px solid #E2E8F0', background:'#F8FAFC', flexWrap:'wrap', gap:'10px'}}>
          <div style={{fontSize:'14px', fontWeight:700, color:'#6B7A90'}}>{filtered.length===0 ? "0" : `${page*perPage+1}–${Math.min((page+1)*perPage, filtered.length)}`} of {filtered.length} • Page {page+1}/{totalPages||1} • {statusF} • BAR ARD 284719</div>
          <div style={{display:'flex', gap:'8px'}}><button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))} style={{height:'40px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff', fontWeight:800, fontSize:'13px', padding:'0 14px'}}>Prev</button><button disabled={page>=totalPages-1} onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} style={{height:'40px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff', fontWeight:800, fontSize:'13px', padding:'0 14px'}}>Next</button></div>
        </div>
      </div>

      <div className="cust-mobile">
        {paged.map(c=>{
          const st=statusStyle(c.status);
          return (
            <div key={c.id} style={{background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:'18px', padding:'18px'}}>
              <div style={{display:'flex', gap:'12px', alignItems:'center', marginBottom:'10px'}}><img src={c.avatar} style={{width:'56px', height:'56px', borderRadius:'50%', objectFit:'cover'}} alt="" /><div style={{flex:1}}><div style={{fontWeight:900, fontSize:'16px'}}>{c.name}</div><div style={{fontSize:'12px', color:'#6B7A90'}}>{c.id} • {c.loyalty} • {c.location}</div><div style={{marginTop:'4px'}}><span style={{fontSize:'12px', fontWeight:800, padding:'5px 12px', borderRadius:'20px', background:st.bg, color:st.color}}>{c.status}</span></div></div><div style={{textAlign:'right'}}><div style={{fontWeight:900, fontSize:'18px'}}>${c.totalSpent}</div><div style={{fontSize:'12px', color:'#6B7A90'}}>{c.jobs} jobs</div></div></div>
              <div style={{fontSize:'14px', fontWeight:700}}>{c.car}</div>
              <div style={{fontSize:'12px', color:'#6B7A90', marginBottom:'8px'}}>{c.phone} • Last {c.lastDate} • Next {c.nextDate}</div>
              <button onClick={()=>setSelected(c)} style={{width:'100%', height:'48px', borderRadius:'12px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, fontSize:'14px'}}><i className="bi bi-eye me-2"></i>View Customer • {c.plate}</button>
            </div>
          );
        })}
        {paged.length===0 && <div style={{padding:"24px", textAlign:"center", color:"#6B7A90"}}>No customers found</div>}
      </div>
    </div>

    {selected && (
      <div className="cust-modal-backdrop" onClick={()=>setSelected(null)}>
        <div className="cust-modal" onClick={e=>e.stopPropagation()}>
          <div style={{padding:'18px', borderBottom:'1.5px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#F8FAFC', position:'sticky', top:0, zIndex:2}}>
            <div style={{display:'flex', gap:'14px', alignItems:'center'}}><img src={selected.avatar} style={{width:'56px', height:'56px', borderRadius:'50%', objectFit:'cover', border:'2px solid #0A192F'}} alt="" /><div><div style={{fontWeight:900, fontSize:'17px', color:'#0A192F'}}>{selected.name} • {selected.id} • {selected.loyalty}</div><div style={{fontSize:'13px', color:'#6B7A90'}}>{selected.car} • {selected.plate} • {selected.location} • BAR ARD 284719</div></div></div>
            <button onClick={()=>setSelected(null)} style={{width:'40px', height:'40px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#fff', flexShrink:0}}><i className="bi bi-x-lg"></i></button>
          </div>

          <div style={{padding:'18px', display:'grid', gap:'16px'}}>
            <div className="row g-3" style={{margin:0}}>
              <div className="col-6"><div style={{background:'#F8FAFC', border:'1.5px solid #E2E8F0', borderRadius:'14px', padding:'14px'}}><div style={{fontSize:'12px', fontWeight:800, color:'#6B7A90'}}>CONTACT • LA</div><div style={{fontSize:'14px', fontWeight:700, marginTop:'4px', wordBreak:'break-all'}}>{selected.email}</div><div style={{fontSize:'14px', fontWeight:700}}>{selected.phone}</div><div style={{fontSize:'12px', color:'#6B7A90', marginTop:'4px'}}>{selected.location}</div></div></div>
              <div className="col-6"><div style={{background:'#0A192F', borderRadius:'14px', padding:'14px', color:'#fff', height:'100%'}}><div style={{fontSize:'12px', fontWeight:800, color:'#94A3B8'}}>LIFETIME • P/L</div><div style={{fontWeight:900, fontSize:'22px', marginTop:'4px'}}>${selected.totalSpent} • {selected.jobs} jobs</div><div style={{fontSize:'12px', color:'#94A3B8', marginTop:'4px'}}>Last {selected.lastDate} • Next {selected.nextDate} • {selected.rating?`${selected.rating}★ rating`:'New customer'}</div></div></div>
            </div>

            <div style={{border:'1.5px solid #0A192F', borderRadius:'16px', padding:'16px'}}>
              <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'8px', marginBottom:'10px'}}><div style={{fontWeight:900, fontSize:'15px'}}>Status • {selected.status} • Service History</div><span style={{fontSize:'12px', fontWeight:800, padding:'6px 12px', borderRadius:'20px', background:statusStyle(selected.status).bg, color:statusStyle(selected.status).color}}>{selected.status.toUpperCase()}</span></div>
              <div style={{display:'grid', gap:'10px'}}>
                {selected.history.length===0 && <div style={{fontSize:'13px', color:'#6B7A90'}}>No history yet</div>}
                {selected.history.map((h,i)=>(
                  <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', border:'1px solid #E2E8F0', borderRadius:'12px', background: h.status==="Completed"?'#F0FDF4': h.status==="In Progress"?'#EFF6FF':'#FFFBEB'}}>
                    <div><div style={{fontWeight:800, fontSize:'14px'}}>{h.service}</div><div style={{fontSize:'12px', color:'#6B7A90'}}>{h.date} • {h.status} • {h.rating?`${h.rating}★`:'Pending rating'}</div></div><div style={{fontWeight:800, fontSize:'14px'}}>${h.amount}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'12px', padding:'14px', fontSize:'13px', color:'#6B7A90'}}>
              <div style={{fontWeight:800, color:'#0A192F', fontSize:'14px', marginBottom:'4px'}}><i className="bi bi-car-front me-1"></i>Vehicle • {selected.cars?.[0]?.make || selected.car} • {selected.plate}</div>
              <div>VIN {selected.cars?.[0]?.vin || "-"} • Health {selected.cars?.[0]?.health ?? 85}% • Last Service {selected.lastDate} PST • Next {selected.nextDate} • BAR ARD 284719 • 112 S Market St, Ste 1008, Inglewood, CA 90301 • Support Peter +1-201-534-2657</div>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
              <button onClick={()=>{ window.open(`tel:${selected.phone}`); }} style={{height:'48px', borderRadius:'12px', background:'#fff', border:'1.5px solid #0A192F', fontWeight:800, fontSize:'14px'}}><i className="bi bi-telephone me-2"></i>Call</button>
              <button onClick={()=>setSelected(null)} style={{height:'48px', borderRadius:'12px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, fontSize:'14px'}}>Close • {selected.id}</button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}