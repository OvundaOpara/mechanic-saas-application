// src/pages/OwnerCarsPage.jsx - WIRED TO BACKEND - MOBILE RESPONSIVE - CARDS ON MOBILE
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Swal from "sweetalert2";

const API = "http://127.0.0.1:5000/api";
const DEFAULT_CAR_IMG = "https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=800&q=80";
function getOwnerIdFromStorage(){
  try{ const u = JSON.parse(localStorage.getItem("autoville_user")||"{}"); return u?.id || u?.owner_id || u?.ownerId || u?.user_id || null; }catch{ return null; }
}
function mapCar(r){
  let health = {engine:90, brakes:90, oil:90, battery:90, tires:90};
  try{ if(r.health){ health = typeof r.health === "string" ? JSON.parse(r.health) : r.health; } }catch{}
  return {
    id: r.id,
    make: r.make || r.brand || "",
    model: r.model || "",
    year: Number(r.year) || "",
    plate: r.plate || r.license_plate || r.plate_number || "",
    vin: r.vin || "",
    mileage: Number(r.mileage) || 0,
    color: r.color || "",
    fuel: r.fuel || r.fuel_type || "Gasoline",
    next: r.next_service || r.next || "General Check",
    due: r.due || "in 30 days",
    dueDate: r.due_date || r.dueDate || "",
    status: r.status || "healthy",
    image: r.image || r.image_url || r.photo || DEFAULT_CAR_IMG,
    last: r.last_service || r.last || "No service yet",
    health,
    upcoming: r.upcoming || [{service: r.next_service || "General Check", dueIn: r.due || "30 days", date: r.due_date || "Dec 30, 2025", mileage: "At 1k", priority: "medium", cost: "$95"}],
  };
}

export default function OwnerCarsPage({ C, isDark, ownerId, owner }) {
  const effectiveOwnerId = ownerId || getOwnerIdFromStorage();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("year");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const perPage = 5;
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailCar, setDetailCar] = useState(null);
  const [editing, setEditing] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef(null);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ make:"", model:"", year:"", plate:"", mileage:"", color:"", image:"" });
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCars = useCallback(async ()=>{
    if(!effectiveOwnerId) { setLoading(false); return; }
    setLoading(true); setError("");
    try{
      const res = await fetch(`${API}/owners/${effectiveOwnerId}/vehicles`);
      const data = await res.json().catch(()=>[]);
      if(!res.ok) throw new Error(data.error || `Failed to load cars (${res.status})`);
      const arr = Array.isArray(data) ? data : (data.vehicles || data.cars || []);
      setCars(arr.map(mapCar));
    }catch(e){ setError(e.message); setCars([]); }
    setLoading(false);
  }, [effectiveOwnerId]);

  useEffect(()=>{ fetchCars(); }, [fetchCars]);

  const totalCars = cars.length;
  const healthyCount = cars.filter(c=>c.status==="healthy").length;
  const dueCount = cars.filter(c=>c.status!=="healthy").length;

  const handleSort = (col) => { if (sortBy===col) setSortDir(d=>d==="asc"?"desc":"asc"); else { setSortBy(col); setSortDir("asc"); } };
  const filtered = useMemo(()=>{ let f=cars.filter(c=> `${c.make} ${c.model} ${c.plate} ${c.vin}`.toLowerCase().includes(search.toLowerCase())); f.sort((a,b)=>{ let av=a[sortBy], bv=b[sortBy]; if(typeof av==="string"){ av=av.toLowerCase(); bv=bv.toLowerCase(); } if(av<bv) return sortDir==="asc"?-1:1; if(av>bv) return sortDir==="asc"?1:-1; return 0; }); return f; },[cars,search,sortBy,sortDir]);
  const totalPages = Math.ceil(filtered.length/perPage);
  const paginated = filtered.slice((page-1)*perPage, page*perPage);

  const handleImage = (file) => {
    if(!file) return;
    if(!file.type.startsWith("image/")) return Swal.fire("Invalid", "Only images allowed", "warning");
    if(file.size > 5*1024*1024) return Swal.fire("Too large", "Max 5MB", "warning");
    const reader = new FileReader();
    reader.onloadend = () => { setPreview(reader.result); setForm(f=>({...f, image:reader.result})); };
    reader.readAsDataURL(file);
  };
  const onDrop = (e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; handleImage(file); };
  const onFileChange = (e) => { const file = e.target.files?.[0]; handleImage(file); };
  const openAdd = () => { setEditing(null); setForm({make:"",model:"",year:"",plate:"",mileage:"",color:"",image:""}); setPreview(""); setShowModal(true); };
  const openEdit = (c) => { setEditing(c); setForm({make:c.make, model:c.model, year:c.year, plate:c.plate, mileage:c.mileage, color:c.color, image:c.image}); setPreview(c.image); setShowModal(true); };
  const openDetail = (car) => { setDetailCar(car); setShowDetail(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!effectiveOwnerId) return Swal.fire("Not logged in", "Please log in again", "warning");
    const img = form.image || preview || DEFAULT_CAR_IMG;
    const payload = { ...form, year: parseInt(form.year) || 0, mileage: parseInt(form.mileage) || 0, image: img, fuel: "Gasoline" };
    setSaving(true);
    try{
      const url = editing ? `${API}/owners/${effectiveOwnerId}/vehicles/${editing.id}` : `${API}/owners/${effectiveOwnerId}/vehicles`;
      const res = await fetch(url, { method: editing ? "PUT" : "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
      await fetchCars();
      setShowModal(false); setEditing(null); setForm({make:"",model:"",year:"",plate:"",mileage:"",color:"",image:""}); setPreview("");
      Swal.fire("Saved", editing ? "Car updated" : "Car added to garage", "success");
    }catch(err){ Swal.fire("Could not save", err.message, "error"); }
    setSaving(false);
  };

  const handleDelete = async (car) => {
    const res = await Swal.fire({ title: `Delete ${car.make} ${car.model}?`, text: "This cannot be undone.", icon: "warning", showCancelButton: true, confirmButtonColor: "#DC2626", confirmButtonText: "Delete" });
    if(!res.isConfirmed) return;
    try{
      const r = await fetch(`${API}/owners/${effectiveOwnerId}/vehicles/${car.id}`, { method: "DELETE" });
      const d = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(d.error || "Delete failed");
      await fetchCars();
      Swal.fire("Deleted", "Car removed", "success");
    }catch(err){ Swal.fire("Could not delete", err.message, "error"); }
  };

  const healthColor = (v) => v>75?"#22C55E": v>40?"#F59E0B":"#EF4444";
  const overallHealth = (h) => Math.round((h.engine+h.brakes+h.oil+h.battery+h.tires)/5);

  return (
    <>
    <style>{`
      .oc-root{ width:100%; max-width:100%; box-sizing:border-box; overflow-x:clip; }
      .oc-stats{ display:grid; grid-template-columns:1fr; gap:10px; width:100%; max-width:100%; box-sizing:border-box; }
      .stat-mini{ background:${C.card}; border:1.5px solid ${C.cardBorder}; border-radius:16px; padding:14px 16px; display:flex; align-items:center; justify-content:space-between; min-width:0; box-sizing:border-box; }
      .oc-wrap{ background:${C.card}; border:1.5px solid ${C.cardBorder}; border-radius:20px; overflow:hidden; width:100%; max-width:100%; box-sizing:border-box; }
      .oc-search{ background:${C.soft}; border:1.5px solid ${C.cardBorder}; border-radius:12px; height:44px; padding:0 14px 0 40px; color:${C.text}; width:100%; max-width:100%; font-weight:600; box-sizing:border-box; }
      .oc-th{ font-size:11px; font-weight:800; letter-spacing:0.06em; color:${C.muted}; padding:12px; cursor:pointer; white-space:nowrap; }
      .oc-td{ padding:12px; font-size:13px; border-top:1px solid ${C.cardBorder}; vertical-align:middle; }
      .oc-badge{ font-size:10px; font-weight:800; padding:4px 9px; border-radius:20px; white-space:nowrap; }
      .oc-page-btn{ width:36px; height:36px; border-radius:10px; border:1.5px solid ${C.cardBorder}; background:${C.card}; color:${C.text}; font-weight:800; flex-shrink:0; }
      .oc-page-btn.active{ background:#0A192F; color:#fff; border-color:#0A192F; }
      .mobile-only{ display:grid; gap:10px; width:100%; max-width:100%; padding:10px; box-sizing:border-box; }
      .desktop-only{ display:none; }
      .oc-card{ background:${C.card}; border:1.5px solid ${C.cardBorder}; border-radius:14px; padding:12px; width:100%; max-width:100%; box-sizing:border-box; min-width:0; }
      .oc-action{ height:40px; border-radius:9px; font-weight:800; font-size:12px; display:flex; align-items:center; justify-content:center; gap:6px; border:1.5px solid ${C.cardBorder}; cursor:pointer; width:100%; box-sizing:border-box; min-width:0; white-space:nowrap; }
      .upload-zone{ border:2px dashed ${isDragging? "#0A192F" : C.cardBorder}; background:${isDragging? (isDark?"#1A2B4A":"#F1F5F9") : C.soft}; border-radius:18px; height:180px; display:grid; place-items:center; cursor:pointer; transition:.2s; position:relative; overflow:hidden; width:100%; max-width:100%; box-sizing:border-box; }
      .upload-zone.has-img{ border-style:solid; height:220px; padding:0; }
      .av-input{ background:${C.soft}; border:1.5px solid ${C.cardBorder}; border-radius:12px; height:46px; padding:0 14px; color:${C.text}; font-weight:600; width:100%; max-width:100%; box-sizing:border-box; }
      .av-label{ font-size:11px; font-weight:800; letter-spacing:0.06em; color:${C.muted}; margin-bottom:6px; display:block; }
      .pro-modal-overlay{ position:fixed; inset:0; background:rgba(5,12,28,0.68); backdrop-filter:blur(10px); z-index:110; display:grid; place-items:center; padding:12px; box-sizing:border-box; }
      .pro-modal{ width:100%; max-width:560px; background:${C.card}; border:1.5px solid ${C.cardBorder}; border-radius:20px; overflow:hidden; max-height:94vh; overflow-y:auto; box-shadow:0 24px 60px rgba(0,0,0,0.25); box-sizing:border-box; }
      .detail-overlay{ position:fixed; inset:0; background:rgba(5,12,28,0.72); backdrop-filter:blur(8px); z-index:110; display:grid; place-items:center; padding:12px; box-sizing:border-box; }
      .detail-modal{ width:100%; max-width:760px; background:${C.card}; border:1.5px solid ${C.cardBorder}; border-radius:20px; overflow:hidden; max-height:92vh; overflow-y:auto; box-sizing:border-box; }
      .health-bar{ height:8px; border-radius:20px; background:${isDark?"#1E2E4A":"#E2E8F0"}; overflow:hidden; }
      @media(min-width:576px){ .oc-stats{ grid-template-columns:1fr 1fr; } }
      @media(min-width:769px){
        .mobile-only{ display:none !important; }
        .desktop-only{ display:block !important; width:100%; overflow-x:auto; }
        .oc-stats{ grid-template-columns:1fr 1fr 1fr; }
      }
    `}</style>

    <div className="oc-root">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'10px', marginBottom:'14px', width:'100%', maxWidth:'100%', boxSizing:'border-box'}}>
        <div style={{minWidth:0, flex:1}}><h2 style={{fontWeight:900, fontSize:'22px', letterSpacing:'-0.02em', color:C.text, margin:0, wordBreak:'break-word'}}>My Garage</h2><p style={{color:C.muted, fontSize:'12.5px', margin:'4px 0 0', wordBreak:'break-word'}}>VIN verified • Tap calendar to view health</p></div>
        <button className="btn btn-dark" style={{borderRadius:'12px', fontWeight:800, height:'42px', whiteSpace:'nowrap', flexShrink:0}} onClick={openAdd}><i className="bi bi-plus-lg me-1"></i>Add Car</button>
      </div>

      {error && <div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", color:"#991B1B", padding:"12px 14px", borderRadius:"12px", marginBottom:"12px", fontSize:"13px", fontWeight:700}}>{error} <button onClick={fetchCars} style={{marginLeft:"8px", background:"#fff", border:"1px solid #FECACA", borderRadius:"8px", padding:"4px 10px", fontWeight:800}}>Retry</button></div>}
      {loading ? <div style={{padding:"40px", textAlign:"center", color:C.muted}}>Loading your cars from backend...</div> : (
      <>
      <div className="oc-stats mb-3">
        <div className="stat-mini"><div style={{display:'flex', gap:'10px', alignItems:'center', minWidth:0}}><div style={{width:'40px', height:'40px', borderRadius:'10px', background:'#0A192F', color:'#fff', display:'grid', placeItems:'center', flexShrink:0}}><i className="bi bi-car-front-fill"></i></div><div style={{minWidth:0}}><div style={{fontSize:'10px', fontWeight:800, color:C.muted}}>TOTAL CARS</div><div style={{fontWeight:900, fontSize:'20px', color:C.text, lineHeight:1.1}}>{totalCars}</div></div></div><span style={{fontSize:'11px', fontWeight:700, background:C.soft, border:`1px solid ${C.cardBorder}`, padding:'4px 8px', borderRadius:'20px', color:C.muted, flexShrink:0, whiteSpace:'nowrap'}}>Garage</span></div>
        <div className="stat-mini"><div style={{display:'flex', gap:'10px', alignItems:'center', minWidth:0}}><div style={{width:'40px', height:'40px', borderRadius:'10px', background:'#DCFCE7', color:'#166534', display:'grid', placeItems:'center', flexShrink:0}}><i className="bi bi-check-circle-fill"></i></div><div style={{minWidth:0}}><div style={{fontSize:'10px', fontWeight:800, color:'#16A34A'}}>HEALTHY</div><div style={{fontWeight:900, fontSize:'20px', color:C.text, lineHeight:1.1}}>{healthyCount}</div></div></div><span style={{fontSize:'11px', fontWeight:800, background:'#DCFCE7', color:'#166534', padding:'4px 10px', borderRadius:'20px', flexShrink:0, whiteSpace:'nowrap'}}>{totalCars?Math.round((healthyCount/totalCars)*100):0}%</span></div>
        <div className="stat-mini"><div style={{display:'flex', gap:'10px', alignItems:'center', minWidth:0}}><div style={{width:'40px', height:'40px', borderRadius:'10px', background: dueCount?'#FEF3C7':'#F1F5F9', color: dueCount?'#92400E':'#94A3B8', display:'grid', placeItems:'center', flexShrink:0}}><i className="bi bi-exclamation-triangle-fill"></i></div><div style={{minWidth:0}}><div style={{fontSize:'10px', fontWeight:800, color: dueCount?'#D97706':C.muted}}>DUE</div><div style={{fontWeight:900, fontSize:'20px', color:C.text, lineHeight:1.1}}>{dueCount}</div></div></div><span style={{fontSize:'11px', fontWeight:800, background: dueCount?'#FEF3C7':'#F1F5F9', color: dueCount?'#92400E':'#64748B', padding:'4px 10px', borderRadius:'20px', flexShrink:0, whiteSpace:'nowrap'}}>{dueCount===0?"All clear":dueCount+" need"}</span></div>
      </div>

      <div className="oc-wrap">
        <div style={{padding:'12px', display:'flex', gap:'10px', justifyContent:'space-between', flexWrap:'wrap', background:C.soft, borderBottom:`1px solid ${C.cardBorder}`, width:'100%', maxWidth:'100%', boxSizing:'border-box'}}>
          <div style={{position:'relative', flex:'1 1 100%', minWidth:0, maxWidth:'360px'}}><i className="bi bi-search" style={{position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', color:C.muted}}></i><input className="oc-search" placeholder="Search make, model, plate, VIN..." value={search} onChange={e=>{setSearch(e.target.value); setPage(1)}} /></div>
          <div style={{fontSize:'12px', color:C.muted, fontWeight:700, whiteSpace:'nowrap', alignSelf:'center'}}>{filtered.length} cars • P{page}/{totalPages||1}</div>
        </div>

        {filtered.length===0 ? (
          <div style={{padding:"40px", textAlign:"center", color:C.muted}}>
            <div style={{fontSize:"28px"}}><i className="bi bi-car-front"></i></div>
            <div style={{fontWeight:800, color:C.text, marginTop:"8px"}}>No cars yet</div>
            <div style={{fontSize:"13px"}}>Add your first car to start booking services.</div>
            <button onClick={openAdd} style={{marginTop:"12px", background:"#0A192F", color:"#fff", border:"none", borderRadius:"10px", padding:"10px 16px", fontWeight:800}}>Add Car</button>
          </div>
        ) : (
        <>
        <div className="desktop-only">
          <div style={{overflowX:'auto', width:'100%'}}>
            <table style={{width:'100%', borderCollapse:'collapse', minWidth:'720px'}}>
              <thead><tr style={{background:isDark?"#0F1D33":"#F8FAFC"}}><th className="oc-th" onClick={()=>handleSort("make")}>CAR</th><th className="oc-th" onClick={()=>handleSort("year")}>YEAR</th><th className="oc-th">PLATE</th><th className="oc-th" onClick={()=>handleSort("mileage")}>MILEAGE</th><th className="oc-th">NEXT</th><th className="oc-th">STATUS</th><th className="oc-th" style={{textAlign:'right', cursor:'default'}}>ACTIONS</th></tr></thead>
              <tbody>{paginated.map(car=>(<tr key={car.id} style={{background:C.card}}><td className="oc-td"><div style={{display:'flex', gap:'10px', alignItems:'center'}}><img src={car.image} alt="" style={{width:'44px', height:'44px', borderRadius:'10px', objectFit:'cover', border:`1px solid ${C.cardBorder}`}} /><div><div style={{fontWeight:900, color:C.text, whiteSpace:'nowrap'}}>{car.make} {car.model}</div><div style={{fontSize:'11px', color:C.muted}}>{car.color} • {car.fuel}</div></div></div></td><td className="oc-td" style={{fontWeight:800, color:C.text}}>{car.year}</td><td className="oc-td"><div style={{fontWeight:700, fontSize:'12px', color:C.text}}>{car.plate}</div><div style={{fontSize:'10px', color:C.muted}}>...{(car.vin||"").slice(-5)}</div></td><td className="oc-td" style={{fontWeight:700, color:C.text}}>{car.mileage.toLocaleString()} mi</td><td className="oc-td"><div style={{fontWeight:700, fontSize:'12px', color:C.text}}>{car.next}</div><div style={{fontSize:'11px', color:car.status==="critical"?"#DC2626":car.status==="attention"?"#D97706":"#16A34A"}}>{car.due}</div></td><td className="oc-td"><span className="oc-badge" style={{background:car.status==="healthy"?"#DCFCE7":car.status==="attention"?"#FEF3C7":"#FEE2E2", color:car.status==="healthy"?"#166534":car.status==="attention"?"#92400E":"#991B1B"}}>{car.status==="healthy"?"● HEALTHY":car.status==="attention"?"▲ DUE":"■ DUE"}</span></td><td className="oc-td" style={{textAlign:'right'}}><div style={{display:'flex', gap:'6px', justifyContent:'end'}}><button onClick={()=>openDetail(car)} className="btn" style={{borderRadius:'10px', width:'36px', height:'32px', background:'#0A192F', color:'#fff'}}><i className="bi bi-calendar3"></i></button><button className="btn" style={{borderRadius:'10px', width:'36px', height:'32px', background:C.soft, border:`1px solid ${C.cardBorder}`, color:C.text}} onClick={()=>openEdit(car)}><i className="bi bi-pencil"></i></button><button className="btn" style={{borderRadius:'10px', width:'36px', height:'32px', background:'#FEF2F2', border:'1px solid #FECACA', color:'#DC2626'}} onClick={()=>handleDelete(car)}><i className="bi bi-trash"></i></button></div></td></tr>))}</tbody>
            </table>
          </div>
        </div>

        <div className="mobile-only">
          {paginated.map(car=>(
            <div key={car.id} className="oc-card">
              <div style={{display:'flex', gap:'10px', minWidth:0}}>
                <img src={car.image} alt="" style={{width:'56px', height:'56px', borderRadius:'12px', objectFit:'cover', flexShrink:0, border:`1px solid ${C.cardBorder}`}} />
                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:'flex', justifyContent:'space-between', gap:'8px', minWidth:0}}>
                    <div style={{fontWeight:900, fontSize:'14px', color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0, flex:1}}>{car.make} {car.model} • {car.year}</div>
                    <span className="oc-badge" style={{background:car.status==="healthy"?"#DCFCE7":car.status==="attention"?"#FEF3C7":"#FEE2E2", color:car.status==="healthy"?"#166534":car.status==="attention"?"#92400E":"#991B1B", flexShrink:0}}>{car.status==="healthy"?"HEALTHY":car.status==="attention"?"DUE SOON":"DUE"}</span>
                  </div>
                  <div style={{fontSize:'11px', color:C.muted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0}}>{car.plate} • ...{(car.vin||"").slice(-5)} • {car.color}</div>
                  <div style={{fontSize:'12px', color:C.text, marginTop:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}><span style={{fontWeight:700}}>{car.mileage.toLocaleString()} mi</span> • {car.next} • <span style={{color:car.status==="critical"?"#DC2626":"#16A34A", fontWeight:700}}>{car.due}</span></div>
                  <div style={{fontSize:'11px', color:C.muted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{car.last}</div>
                </div>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginTop:'10px'}}>
                <button className="oc-action" style={{background:'#0A192F', color:'#fff', borderColor:'#0A192F'}} onClick={()=>openDetail(car)}><i className="bi bi-calendar3"></i> Health</button>
                <button className="oc-action" style={{background:C.soft, color:C.text}} onClick={()=>openEdit(car)}><i className="bi bi-pencil"></i> Edit</button>
                <button className="oc-action" style={{background:'#FEF2F2', color:'#DC2626', borderColor:'#FECACA'}} onClick={()=>handleDelete(car)}><i className="bi bi-trash"></i> Del</button>
              </div>
            </div>
          ))}
        </div>
        </>
        )}

        <div style={{padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:`1px solid ${C.cardBorder}`, background:C.soft, flexWrap:'wrap', gap:'8px', width:'100%', maxWidth:'100%', boxSizing:'border-box'}}>
          <div style={{fontSize:'12px', color:C.muted, fontWeight:700, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{filtered.length ? (page-1)*perPage+1 : 0}-{Math.min(page*perPage, filtered.length)} of {filtered.length}</div>
          <div style={{display:'flex', gap:'6px', flexShrink:0}}><button className="oc-page-btn" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}><i className="bi bi-chevron-left"></i></button>{Array.from({length:totalPages},(_,i)=>i+1).slice(0,4).map(p=><button key={p} className={`oc-page-btn ${page===p?"active":""}`} onClick={()=>setPage(p)}>{p}</button>)}<button className="oc-page-btn" disabled={page===totalPages||totalPages===0} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}><i className="bi bi-chevron-right"></i></button></div>
        </div>
      </div>
      </>
      )}
    </div>

    {showModal && (
      <div className="pro-modal-overlay" onClick={()=>setShowModal(false)}>
        <div className="pro-modal" onClick={e=>e.stopPropagation()}>
          <div style={{padding:'20px 22px 0', display:'flex', gap:'14px', alignItems:'start', minWidth:0}}>
            <div style={{width:'48px', height:'48px', borderRadius:'14px', background:'#0A192F', color:'#fff', display:'grid', placeItems:'center', fontSize:'20px', flexShrink:0}}><i className={`bi ${editing?"bi-pencil-square":"bi-plus-circle-fill"}`}></i></div>
            <div style={{flex:1, minWidth:0}}><h4 style={{fontWeight:900, margin:0, color:C.text, fontSize:'18px', wordBreak:'break-word'}}>{editing?"Edit Vehicle":"Add New Vehicle"}</h4><p style={{fontSize:'12px', color:C.muted, margin:'2px 0 0', wordBreak:'break-word'}}>{editing?"Update details":"Upload photo, VIN auto-verified"}</p></div>
            <button onClick={()=>setShowModal(false)} style={{width:'36px', height:'36px', borderRadius:'10px', border:`1.5px solid ${C.cardBorder}`, background:C.soft, display:'grid', placeItems:'center', flexShrink:0}}><i className="bi bi-x-lg"></i></button>
          </div>
          <div style={{padding:'18px 22px 22px', width:'100%', maxWidth:'100%', boxSizing:'border-box'}}>
            <form onSubmit={handleSubmit} style={{width:'100%', maxWidth:'100%'}}>
              <div style={{marginBottom:'16px'}}><label className="av-label"><i className="bi bi-image me-1"></i>VEHICLE PHOTO • Max 5MB</label><input ref={fileRef} type="file" accept="image/*" hidden onChange={onFileChange} /><div className={`upload-zone ${preview?"has-img":""}`} onDragOver={e=>{e.preventDefault(); setIsDragging(true);}} onDragLeave={()=>setIsDragging(false)} onDrop={onDrop} onClick={()=>!preview && fileRef.current.click()}>{preview ? (<><img src={preview} alt="preview" style={{width:'100%', height:'100%', objectFit:'cover'}} /><div style={{position:'absolute', inset:0, background:'linear-gradient(to top, rgba(10,25,47,0.6), transparent)'}}></div><button type="button" onClick={e=>{e.stopPropagation(); setPreview(""); setForm(f=>({...f, image:""}));}} style={{position:'absolute', top:'10px', right:'10px', width:'32px', height:'32px', borderRadius:'50%', background:'rgba(0,0,0,0.6)', color:'#fff', border:'1px solid rgba(255,255,255,0.3)', display:'grid', placeItems:'center'}}><i className="bi bi-trash"></i></button><div style={{position:'absolute', bottom:'10px', left:'12px', display:'flex', gap:'6px'}}><span style={{background:'#fff', color:'#0A192F', fontSize:'10px', fontWeight:800, padding:'4px 8px', borderRadius:'20px'}}><i className="bi bi-check-circle-fill me-1" style={{color:'#22C55E'}}></i>Ready</span><button type="button" onClick={e=>{e.stopPropagation(); fileRef.current.click();}} style={{background:'rgba(255,255,255,0.15)', backdropFilter:'blur(6px)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', fontSize:'10px', fontWeight:700, padding:'4px 10px', borderRadius:'20px'}}>Change</button></div></>) : (<div style={{textAlign:'center', padding:'10px'}}><div style={{width:'48px', height:'48px', borderRadius:'12px', background:C.card, border:`1.5px solid ${C.cardBorder}`, display:'grid', placeItems:'center', margin:'0 auto', fontSize:'22px', color:C.muted}}><i className="bi bi-cloud-arrow-up-fill"></i></div><div style={{fontWeight:800, fontSize:'13px', color:C.text, marginTop:'10px'}}>{isDragging?"Drop image here":"Drag & drop photo"}</div><div style={{fontSize:'11px', color:C.muted, marginTop:'2px'}}>or <span style={{color:'#0A192F', fontWeight:800, textDecoration:'underline'}}>browse</span></div></div>)}</div></div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', width:'100%', maxWidth:'100%'}}>
                <div style={{minWidth:0}}><label className="av-label">MAKE *</label><input required className="av-input" placeholder="Toyota" value={form.make} onChange={e=>setForm({...form, make:e.target.value})} /></div>
                <div style={{minWidth:0}}><label className="av-label">MODEL *</label><input required className="av-input" placeholder="Camry" value={form.model} onChange={e=>setForm({...form, model:e.target.value})} /></div>
                <div style={{minWidth:0}}><label className="av-label">YEAR *</label><input required type="number" min="1980" max="2026" className="av-input" placeholder="2019" value={form.year} onChange={e=>setForm({...form, year:e.target.value})} /></div>
                <div style={{minWidth:0}}><label className="av-label">PLATE *</label><input required className="av-input" placeholder="7XYZ123" value={form.plate} onChange={e=>setForm({...form, plate:e.target.value.toUpperCase()})} style={{textTransform:'uppercase'}} /></div>
                <div style={{minWidth:0}}><label className="av-label">MILEAGE</label><input type="number" className="av-input" placeholder="45200" value={form.mileage} onChange={e=>setForm({...form, mileage:e.target.value})} /></div>
                <div style={{minWidth:0}}><label className="av-label">COLOR</label><input className="av-input" placeholder="Silver" value={form.color} onChange={e=>setForm({...form, color:e.target.value})} /></div>
              </div>
              <div style={{display:'flex', gap:'10px', marginTop:'20px', width:'100%', maxWidth:'100%'}}><button type="button" className="btn" style={{flex:1, minWidth:0, height:'48px', borderRadius:'12px', fontWeight:800, background:C.soft, border:`1.5px solid ${C.cardBorder}`, color:C.text}} onClick={()=>setShowModal(false)}>Cancel</button><button type="submit" disabled={saving} className="btn btn-dark" style={{flex:2, minWidth:0, height:'48px', borderRadius:'12px', fontWeight:900}}>{saving ? "Saving..." : editing?"Update":"Add to Garage"}</button></div>
            </form>
          </div>
        </div>
      </div>
    )}

    {showDetail && detailCar && (
      <div className="detail-overlay" onClick={()=>setShowDetail(false)}>
        <div className="detail-modal" onClick={e=>e.stopPropagation()}>
          <div style={{height:'200px', backgroundImage:`url(${detailCar.image})`, backgroundSize:'cover', backgroundPosition:'center', position:'relative'}}>
            <button onClick={()=>setShowDetail(false)} style={{position:'absolute', top:'16px', right:'16px', zIndex:3, width:'40px', height:'40px', borderRadius:'50%', background:'rgba(255,255,255,0.9)', border:'none', display:'grid', placeItems:'center'}}><i className="bi bi-x-lg"></i></button>
            <div style={{position:'absolute', inset:0, background:'linear-gradient(to top, #0A192F 15%, rgba(10,25,47,0.4) 60%, rgba(10,25,47,0.1))'}}></div>
            <div style={{position:'absolute', bottom:'14px', left:'16px', right:'16px', zIndex:2, display:'flex', justifyContent:'space-between', alignItems:'end', gap:'12px', minWidth:0}}>
              <div style={{minWidth:0, flex:1}}><div style={{display:'flex', gap:'8px', marginBottom:'6px'}}><span style={{background: detailCar.status==="healthy"?"#22C55E":detailCar.status==="attention"?"#F59E0B":"#EF4444", color:'#fff', fontSize:'10px', fontWeight:900, padding:'5px 10px', borderRadius:'20px', whiteSpace:'nowrap'}}>{detailCar.status==="healthy"?"● HEALTHY":detailCar.status==="attention"?"▲ DUE":"■ DUE"} • {overallHealth(detailCar.health)}%</span></div><h2 style={{color:'#fff', fontWeight:900, fontSize:'20px', margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{detailCar.year} {detailCar.make} {detailCar.model}</h2><div style={{color:'rgba(255,255,255,0.8)', fontSize:'12px', marginTop:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{detailCar.plate} • {detailCar.color}</div></div>
              <div style={{background:'#fff', borderRadius:'14px', padding:'8px 12px', textAlign:'center', flexShrink:0}}><div style={{fontSize:'10px', fontWeight:800, color:'#64748B'}}>HEALTH</div><div style={{fontSize:'22px', fontWeight:900, color:'#0A192F'}}>{overallHealth(detailCar.health)}%</div></div>
            </div>
          </div>
          <div style={{padding:'16px', display:'grid', gap:'16px', width:'100%', maxWidth:'100%', boxSizing:'border-box'}}>
            <div><div style={{display:'flex', justifyContent:'space-between', marginBottom:'12px', flexWrap:'wrap', gap:'8px'}}><h5 style={{fontWeight:900, color:C.text, margin:0, fontSize:'15px'}}><i className="bi bi-heart-pulse-fill me-2" style={{color:'#EF4444'}}></i>Vehicle Health</h5><span style={{fontSize:'11px', color:C.muted}}>Updated 2h ago</span></div><div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:'10px'}}>{Object.entries(detailCar.health).map(([k,v])=>(<div key={k} style={{background:C.soft, border:`1.5px solid ${C.cardBorder}`, borderRadius:'14px', padding:'12px', minWidth:0}}><div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px'}}><span style={{fontSize:'11px', fontWeight:800, textTransform:'uppercase', color:C.muted}}>{k}</span><span style={{fontSize:'11px', fontWeight:900, color:healthColor(v)}}>{v}%</span></div><div className="health-bar"><div style={{width:`${v}%`, height:'100%', background:healthColor(v)}}></div></div></div>))}</div></div>
            <div style={{background:isDark?"#0F1D33":"#F8FAFC", border:`1.5px solid ${C.cardBorder}`, borderRadius:'16px', padding:'14px', width:'100%', maxWidth:'100%', boxSizing:'border-box'}}><h6 style={{fontWeight:900, color:C.text, margin:'0 0 12px', fontSize:'14px'}}><i className="bi bi-calendar-check me-2" style={{color:'#FF5722'}}></i>Due Maintenance</h6><div style={{display:'grid', gap:'10px'}}>{detailCar.upcoming.map((u,i)=>(<div key={i} style={{background:C.card, border:`1.5px solid ${u.priority==="critical"?"#FECACA":C.cardBorder}`, borderRadius:'12px', padding:'12px', display:'flex', justifyContent:'space-between', minWidth:0, gap:'8px'}}><div style={{display:'flex', gap:'10px', alignItems:'center', minWidth:0}}><div style={{width:'36px', height:'36px', borderRadius:'10px', display:'grid', placeItems:'center', background:u.priority==="critical"?"#FEF2F2":"#FFFBEB", flexShrink:0}}><i className={`bi ${u.priority==="critical"?"bi-exclamation-triangle-fill":"bi-wrench"}`}></i></div><div style={{minWidth:0}}><div style={{fontWeight:800, fontSize:'13px', color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{u.service}</div><div style={{fontSize:'11px', color:C.muted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{u.date} • {u.dueIn}</div></div></div><div style={{textAlign:'right', flexShrink:0}}><div style={{fontWeight:900, color:C.text, fontSize:'13px'}}>{u.cost}</div><div style={{fontSize:'10px', fontWeight:800, textTransform:'uppercase', color:u.priority==="critical"?"#DC2626":"#D97706"}}>{u.priority}</div></div></div>))}</div></div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}