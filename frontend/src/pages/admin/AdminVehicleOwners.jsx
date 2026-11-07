import { useState, useMemo, useEffect } from "react";
import Swal from "sweetalert2";

export default function AdminVehicleOwners(){
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);

  // REAL DATA - replaces 3 fake owners
  useEffect(()=>{
    fetch("http://127.0.0.1:5000/api/owners")
      .then(r=>r.json())
      .then(data=>{
        const arr = Array.isArray(data) ? data : [];
        const mapped = arr.map((o)=>{
          const addr = o.address || "312 E Queen St, Inglewood, CA 90301";
          let city = "Inglewood", zip = "90301";
          const m = addr.match(/([A-Za-z ]+)\s*,?\s*CA\s+(\d{5})/);
          if(m){ city = m[1].trim().split(",").pop().trim(); zip = m[2]; }
          return {
            _dbId: o.id,
            id: "OWN-"+String(o.id).padStart(3,"0"),
            name: o.name || o.full_name || "Owner",
            email: o.email || "",
            phone: o.phone || "",
            city, zip,
            joined: o.created_at ? String(o.created_at).split("T")[0] : "2026-11-06",
            lastActive: o.last_active ? String(o.last_active) + " PST" : "2026-11-06 02:31 PM PST",
            status: o.status || "Active",
            cars: 0, // filled when vehicles modal opens
            spent: "$"+Number(o.spent || 0).toLocaleString(),
            bookings: Number(o.bookings || 0),
            rating: Number(o.rating || 0),
            verified: true,
            dob: o.dob ? String(o.dob).split("T")[0] : "—",
            gender: o.gender || "—",
            license: o.license || "—",
            insurance: o.insurance || "—",
            address: addr,
            avatar: o.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
            coverCar: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=600&q=80",
            vehicles: [] // lazy-loaded
          };
        });
        setOwners(mapped);
        setLoading(false);
      })
      .catch(()=> setLoading(false));
  },[]);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [cityFilter, setCityFilter] = useState("All");
  const [sortField, setSortField] = useState("joined");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(0);
  const perPage = 5;
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showVehicles, setShowVehicles] = useState(false);

  async function openVehicles(o){
    setSelected(o); setShowVehicles(true);
    // fetch real cars for this owner
    try{
      const res = await fetch(`http://127.0.0.1:5000/api/owners/${o._dbId}/vehicles`);
      const cars = await res.json();
      const vehicles = (Array.isArray(cars) ? cars : []).map(c=>({
        vin: c.vin || "—",
        make: c.make || "Toyota",
        model: c.model || "",
        year: c.year || 2020,
        plate: c.plate_number || c.plate || "—",
        status: c.status || "Healthy",
        mileage: c.mileage ? String(c.mileage)+"k" : "0k",
        lastService: c.last_service_date ? String(c.last_service_date).split("T")[0] : "—",
        color: c.color || "—",
        fuel: c.fuel_type || c.fuel || "Gasoline",
        image: c.image_url || "https://images.unsplash.com/photo-1623869675781-80b012a09b55?auto=format&fit=crop&w=300&q=80"
      }));
      const updated = {...o, vehicles, cars: vehicles.length};
      setSelected(updated);
      setOwners(prev=>prev.map(x=>x.id===o.id ? updated : x));
    }catch{}
  }

  const cities = useMemo(()=>{ var s={}; owners.forEach(o=>s[o.city]=1); return ["All"].concat(Object.keys(s)); },[owners]);
  const filtered = useMemo(()=>{
    var list = owners.filter(o=>{
      var matchQ = (o.name+" "+o.email+" "+o.city+" "+o.id+" "+o.phone).toLowerCase().indexOf(q.toLowerCase())>-1;
      return matchQ && (statusFilter==="All"||o.status===statusFilter) && (cityFilter==="All"||o.city===cityFilter);
    });
    list.sort((a,b)=>{
      var av=a[sortField], bv=b[sortField]; if(sortField==="cars"){av=a.cars; bv=b.cars;}
      if(av<bv) return sortDir==="asc"?-1:1; if(av>bv) return sortDir==="asc"?1:-1; return 0;
    }); return list;
  },[owners,q,statusFilter,cityFilter,sortField,sortDir]);

  const totalPages = Math.ceil(filtered.length/perPage);
  const paged = filtered.slice(page*perPage, page*perPage+perPage);
  function handleSort(f){ if(sortField===f) setSortDir(d=>d==="asc"?"desc":"asc"); else {setSortField(f); setSortDir("asc");} }
  function toggleStatus(owner){
    var next = owner.status==="Active"?"Inactive":"Active";
    Swal.fire({title:(next==="Active"?"Activate ":"Deactivate ")+owner.name+"?", text:next==="Active"?"Owner will be able to book again • PST":"Blocked from booking • BAR audit", icon:next==="Active"?"question":"warning", showCancelButton:true, confirmButtonColor:next==="Active"?"#0A192F":"#DC2626", confirmButtonText:next==="Active"?"Yes, Activate":"Yes, Deactivate"}).then(r=>{
      if(r.isConfirmed){ fetch(`http://127.0.0.1:5000/api/owners/${owner._dbId}/status`, {method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({status: next})}).catch(()=>{}); setOwners(prev=>prev.map(o=>o.id===owner.id?{...o,status:next}:o)); if(selected && selected.id===owner.id){ setSelected(s=>({...s, status:next})); } Swal.fire({icon:"success", title:next, timer:1200, showConfirmButton:false}); }
    });
  }

  const totalVehicles = owners.reduce((s,o)=>s+o.cars,0);
  const avgRating = owners.length ? (owners.reduce((s,o)=>s+o.rating,0)/owners.length).toFixed(1) : "0.0";

  return (
    <div style={{display:"grid", gap:"16px", fontSize:"15px"}}>
      <style>{`
        .owner-card{ background:#fff; border:1.5px solid #E2E8F0; border-radius:18px; padding:18px; }
        .owner-table th{ font-size:12px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.6px; background:#F8FAFC; padding:14px 12px; }
        .owner-table td{ padding:14px 12px; vertical-align:middle; font-size:15px; }
        .badge-active{ background:#DCFCE7; color:#166534; border:1px solid #BBF7D0; padding:5px 12px; border-radius:20px; font-size:11px; font-weight:800; }
        .badge-inactive{ background:#FEF2F2; color:#991B1B; border:1px solid #FECACA; padding:5px 12px; border-radius:20px; font-size:11px; font-weight:800; }
        .modal-overlay{ position:fixed; inset:0; background:rgba(10,25,47,0.65); backdrop-filter:blur(6px); z-index:90; display:grid; place-items:center; padding:16px; }
        .modal-box{ width:100%; background:#fff; border-radius:22px; border:1.5px solid #E2E8F0; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.2); animation:pop 0.22s ease; }
        @keyframes pop{ from{transform:scale(0.96) translateY(8px); opacity:0} to{transform:scale(1) translateY(0); opacity:1} }
        .info-label{ font-size:11px; font-weight:800; color:#94A3B8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px; }
        .info-value{ font-size:14.5px; font-weight:700; color:#0A192F; }
      `}</style>

      <div className="row g-3" style={{margin:0, width:"100%"}}>
        <div className="col-6 col-lg-3"><div style={{background:"#0A192F", borderRadius:"18px", padding:"18px", color:"#fff"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8", letterSpacing:"0.5px"}}>TOTAL OWNERS</div><div style={{fontSize:"32px", fontWeight:900, marginTop:"4px"}}>{loading ? "..." : owners.length}</div><div style={{fontSize:"12px", color:"#CBD5E1", marginTop:"2px"}}>LA County • PST • Real DB</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#DCFCE7", borderColor:"#BBF7D0"}}><div style={{fontSize:"11px", fontWeight:800, color:"#166534"}}>ACTIVE</div><div style={{fontSize:"32px", fontWeight:900, color:"#166534"}}>{owners.filter(o=>o.status==="Active").length}</div><div style={{fontSize:"12px", color:"#16A34A"}}>{owners.length ? Math.round((owners.filter(o=>o.status==="Active").length/owners.length)*100) : 0}% active</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card"><div style={{fontSize:"11px", fontWeight:800, color:"#64748B"}}>TOTAL VEHICLES</div><div style={{fontSize:"32px", fontWeight:900, color:"#0A192F"}}>{totalVehicles}</div><div style={{fontSize:"12px", color:"#64748B"}}>Avg {owners.length ? (totalVehicles/owners.length).toFixed(1) : "0.0"} / owner</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#EFF6FF"}}><div style={{fontSize:"11px", fontWeight:800, color:"#1E40AF"}}>AVG RATING</div><div style={{fontSize:"32px", fontWeight:900, color:"#1E40AF"}}>{avgRating}</div><div style={{fontSize:"12px", color:"#3B82F6"}}>Trusted owners</div></div></div>
      </div>

      <div className="owner-card" style={{padding:"20px"}}>
        <div style={{display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:"12px", marginBottom:"16px"}}>
          <div>
            <div style={{fontWeight:900, fontSize:"18px", color:"#0A192F"}}><i className="bi bi-people-fill me-2"></i>Vehicle Owners • Datatable</div>
            <div style={{fontSize:"13px", color:"#64748B", fontWeight:600, marginTop:"3px"}}>{filtered.length} records • 15px font • 112 S Market St Inglewood CA 90301</div>
          </div>
          <div style={{display:"flex", gap:"8px", flexWrap:"wrap"}}>
            <select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value); setPage(0);}} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px"}}><option value="All">All Status</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select>
            <select value={cityFilter} onChange={e=>{setCityFilter(e.target.value); setPage(0);}} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px"}}>{cities.map(c=><option key={c} value={c}>{c}</option>)}</select>
            <div style={{position:"relative"}}><i className="bi bi-search" style={{position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", color:"#94A3B8"}}></i><input value={q} onChange={e=>{setQ(e.target.value); setPage(0);}} placeholder="Search name, email, ID, phone..." style={{height:"44px", width:"260px", borderRadius:"12px", border:"1.5px solid #E2E8F0", background:"#F8FAFC", padding:"0 14px 0 40px", fontSize:"14px", fontWeight:600}} /></div>
          </div>
        </div>

        <div style={{overflowX:"auto", borderRadius:"14px", border:"1.5px solid #E2E8F0"}}>
          <table className="table owner-table" style={{margin:0}}>
            <thead><tr><th style={{cursor:"pointer"}} onClick={()=>handleSort("id")}>ID {sortField==="id"?(sortDir==="asc"?"↑":"↓"):""}</th><th>Owner</th><th>City</th><th style={{cursor:"pointer"}} onClick={()=>handleSort("cars")}>Cars</th><th>Status</th><th style={{textAlign:"right"}}>Actions</th></tr></thead>
            <tbody>{paged.map(o=><tr key={o.id}><td style={{fontWeight:900, color:"#0A192F"}}>{o.id}</td>
            <td><div style={{display:"flex", gap:"12px", alignItems:"center"}}><img src={o.avatar} alt="" style={{width:"44px", height:"44px", borderRadius:"12px", objectFit:"cover", border:"1.5px solid #E2E8F0"}} /><div><div style={{fontWeight:800, color:"#0A192F", fontSize:"15px"}}>{o.name}</div><div style={{fontSize:"13px", color:"#64748B"}}>{o.email}</div></div></div></td>
            <td><div style={{fontWeight:700, fontSize:"14px"}}>{o.city}</div><div style={{fontSize:"12px", color:"#94A3B8"}}>{o.zip}</div></td>
            <td><span style={{background:"#F1F5F9", border:"1px solid #E2E8F0", padding:"5px 12px", borderRadius:"20px", fontWeight:800, fontSize:"13px"}}><i className="bi bi-car-front me-1"></i>{o.cars}</span></td>
            <td><span className={o.status==="Active"?"badge-active":"badge-inactive"}>{o.status}</span></td>
            <td><div style={{display:"flex", gap:"7px", justifyContent:"flex-end"}}><button onClick={()=>{setSelected(o); setShowDetail(true);}} style={{height:"36px", padding:"0 12px", borderRadius:"10px", border:"1.5px solid #E2E8F0", background:"#fff", fontWeight:800, fontSize:"13px"}}><i className="bi bi-eye me-1"></i>View</button><button onClick={()=>openVehicles(o)} style={{height:"36px", padding:"0 12px", borderRadius:"10px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"13px"}}>{o.cars} Cars</button><button onClick={()=>toggleStatus(o)} style={{height:"36px", width:"36px", borderRadius:"10px", border:"1.5px solid #E2E8F0", background:o.status==="Active"?"#FEF2F2":"#DCFCE7", color:o.status==="Active"?"#DC2626":"#166534"}}><i className={"bi "+(o.status==="Active"?"bi-person-slash":"bi-person-check")}></i></button></div></td></tr>)}
            {paged.length===0 && !loading && <tr><td colSpan={6} style={{padding:20, textAlign:"center", color:"#94A3B8"}}>No owners yet. Register an owner to see them here.</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"16px", flexWrap:"wrap", gap:"10px"}}>
          <div style={{fontSize:"13px", fontWeight:700, color:"#64748B"}}>{filtered.length ? page*perPage+1 : 0} - {Math.min((page+1)*perPage, filtered.length)} of {filtered.length} • Page {page+1}/{totalPages||1}</div>
          <div style={{display:"flex", gap:"8px"}}><button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))} style={{height:"40px", padding:"0 16px", borderRadius:"10px", border:"1.5px solid #E2E8F0", background:page===0?"#F8FAFC":"#fff", fontWeight:800}}>Prev</button>
          {Array.from({length:totalPages}).map((_,i)=><button key={i} onClick={()=>setPage(i)} style={{width:"40px", height:"40px", borderRadius:"10px", border:"1.5px solid "+(i===page?"#0A192F":"#E2E8F0"), background:i===page?"#0A192F":"#fff", color:i===page?"#fff":"#0A192F", fontWeight:800}}>{i+1}</button>)}
          <button disabled={page===totalPages-1||totalPages===0} onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} style={{height:"40px", padding:"0 16px", borderRadius:"10px", border:"1.5px solid #E2E8F0", background:page===totalPages-1?"#F8FAFC":"#fff", fontWeight:800}}>Next</button></div>
        </div>
      </div>

      {showDetail && selected && (
        <div className="modal-overlay" onClick={()=>setShowDetail(false)}>
          <div className="modal-box" style={{maxWidth:"620px"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:"#0A192F", padding:"0", position:"relative", overflow:"hidden"}}>
              <img src={selected.coverCar} alt="" style={{width:"100%", height:"140px", objectFit:"cover", opacity:0.35}} />
              <div style={{position:"absolute", inset:0, background:"linear-gradient(to bottom, rgba(10,25,47,0.1), rgba(10,25,47,0.95))"}}></div>
              <button onClick={()=>setShowDetail(false)} style={{position:"absolute", top:"16px", right:"16px", width:"38px", height:"38px", borderRadius:"12px", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.18)", color:"#fff", backdropFilter:"blur(6px)"}}><i className="bi bi-x-lg"></i></button>
              <div style={{position:"absolute", bottom:"0", left:0, right:0, padding:"18px 22px", display:"flex", gap:"16px", alignItems:"flex-end"}}>
                <img src={selected.avatar} alt="" style={{width:"88px", height:"88px", borderRadius:"20px", border:"4px solid #fff", objectFit:"cover", boxShadow:"0 8px 24px rgba(0,0,0,0.3)"}} />
                <div style={{paddingBottom:"6px"}}>
                  <div style={{display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap"}}><span style={{fontWeight:900, fontSize:"20px", color:"#fff"}}>{selected.name}</span>{selected.verified && <span style={{background:"#22C55E", color:"#fff", fontSize:"10px", fontWeight:800, padding:"3px 8px", borderRadius:"20px"}}><i className="bi bi-patch-check-fill me-1"></i>VERIFIED</span>}<span className={selected.status==="Active"?"badge-active":"badge-inactive"} style={{border:"none"}}>{selected.status}</span></div>
                  <div style={{color:"#CBD5E1", fontSize:"13px", marginTop:"2px", fontWeight:600}}>{selected.id} • {selected.city} • {selected.rating} <i className="bi bi-star-fill" style={{color:"#F59E0B", fontSize:"12px"}}></i></div>
                </div>
              </div>
            </div>
            <div style={{padding:"22px", display:"grid", gap:"16px", maxHeight:"70vh", overflowY:"auto"}}>
              <div className="row g-3" style={{margin:0, width:"100%"}}>
                <div className="col-6"><div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"14px"}}><div className="info-label"><i className="bi bi-envelope me-1"></i>Email</div><div className="info-value" style={{fontSize:"13.5px"}}>{selected.email}</div></div></div>
                <div className="col-6"><div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"14px"}}><div className="info-label"><i className="bi bi-telephone me-1"></i>Phone</div><div className="info-value">{selected.phone}</div></div></div>
                <div className="col-12"><div style={{background:"#EFF6FF", border:"1.5px solid #DBEAFE", borderRadius:"14px", padding:"14px"}}><div className="info-label"><i className="bi bi-geo-alt me-1"></i>Address • {selected.zip}</div><div className="info-value">{selected.address}</div></div></div>
                <div className="col-6"><div style={{background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"14px"}}><div className="info-label">Gender / DOB</div><div className="info-value">{selected.gender} • {selected.dob}</div></div></div>
                <div className="col-6"><div style={{background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"14px"}}><div className="info-label">License</div><div className="info-value" style={{fontSize:"13px"}}>{selected.license}</div></div></div>
                <div className="col-6"><div style={{background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"14px"}}><div className="info-label">Insurance</div><div className="info-value" style={{fontSize:"13px"}}>{selected.insurance}</div></div></div>
                <div className="col-6"><div style={{background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"14px"}}><div className="info-label">Joined / Last Active</div><div className="info-value" style={{fontSize:"12px"}}>{selected.joined}<br/><span style={{color:"#64748B"}}>{selected.lastActive}</span></div></div></div>
              </div>
              <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"10px"}}>
                <div style={{background:"#0A192F", borderRadius:"14px", padding:"12px", textAlign:"center", color:"#fff"}}><div style={{fontSize:"20px", fontWeight:900}}>{selected.cars}</div><div style={{fontSize:"11px", color:"#94A3B8", fontWeight:700}}>CARS</div></div>
                <div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"12px", textAlign:"center"}}><div style={{fontSize:"20px", fontWeight:900}}>{selected.bookings}</div><div style={{fontSize:"11px", color:"#64748B", fontWeight:700}}>BOOKINGS</div></div>
                <div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"12px", textAlign:"center"}}><div style={{fontSize:"20px", fontWeight:900}}>{selected.spent}</div><div style={{fontSize:"11px", color:"#64748B", fontWeight:700}}>SPENT</div></div>
                <div style={{background:"#FEF3C7", border:"1.5px solid #FDE68A", borderRadius:"14px", padding:"12px", textAlign:"center"}}><div style={{fontSize:"20px", fontWeight:900, color:"#92400E"}}>{selected.rating}</div><div style={{fontSize:"11px", color:"#B45309", fontWeight:700}}>RATING</div></div>
              </div>
              <div style={{display:"flex", gap:"10px"}}>
                <button onClick={()=>{setShowDetail(false); openVehicles(selected);}} style={{flex:1, height:"46px", borderRadius:"12px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"14px"}}><i className="bi bi-car-front-fill me-2"></i>View {selected.cars} Vehicles</button>
                <button onClick={()=>toggleStatus(selected)} style={{height:"46px", padding:"0 18px", borderRadius:"12px", background:selected.status==="Active"?"#FEF2F2":"#DCFCE7", color:selected.status==="Active"?"#DC2626":"#166534", border:"1.5px solid "+(selected.status==="Active"?"#FECACA":"#BBF7D0"), fontWeight:800, fontSize:"14px"}}>{selected.status==="Active"?"Deactivate":"Activate"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showVehicles && selected && (
        <div className="modal-overlay" onClick={()=>setShowVehicles(false)}>
          <div className="modal-box" style={{maxWidth:"760px"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:"#0A192F", padding:"18px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", color:"#fff"}}>
              <div style={{display:"flex", gap:"12px", alignItems:"center"}}>
                <img src={selected.avatar} alt="" style={{width:"44px", height:"44px", borderRadius:"12px", border:"2px solid rgba(255,255,255,0.3)"}} />
                <div><div style={{fontWeight:900, fontSize:"16px"}}>{selected.name} • Fleet</div><div style={{fontSize:"12px", color:"#94A3B8"}}>{selected.id} • {selected.cars} vehicles • {selected.city}</div></div>
              </div>
              <button onClick={()=>setShowVehicles(false)} style={{width:"40px", height:"40px", borderRadius:"12px", background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.15)", color:"#fff"}}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={{padding:"20px", display:"grid", gap:"14px", maxHeight:"75vh", overflowY:"auto", background:"#F8FAFC"}}>
              {selected.vehicles.length===0 && <div style={{padding:20, textAlign:"center", color:"#94A3B8"}}>No vehicles for this owner yet. Add a car from Owner dashboard.</div>}
              {selected.vehicles.map((v,i)=>{
                var statusBg = v.status==="Healthy"?"#DCFCE7":v.status==="Due"?"#FEF3C7":"#FEF2F2";
                var statusColor = v.status==="Healthy"?"#166534":v.status==="Due"?"#92400E":"#991B1B";
                return (
                  <div key={i} style={{background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:"18px", padding:"16px", display:"flex", gap:"16px", alignItems:"center"}}>
                    <img src={v.image} alt="" style={{width:"88px", height:"88px", borderRadius:"16px", objectFit:"cover", border:"1.5px solid #E2E8F0"}} />
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap"}}>
                        <span style={{fontWeight:900, fontSize:"16px", color:"#0A192F"}}>{v.year} {v.make} {v.model}</span>
                        <span style={{background:"#0A192F", color:"#fff", fontSize:"11px", fontWeight:800, padding:"3px 8px", borderRadius:"20px"}}>{v.plate}</span>
                        <span style={{background:statusBg, color:statusColor, fontSize:"11px", fontWeight:800, padding:"4px 10px", borderRadius:"20px", border:"1px solid #E2E8F0"}}>{v.status}</span>
                      </div>
                      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 16px", marginTop:"8px"}}>
                        <div style={{fontSize:"13px"}}><span style={{color:"#94A3B8", fontWeight:700}}>VIN:</span> <span style={{fontWeight:700, color:"#0A192F", fontSize:"12px"}}>{v.vin}</span></div>
                        <div style={{fontSize:"13px"}}><span style={{color:"#94A3B8", fontWeight:700}}>Color:</span> <span style={{fontWeight:700}}>{v.color}</span></div>
                        <div style={{fontSize:"13px"}}><span style={{color:"#94A3B8", fontWeight:700}}>Mileage:</span> <span style={{fontWeight:700}}>{v.mileage}</span></div>
                        <div style={{fontSize:"13px"}}><span style={{color:"#94A3B8", fontWeight:700}}>Fuel:</span> <span style={{fontWeight:700}}>{v.fuel}</span></div>
                        <div style={{fontSize:"13px"}}><span style={{color:"#94A3B8", fontWeight:700}}>Last Service:</span> <span style={{fontWeight:700}}>{v.lastService}</span></div>
                      </div>
                    </div>
                    <div style={{display:"grid", gap:"8px"}}>
                      <button style={{height:"36px", padding:"0 14px", borderRadius:"10px", border:"1.5px solid #E2E8F0", background:"#fff", fontWeight:800, fontSize:"12px"}}><i className="bi bi-clock-history me-1"></i>History</button>
                      <button style={{height:"36px", padding:"0 14px", borderRadius:"10px", background:"#EFF6FF", border:"1.5px solid #DBEAFE", color:"#1E40AF", fontWeight:800, fontSize:"12px"}}>Invoice</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{padding:"14px 20px", background:"#fff", borderTop:"1.5px solid #E2E8F0", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
              <div style={{fontSize:"13px", fontWeight:700, color:"#64748B"}}>{selected.cars} vehicles • Total spent {selected.spent} • Inglewood CA</div>
              <button onClick={()=>setShowVehicles(false)} style={{height:"40px", padding:"0 18px", borderRadius:"10px", border:"1.5px solid #E2E8F0", background:"#fff", fontWeight:800, fontSize:"14px"}}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}