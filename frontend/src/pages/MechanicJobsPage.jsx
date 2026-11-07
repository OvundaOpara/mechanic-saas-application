import { useState, useMemo, useEffect, useCallback } from "react";

const API = "http://127.0.0.1:5000/api";

function getStoredUser(){ try{ return JSON.parse(localStorage.getItem("autoville_user")||"{}"); }catch{ return {}; } }

// Backend: diagnosing / diagnosis / in_progress / awaiting_parts / quality_check / completed / on_hold / pending
// UI: New / In Progress / Awaiting Parts / QC / Completed / On Hold
function mapStatusToUI(raw){
  const s = String(raw||"").toLowerCase().replace(/-/g,"_").trim();
  if(["pending","new","requested","diagnosing","diagnosis","diagnose"].includes(s)) return "New";
  if(["in_progress","inprogress","ongoing"].includes(s)) return "In Progress";
  if(["awaiting_parts","awaiting","waiting_parts"].includes(s)) return "Awaiting Parts";
  if(["quality_check","qc","quality","check"].includes(s)) return "QC";
  if(["completed","done","finished"].includes(s)) return "Completed";
  if(["on_hold","hold","paused"].includes(s)) return "On Hold";
  if(["cancelled","canceled"].includes(s)) return "Cancelled";
  return "New";
}
function mapStatusToBackend(ui){
  const s = String(ui||"").toLowerCase();
  if(s==="new") return "diagnosing";
  if(s==="in progress") return "in_progress";
  if(s==="awaiting parts") return "awaiting_parts";
  if(s==="qc" || s==="quality check") return "quality_check";
  if(s==="completed") return "completed";
  if(s==="on hold") return "on_hold";
  if(s==="cancelled") return "cancelled";
  return "diagnosing";
}
function progressForStatus(uiStatus, currentProgress){
  if(uiStatus==="Completed") return 100;
  if(uiStatus==="QC") return Math.max(currentProgress, 90);
  if(uiStatus==="In Progress") return Math.max(currentProgress, 50);
  if(uiStatus==="Awaiting Parts") return Math.max(currentProgress, 30);
  if(uiStatus==="New") return Math.min(currentProgress, 10);
  return currentProgress;
}
function parseListField(val, fallback){
  if(Array.isArray(val)) return val;
  if(typeof val === "string" && val.trim()){
    try{ const parsed = JSON.parse(val); if(Array.isArray(parsed)) return parsed.map(x=> typeof x==="string" ? x : (x.t || x.name || String(x))); }catch{}
    return val.split(",").map(s=> s.trim()).filter(Boolean);
  }
  return fallback;
}
function parseChecklist(val, progress){
  if(Array.isArray(val)){
    return val.map(c=> typeof c==="string" ? {t:c, done: progress>=100} : {t: c.t || c.task || c.name || "Step", done: !!c.done});
  }
  if(typeof val==="string" && val.trim()){
    try{ const parsed = JSON.parse(val); if(Array.isArray(parsed)) return parseChecklist(parsed, progress); }catch{}
  }
  // Fallback derived from progress
  const steps = ["Inspect / Diagnose", "Repair / Replace parts", "Quality Check + Road test"];
  return steps.map((t,i)=> ({ t, done: progress >= (i+1)*33 }));
}
function normalizeJob(j, workshop){
  const carMake = j.car_make || j.make || "";
  const carModel = j.car_model || j.model || "";
  const carYear = j.car_year || j.year || "";
  const carPlate = j.plate || j.license_plate || j.vin || "";
  const carStr = [carMake, carModel, carYear].filter(Boolean).join(" ") || j.car || j.vehicle || "Vehicle";
  const carFull = carPlate ? `${carStr} • ${carPlate}` : carStr;
  const progress = Number(j.progress ?? 0);
  const uiStatus = mapStatusToUI(j.status);
  const parts = parseListField(j.parts, []);
  return {
    dbId: j.id,
    id: `#JOB-${j.id}`,
    bookingId: j.booking_id ? `#AV-${j.booking_id}` : (j.bookingId || ""),
    bookingDbId: j.booking_id,
    date: String(j.booking_date || j.date || j.created_at || "").slice(0,10),
    customer: j.owner_name || j.customer_name || j.customer || "Customer",
    phone: j.owner_phone || j.phone || "",
    email: j.owner_email || j.email || "",
    car: carFull,
    service: j.service_type || j.service || j.description || "Service",
    priority: j.priority ? (String(j.priority).charAt(0).toUpperCase()+String(j.priority).slice(1).toLowerCase()) : "Normal",
    mechanic: j.mechanic_name || j.mechanic || "Unassigned",
    eta: j.eta || (uiStatus==="Completed" ? "Completed" : uiStatus==="Awaiting Parts" ? "Awaiting parts" : `${100-progress}% left`),
    status: uiStatus,
    progress,
    parts,
    notes: j.notes || j.description || j.remarks || "",
    checklist: parseChecklist(j.checklist, progress),
    amount: Number(j.amount ?? 0),
    raw: j,
  };
}

export default function MechanicJobsPage({ workshopId: propWorkshopId, workshop, onLogExpense }) {
  const storedUser = getStoredUser();
  const workshopId = propWorkshopId || workshop?.id || storedUser.id || storedUser.workshop_id || storedUser.workshopId;

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [mechanic, setMechanic] = useState("All");
  const [page, setPage] = useState(0);
  const perPage = 5;
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchJobs = useCallback(async ()=>{
    if(!workshopId){ setLoading(false); setError("No workshop ID. Please login again."); return; }
    setLoading(true); setError("");
    try{
      const res = await fetch(`${API}/bookings/jobs?workshop_id=${workshopId}&limit=200`);
      const data = await res.json().catch(()=>[]);
      if(!res.ok) throw new Error(data.error || "Failed to load jobs");
      const list = Array.isArray(data) ? data : (data.jobs || data.data || []);
      setJobs(list.map(j=> normalizeJob(j, workshop)));
    }catch(e){
      setError(e.message || "Could not load jobs. Is Flask running on :5000?");
      setJobs([]);
    }
    setLoading(false);
  }, [workshopId]);

  useEffect(()=>{ fetchJobs(); }, [fetchJobs]);

  const mechanics = useMemo(()=>{
    const set = new Set(jobs.map(j=> j.mechanic).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [jobs]);

  const filtered = useMemo(()=>{
    let d=[...jobs];
    if(search){ const s=search.toLowerCase(); d=d.filter(j=> `${j.id} ${j.bookingId} ${j.customer} ${j.car} ${j.service} ${j.mechanic}`.toLowerCase().includes(s)); }
    if(status!=="All") d=d.filter(j=>j.status===status);
    if(priority!=="All") d=d.filter(j=>j.priority===priority);
    if(mechanic!=="All") d=d.filter(j=>j.mechanic===mechanic);
    d.sort((a,b)=> new Date(b.date||"1970-01-01") - new Date(a.date||"1970-01-01"));
    return d;
  },[jobs, search, status, priority, mechanic]);

  const totalPages = Math.ceil(filtered.length/perPage);
  const paged = filtered.slice(page*perPage, page*perPage+perPage);

  const saveJob = async (job, patch)=>{
    const updated = { ...job, ...patch };
    // Optimistic
    setJobs(prev=> prev.map(j=> j.dbId===job.dbId ? updated : j));
    if(selected && selected.dbId===job.dbId) setSelected(updated);
    setSaving(true);
    try{
      const res = await fetch(`${API}/bookings/jobs`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          id: job.dbId,
          status: mapStatusToBackend(updated.status),
          progress: updated.progress,
          mechanic: updated.mechanic,
          remarks: updated.notes,
          checklist: updated.checklist,
          parts: updated.parts,
        })
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || "Job update failed");
    }catch(e){
      // Rollback
      setJobs(prev=> prev.map(j=> j.dbId===job.dbId ? job : j));
      if(selected && selected.dbId===job.dbId) setSelected(job);
      alert(e.message);
    }
    setSaving(false);
  };

  const updateJob = (id, patch)=>{
    const job = jobs.find(j=> j.id===id);
    if(!job) return;
    // Auto progress when status changes
    let nextPatch = { ...patch };
    if(patch.status && patch.progress===undefined){
      nextPatch.progress = progressForStatus(patch.status, job.progress);
    }
    saveJob(job, nextPatch);
  };
  const toggleCheck = (idx)=>{
    if(!selected) return;
    const nl = selected.checklist.map((c,i)=> i===idx ? {...c, done:!c.done} : c);
    const done = nl.filter(x=>x.done).length;
    const prog = nl.length ? Math.round((done/nl.length)*100) : selected.progress;
    saveJob(selected, { checklist: nl, progress: prog });
  };

  const stats = {total:jobs.length, active:jobs.filter(j=>["New","In Progress","QC"].includes(j.status)).length, awaiting:jobs.filter(j=>j.status==="Awaiting Parts").length, completed:jobs.filter(j=>j.status==="Completed").length};

  const priColor = (p)=> p==="Urgent"?{bg:"#FEE2E2", color:"#991B1B"}: p==="High"?{bg:"#FEF3C7", color:"#92400E"}: p==="Normal"?{bg:"#DBEAFE", color:"#1E40AF"}:{bg:"#F1F5F9", color:"#475569"};
  const statusColor = (s)=> s==="New"?{bg:"#DBEAFE", color:"#1E40AF"}: s==="In Progress"?{bg:"#E0E7FF", color:"#3730A3"}: s==="Awaiting Parts"?{bg:"#FCE7F3", color:"#9D174D"}: s==="QC"?{bg:"#DCFCE7", color:"#166534"}: s==="Completed"?{bg:"#F1F5F9", color:"#475569"}:{bg:"#FEF3C7", color:"#92400E"};

  if(loading) return <div style={{padding:"40px", textAlign:"center", color:"#64748B"}}>Loading jobs from backend...</div>;

  return (
    <>
    <style>{`
      .jb-wrap{ width:100%; max-width:100%; overflow:hidden; }
      .jb-stat{ background:#fff; border:1.5px solid #0A192F; border-radius:16px; padding:16px; height:100%; }
      .jb-toolbar{ background:#fff; border:1.5px solid #E2E8F0; border-radius:16px; padding:14px; display:flex; gap:10px; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom:14px; }
      .jb-search{ position:relative; flex:1; min-width:220px; max-width:340px; } .jb-search input{ width:100%; height:46px; border:1.5px solid #E2E8F0; border-radius:12px; padding:0 14px 0 42px; font-size:15px; font-weight:600; background:#F8FAFC; outline:none; } .jb-search i{ position:absolute; left:14px; top:50%; transform:translateY(-50%); color:#6B7A90; }
      .jb-table-wrap{ background:#fff; border:1.5px solid #E2E8F0; border-radius:16px; overflow:hidden; width:100%; }
      .jb-table{ width:100%; border-collapse:collapse; table-layout:fixed; } .jb-table th{ text-align:left; font-size:11px; font-weight:900; color:#6B7A90; padding:14px 10px; border-bottom:1.5px solid #E2E8F0; background:#F8FAFC; text-transform:uppercase; }
      .jb-table th:nth-child(1){ width:14%; } .jb-table th:nth-child(2){ width:26%; } .jb-table th:nth-child(3){ width:22%; } .jb-table th:nth-child(4){ width:18%; } .jb-table th:nth-child(5){ width:12%; } .jb-table th:nth-child(6){ width:8%; }
      .jb-table td{ padding:12px 10px; font-size:13px; font-weight:600; color:#0A192F; border-bottom:1px solid #E2E8F0; vertical-align:middle; }
      .jb-mobile{ display:none; } @media(max-width: 768px){ .jb-table-wrap.desktop{ display:none; } .jb-mobile{ display:grid; gap:12px; } .jb-toolbar{ flex-direction:column; align-items:stretch; } .jb-search{ max-width:100%; } }
      .jb-modal-backdrop{ position:fixed; inset:0; background:rgba(10,25,47,0.55); backdrop-filter:blur(6px); z-index:99; display:grid; place-items:center; padding:16px; } .jb-modal{ width:100%; max-width:680px; max-height:92vh; overflow:auto; background:#fff; border:2px solid #0A192F; border-radius:22px; box-shadow:0 30px 80px rgba(0,0,0,0.25); }
    `}</style>

    <div className="jb-wrap">
      <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', marginBottom:'16px'}}>
        <div><h2 style={{fontWeight:900, fontSize:'28px', color:'#0A192F', margin:'0 0 6px'}}>Workshop Jobs</h2><p style={{color:'#6B7A90', fontSize:'15px', margin:0, fontWeight:500}}>Active bay jobs • BAR ARD 284719 • Priority tracked • PST</p></div>
        <div style={{display:'flex', gap:'8px', alignSelf:'flex-start'}}><button onClick={fetchJobs} style={{height:'38px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff', fontWeight:800, fontSize:'12px', padding:'0 14px', cursor:'pointer'}}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button><span style={{fontSize:'12px', fontWeight:700, background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'8px 12px', borderRadius:'20px', alignSelf:'flex-start'}}>{filtered.length} jobs</span></div>
      </div>

      {error && <div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", color:"#991B1B", padding:"12px 14px", borderRadius:"12px", marginBottom:"12px", fontSize:"13px", fontWeight:700}}>{error}</div>}

      <div className="row g-3 mb-3" style={{margin:0, width:'100%'}}>
        <div className="col-6 col-lg-3"><div className="jb-stat"><div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90', letterSpacing:'0.06em'}}>TOTAL JOBS</div><div style={{fontWeight:900, fontSize:'26px', marginTop:'6px'}}>{stats.total}</div><div style={{fontSize:'11px', color:'#6B7A90'}}>30 days • LA</div></div></div>
        <div className="col-6 col-lg-3"><div className="jb-stat"><div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90'}}>ACTIVE IN BAY</div><div style={{fontWeight:900, fontSize:'26px', marginTop:'6px', color:'#3730A3'}}>{stats.active}</div><div style={{fontSize:'11px', color:'#6366F1', fontWeight:700}}>New + In Progress + QC</div></div></div>
        <div className="col-6 col-lg-3"><div className="jb-stat"><div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90'}}>AWAITING PARTS</div><div style={{fontWeight:900, fontSize:'26px', marginTop:'6px', color:'#9D174D'}}>{stats.awaiting}</div><div style={{fontSize:'11px', color:'#EC4899'}}>Order via suppliers</div></div></div>
        <div className="col-6 col-lg-3"><div className="jb-stat" style={{background:'#0A192F', borderColor:'#0A192F'}}><div style={{fontSize:'11px', fontWeight:800, color:'#94A3B8'}}>COMPLETED</div><div style={{fontWeight:900, fontSize:'26px', marginTop:'6px', color:'#fff'}}>{stats.completed}</div><div style={{fontSize:'11px', color:'#22C55E'}}>Ready for invoice</div></div></div>
      </div>

      <div className="jb-toolbar">
        <div className="jb-search"><i className="bi bi-search"></i><input placeholder="Search job, booking, customer, car..." value={search} onChange={e=>{setSearch(e.target.value); setPage(0);}} /></div>
        <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
          <select value={status} onChange={e=>{setStatus(e.target.value); setPage(0);}} style={{height:'46px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:800, fontSize:'12px', padding:'0 10px'}}><option value="All">All Status</option><option>New</option><option>In Progress</option><option>Awaiting Parts</option><option>QC</option><option>Completed</option><option>On Hold</option></select>
          <select value={priority} onChange={e=>{setPriority(e.target.value); setPage(0);}} style={{height:'46px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:800, fontSize:'12px', padding:'0 10px'}}><option value="All">All Priority</option><option>Urgent</option><option>High</option><option>Normal</option><option>Low</option></select>
          <select value={mechanic} onChange={e=>{setMechanic(e.target.value); setPage(0);}} style={{height:'46px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:800, fontSize:'12px', padding:'0 10px'}}>{mechanics.map(m=> <option key={m} value={m}>{m==="All" ? "All Mechanics" : m}</option>)}</select>
        </div>
      </div>

      <div className="jb-table-wrap desktop">
        <table className="jb-table">
          <thead><tr><th>Job • Booking • Date</th><th>Customer • Car • LA</th><th>Task • Priority</th><th>Mechanic • ETA</th><th>Status • Progress</th><th>Action</th></tr></thead>
          <tbody>
            {paged.length===0 ? <tr><td colSpan={6} style={{textAlign:'center', padding:'32px', color:'#6B7A90'}}>{jobs.length===0 ? "No jobs yet. Jobs are auto-created when an owner books this workshop." : "No jobs found"}</td></tr> :
            paged.map(j=>{
              const pc=priColor(j.priority); const sc=statusColor(j.status);
              return (
                <tr key={j.id}>
                  <td><b>{j.id}</b><div style={{fontSize:'11px', color:'#6B7A90'}}>{j.bookingId} • {j.date}</div></td>
                  <td><div style={{fontWeight:800, fontSize:'12px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{j.customer}</div><div style={{fontSize:'11px', color:'#6B7A90', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{j.car}</div></td>
                  <td><div style={{fontSize:'12px', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{j.service}</div><span style={{fontSize:'10px', fontWeight:800, padding:'3px 8px', borderRadius:'20px', background:pc.bg, color:pc.color}}>{j.priority.toUpperCase()}</span></td>
                  <td><div style={{fontSize:'12px', fontWeight:700}}>{j.mechanic}</div><div style={{fontSize:'11px', color:'#6B7A90'}}>{j.eta}</div></td>
                  <td><span style={{fontSize:'10px', fontWeight:800, padding:'3px 8px', borderRadius:'20px', background:sc.bg, color:sc.color}}>{j.status.toUpperCase()}</span><div style={{height:'6px', background:'#E2E8F0', borderRadius:'10px', marginTop:'6px', overflow:'hidden'}}><div style={{height:'100%', width:`${j.progress}%`, background:'#0A192F'}}></div></div><div style={{fontSize:'10px', color:'#6B7A90', marginTop:'2px'}}>{j.progress}%</div></td>
                  <td><button onClick={()=>setSelected(j)} style={{height:'34px', borderRadius:'8px', border:'1.5px solid #0A192F', background:'#0A192F', color:'#fff', fontWeight:800, fontSize:'11px', padding:'0 10px', cursor:'pointer'}}>Open</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', borderTop:'1.5px solid #E2E8F0', background:'#F8FAFC'}}>
          <div style={{fontSize:'13px', fontWeight:700, color:'#6B7A90'}}>{filtered.length===0 ? "0" : `${page*perPage+1}–${Math.min((page+1)*perPage, filtered.length)}`} of {filtered.length} • Page {page+1}/{totalPages||1}</div>
          <div style={{display:'flex', gap:'8px'}}><button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))} style={{height:'36px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff', fontWeight:800, fontSize:'12px', padding:'0 12px'}}>Prev</button><button disabled={page>=totalPages-1} onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} style={{height:'36px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff', fontWeight:800, fontSize:'12px', padding:'0 12px'}}>Next</button></div>
        </div>
      </div>

      <div className="jb-mobile">
        {paged.map(j=>{
          const sc=statusColor(j.status); const pc=priColor(j.priority);
          return (
            <div key={j.id} style={{background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:'16px', padding:'16px'}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px'}}><b style={{fontSize:'13px'}}>{j.id} • {j.bookingId}</b><span style={{fontSize:'10px', fontWeight:800, padding:'4px 8px', borderRadius:'20px', background:sc.bg, color:sc.color}}>{j.status}</span></div>
              <div style={{fontSize:'13px', fontWeight:800}}>{j.customer} • {j.car.split(" • ")[0]}</div>
              <div style={{fontSize:'12px', color:'#6B7A90', marginBottom:'6px'}}>{j.service} • <span style={{padding:'2px 6px', borderRadius:'20px', background:pc.bg, color:pc.color, fontWeight:800, fontSize:'10px'}}>{j.priority}</span></div>
              <div style={{height:'6px', background:'#E2E8F0', borderRadius:'10px', overflow:'hidden', marginBottom:'10px'}}><div style={{height:'100%', width:`${j.progress}%`, background:'#0A192F'}}></div></div>
              <button onClick={()=>setSelected(j)} style={{width:'100%', height:'44px', borderRadius:'10px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, fontSize:'13px'}}>Open Job</button>
            </div>
          );
        })}
        {paged.length===0 && <div style={{padding:"24px", textAlign:"center", color:"#6B7A90"}}>No jobs found</div>}
      </div>
    </div>

    {selected && (
      <div className="jb-modal-backdrop" onClick={()=>setSelected(null)}>
        <div className="jb-modal" onClick={e=>e.stopPropagation()}>
          <div style={{padding:'16px', borderBottom:'1.5px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#F8FAFC', position:'sticky', top:0, zIndex:2}}>
            <div><div style={{fontWeight:900, fontSize:'15px'}}>{selected.id} • {selected.bookingId} • {selected.customer}</div><div style={{fontSize:'11px', color:'#6B7A90'}}>{selected.date} • {selected.car} • BAR ARD 284719 • Inglewood, CA</div></div>
            <button onClick={()=>setSelected(null)} style={{width:'36px', height:'36px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff'}}><i className="bi bi-x-lg"></i></button>
          </div>
          <div style={{padding:'16px', display:'grid', gap:'14px'}}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
              <div style={{background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'12px', padding:'12px'}}><div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90'}}>TASK • PRIORITY</div><div style={{fontWeight:800, fontSize:'13px', marginTop:'4px'}}>{selected.service}</div><div style={{marginTop:'6px'}}><span style={{fontSize:'10px', fontWeight:800, padding:'4px 8px', borderRadius:'20px', background:priColor(selected.priority).bg, color:priColor(selected.priority).color}}>{selected.priority.toUpperCase()}</span></div><div style={{fontSize:'11px', color:'#6B7A90', marginTop:'6px'}}><i className="bi bi-tools me-1"></i>{selected.parts.length ? selected.parts.join(", ") : "No parts listed"}</div></div>
              <div style={{background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'12px', padding:'12px'}}><div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90'}}>MECHANIC • ETA</div><select value={selected.mechanic} onChange={e=>updateJob(selected.id, {mechanic:e.target.value})} style={{marginTop:'6px', height:'38px', borderRadius:'10px', border:'1.5px solid #E2E8F0', fontWeight:700, fontSize:'13px', width:'100%'}}><option>Unassigned</option><option>David Chen</option><option>Carlos R.</option>{!["Unassigned","David Chen","Carlos R."].includes(selected.mechanic) && <option>{selected.mechanic}</option>}</select><div style={{fontSize:'12px', color:'#6B7A90', marginTop:'6px'}}>{selected.eta}</div><div style={{height:'6px', background:'#E2E8F0', borderRadius:'10px', marginTop:'8px', overflow:'hidden'}}><div style={{height:'100%', width:`${selected.progress}%`, background:'#0A192F'}}></div></div><div style={{fontSize:'11px', color:'#6B7A90'}}>{selected.progress}% complete {saving ? "• Saving..." : ""}</div></div>
            </div>

            <div style={{background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:'12px', padding:'12px', fontSize:'13px', color:'#92400E'}}><i className="bi bi-chat-left-text me-1"></i><b>Workshop Notes:</b> {selected.notes || "No notes"}</div>

            <div>
              <div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90', marginBottom:'6px'}}>CHECKLIST • TAP TO COMPLETE</div>
              <div style={{display:'grid', gap:'8px'}}>{selected.checklist.map((c,i)=>(<button key={i} onClick={()=>toggleCheck(i)} style={{textAlign:'left', display:'flex', gap:'10px', alignItems:'center', border:'1.5px solid #E2E8F0', borderRadius:'12px', padding:'12px', background:c.done?'#F0FDF4':'#fff', cursor:'pointer'}}><i className={`bi ${c.done?'bi-check-circle-fill':'bi-circle'}`} style={{color:c.done?'#22C55E':'#CBD5E1', fontSize:'18px'}}></i><span style={{fontSize:'13px', fontWeight:700, textDecoration:c.done?'line-through':'none'}}>{c.t}</span></button>))}</div>
            </div>

            <div>
              <div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90', marginBottom:'6px'}}>UPDATE STATUS</div>
              <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>{["New","In Progress","Awaiting Parts","QC","Completed","On Hold"].map(s=>(<button key={s} disabled={saving} onClick={()=>updateJob(selected.id, {status:s})} style={{height:'38px', borderRadius:'20px', padding:'0 14px', fontWeight:800, fontSize:'12px', border:`1.5px solid ${selected.status===s ? '#0A192F' : '#E2E8F0'}`, background: selected.status===s ? '#0A192F' : '#fff', color: selected.status===s ? '#fff' : '#0A192F', cursor:'pointer', opacity: saving?0.6:1}}>{s}</button>))}</div>
            </div>

            <div style={{display:'flex', gap:'10px'}}><button onClick={()=>{ if(onLogExpense) onLogExpense(selected); setSelected(null); }} style={{flex:1, height:'46px', borderRadius:'12px', background:'#fff', border:'1.5px solid #E2E8F0', fontWeight:800, fontSize:'13px'}}><i className="bi bi-receipt me-1"></i> Log Parts Expense</button><button onClick={()=>setSelected(null)} style={{flex:1, height:'46px', borderRadius:'12px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, fontSize:'13px'}}>Close</button></div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}