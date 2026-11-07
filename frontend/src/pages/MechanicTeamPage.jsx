import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Swal from "sweetalert2";

const API = "http://127.0.0.1:5000/api";
function getStoredUser(){ try{ return JSON.parse(localStorage.getItem("autoville_user")||"{}"); }catch{ return {}; } }
function parseList(v){
  if(Array.isArray(v)) return v;
  if(typeof v === "string" && v.trim()){
    try{ const p = JSON.parse(v); if(Array.isArray(p)) return p; }catch{}
    return v.split(",").map(s=>s.trim()).filter(Boolean);
  }
  return [];
}
// FIX: "Fri, 06 Nov 2026..." -> "2026-11-06" . Never slice(0,10) a Date string.
function toYYYYMMDD(v){
  if(!v) return "";
  const s = String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  const d = new Date(s);
  if(!isNaN(d.getTime())){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  }
  const months = {Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12"};
  const match = s.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/);
  if(match) return `${match[3]}-${months[match[2]]}-${String(match[1]).padStart(2,"0")}`;
  return "";
}
function normMember(m, idx){
  return {
    dbId: m.id,
    id: `#TEAM-${m.id ?? (1000+idx)}`,
    name: m.name || m.full_name || "Member",
    role: m.role || "Technician",
    avatar: m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name || m.full_name || "Member")}&background=0A192F&color=fff&size=200`,
    phone: m.phone || "",
    email: m.email || "",
    experience: Number(m.experience ?? 0),
    hireDate: toYYYYMMDD(m.hire_date || m.hireDate) || new Date().toISOString().slice(0,10),
    status: m.status || "Active",
    barLicense: m.bar_license || m.barLicense || "",
    certifications: parseList(m.certifications),
    specialties: parseList(m.specialties),
    bio: m.bio || "",
    jobsCompleted: Number(m.jobs_completed ?? m.jobsCompleted ?? 0),
    rating: Number(m.rating ?? 5),
  };
}

const ALL_SPECIALTIES = ["Brake System","Engine Tune-Up","Oil + Filter","Transmission","AC / HVAC","EV Diagnostics","Electrical","Wheel Alignment","Tire & Wheel","Suspension","Exhaust","Fuel System","Battery","Diagnostics Scanner","Body Work","Detailing / Ceramic","Hybrid Systems","Performance Tuning","Smog Check"];
const ROLES = ["Owner","Manager","Lead Technician","Senior Technician","Technician","Diagnostic Specialist","EV Specialist","Electrician","Apprentice","Reception / Advisor","Detailer"];
const CERTS = ["ASE A1 Engine","ASE A5 Brakes","ASE A6 Electrical","BAR Licensed","BAR Smog License","EV Certified - 【entity-Tesla¦canonical_name=Tesla】","EV Certified - Hybrid","【entity-EPA¦canonical_name=EPA】 609 AC","Welding Certified","OEM 【entity-Porsche¦canonical_name=Porsche】","OEM 【entity-BMW¦canonical_name=BMW】","OEM 【entity-Toyota¦canonical_name=Toyota】"];
const STATUSES = ["Active","On Leave","Inactive"];

export default function MechanicTeamPage({ workshopId: propWorkshopId, workshop }){
  const storedUser = getStoredUser();
  const workshopId = propWorkshopId || workshop?.id || storedUser.id || storedUser.workshop_id || storedUser.workshopId;
  const fileRef = useRef(null);
  const [search, setSearch] = useState("");
  const [specF, setSpecF] = useState("All");
  const [roleF, setRoleF] = useState("All");
  const [statusF, setStatusF] = useState("All");
  const [sort, setSort] = useState("Newest");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const fetchTeam = useCallback(async ()=>{
    if(!workshopId){ setLoading(false); return; }
    setLoading(true); setError("");
    try{
      const res = await fetch(`${API}/workshops/${workshopId}/team`);
      const data = await res.json().catch(()=>[]);
      if(!res.ok) throw new Error(data.error || "Failed to load team");
      const list = Array.isArray(data) ? data : (data.team || data.members || []);
      setMembers(list.map((m,i)=> normMember(m,i)));
    }catch(e){ setError(e.message || "Could not load team. Is Flask running on :5000?"); setMembers([]); }
    setLoading(false);
  }, [workshopId]);

  useEffect(()=>{ fetchTeam(); }, [fetchTeam]);

  const filtered = useMemo(()=>{
    let d=[...members];
    if(search){ const s=search.toLowerCase(); d=d.filter(m=> `${m.name} ${m.role} ${m.email} ${m.phone} ${m.specialties.join(" ")} ${m.certifications.join(" ")} ${m.barLicense}`.toLowerCase().includes(s)); }
    if(specF!=="All") d=d.filter(m=>m.specialties.includes(specF));
    if(roleF!=="All") d=d.filter(m=>m.role===roleF);
    if(statusF!=="All") d=d.filter(m=>m.status===statusF);
    if(sort==="Newest") d.sort((a,b)=> new Date(b.hireDate)-new Date(a.hireDate));
    if(sort==="Experience") d.sort((a,b)=> b.experience-a.experience);
    if(sort==="Jobs") d.sort((a,b)=> b.jobsCompleted-a.jobsCompleted);
    if(sort==="Rating") d.sort((a,b)=> b.rating-a.rating);
    return d;
  },[members, search, specF, roleF, statusF, sort]);

  const stats = {
    total: members.length,
    active: members.filter(m=>m.status==="Active").length,
    leave: members.filter(m=>m.status==="On Leave").length,
    specialties: new Set(members.flatMap(m=>m.specialties)).size,
    avgExp: members.length ? (members.reduce((s,m)=>s+m.experience,0)/members.length).toFixed(1) : "0.0",
    bar: members.filter(m=>m.barLicense.includes("BAR")).length,
  };

  const startAdd = ()=>{
    setDraft({name:"", role:"Technician", phone:"", email:"", experience:1, hireDate:new Date().toISOString().slice(0,10), status:"Active", barLicense:"", certifications:[], specialties:[], bio:"", jobsCompleted:0, rating:5.0});
    setAvatarPreview(""); setEditing(null); setShowAdd(true);
  };
  const startEdit = (m)=>{
    setDraft({...m, hireDate: toYYYYMMDD(m.hireDate), certifications:[...m.certifications], specialties:[...m.specialties]}); setAvatarPreview(m.avatar); setEditing(m); setShowAdd(true);
  };
  const toggleArray = (field, value)=>{
    setDraft(d=>{
      const arr = d[field].includes(value) ? d[field].filter(v=>v!==value) : [...d[field], value];
      return {...d, [field]: arr};
    });
  };
  const onFile = (file)=>{
    if(!file) return;
    const reader = new FileReader();
    reader.onload = e=> setAvatarPreview(e.target.result);
    reader.readAsDataURL(file);
  };
  const save = async ()=>{
    if(!draft.name || !draft.role || !draft.phone || !draft.email){
      Swal.fire({ icon:"warning", title:"Missing fields", text:"Name, Role, Phone, Email are required", confirmButtonColor:"#0A192F" });
      return;
    }
    if(draft.specialties.length===0){
      Swal.fire({ icon:"warning", title:"Specialty required", text:"Select at least one specialty", confirmButtonColor:"#0A192F" });
      return;
    }
    setSaving(true);
    try{
      const hireDate = toYYYYMMDD(draft.hireDate) || new Date().toISOString().slice(0,10);
      const payload = {
        ...draft,
        name: draft.name,
        full_name: draft.name,
        hireDate: hireDate,
        hire_date: hireDate,
        avatar: avatarPreview || draft.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(draft.name)}&background=0A192F&color=fff&size=200`
      };
      const url = editing ? `${API}/workshops/${workshopId}/team/${editing.dbId}` : `${API}/workshops/${workshopId}/team`;
      const res = await fetch(url, {method: editing ? "PUT" : "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload)});
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
      const saved = normMember(data, members.length);
      if(editing) setMembers(prev=> prev.map(m=> m.dbId===editing.dbId ? saved : m));
      else setMembers(prev=> [saved, ...prev]);
      setShowAdd(false); setEditing(null); setDraft(null); setAvatarPreview("");
      Swal.fire({ icon:"success", title: editing ? "Team Member Updated" : "Team Member Added", text: `${payload.name} • ${payload.role} saved • BAR ARD 284719`, confirmButtonColor:"#0A192F", timer:2200, showConfirmButton:false });
    }catch(e){
      Swal.fire({ icon:"error", title:"Could not save team member", text: e.message || "Backend error. Check Flask is running.", confirmButtonColor:"#0A192F" });
    }
    setSaving(false);
  };

  const handleDelete = async (m)=>{
    if(!m || !m.dbId) return;
    const result = await Swal.fire({
      title: `Delete ${m.name}?`,
      text: `${m.name} • ${m.role} will be permanently removed. This cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#DC2626",
      cancelButtonColor: "#64748B",
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
    });
    if(!result.isConfirmed) return;
    setDeletingId(m.dbId);
    try{
      const res = await fetch(`${API}/workshops/${workshopId}/team/${m.dbId}`, { method: "DELETE" });
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || `Delete failed (${res.status})`);
      setMembers(prev=> prev.filter(x=> x.dbId !== m.dbId));
      if(viewing && viewing.dbId === m.dbId) setViewing(null);
      if(editing && editing.dbId === m.dbId){ setShowAdd(false); setEditing(null); setDraft(null); }
      Swal.fire({ icon:"success", title:"Team Member Deleted", text: `${m.name} has been removed.`, confirmButtonColor:"#0A192F", timer:2000, showConfirmButton:false });
    }catch(e){
      Swal.fire({ icon:"error", title:"Could not delete team member", text: e.message || "Backend error.", confirmButtonColor:"#0A192F" });
    }
    setDeletingId(null);
  };

  const specColor = (s)=>{
    if(["Brake System","Engine Tune-Up"].includes(s)) return {bg:"#DCFCE7", color:"#166534", border:"#BBF7D0"};
    if(["EV Diagnostics","Hybrid Systems","Electrical","Battery"].includes(s)) return {bg:"#EFF6FF", color:"#1E40AF", border:"#BFDBFE"};
    if(["AC / HVAC","Wheel Alignment"].includes(s)) return {bg:"#FEF3C7", color:"#92400E", border:"#FDE68A"};
    if(["Transmission","Suspension"].includes(s)) return {bg:"#FCE7F3", color:"#9D174D", border:"#FBCFE8"};
    return {bg:"#F8FAFC", color:"#475569", border:"#E2E8F0"};
  };

  if(loading) return <div style={{padding:"40px", textAlign:"center", color:"#64748B"}}>Loading team from backend...</div>;

  return (
    <>
    <style>{`
      .team-wrap{ width:100%; max-width:100%; overflow:hidden; }
      .team-stat{ background:#fff; border:1.5px solid #0A192F; border-radius:18px; padding:18px; height:100%; }
      .team-card{ background:#fff; border:1.5px solid #E2E8F0; border-radius:18px; padding:18px; transition:0.2s; height:100%; }
      .team-card:hover{ border-color:#0A192F; box-shadow:0 6px 20px rgba(10,25,47,0.06); }
      .team-toolbar{ background:#fff; border:1.5px solid #E2E8F0; border-radius:16px; padding:16px; display:flex; gap:12px; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom:16px; }
      .team-search{ position:relative; flex:1; min-width:240px; max-width:360px; } .team-search input{ width:100%; height:48px; border:1.5px solid #E2E8F0; border-radius:14px; padding:0 14px 0 44px; font-size:15px; font-weight:600; background:#F8FAFC; outline:none; } .team-search i{ position:absolute; left:16px; top:50%; transform:translateY(-50%); color:#6B7A90; }
      .team-modal-backdrop{ position:fixed; inset:0; background:rgba(10,25,47,0.55); backdrop-filter:blur(6px); z-index:99; display:grid; place-items:center; padding:16px; } .team-modal{ width:100%; max-width:880px; max-height:92vh; overflow:auto; background:#fff; border:2px solid #0A192F; border-radius:22px; box-shadow:0 30px 80px rgba(0,0,0,0.25); }
      .spec-badge{ font-size:12px; font-weight:700; padding:6px 12px; border-radius:20px; border:1px solid; display:inline-flex; align-items:center; gap:6px; }
      .upload-box{ border:2px dashed #CBD5E1; border-radius:16px; padding:18px; text-align:center; cursor:pointer; transition:0.2s; background:#F8FAFC; } .upload-box.dragover{ border-color:#0A192F; background:#EFF6FF; }
      @media(max-width:768px){ .team-toolbar{ flex-direction:column; align-items:stretch; } .team-search{ max-width:100%; } }
    `}</style>

    <div className="team-wrap">
      <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', marginBottom:'14px'}}>
        <div><h2 style={{fontWeight:900, fontSize:'30px', color:'#0A192F', margin:'0 0 8px'}}>Workshop Team • Members & Specialties</h2><p style={{color:'#6B7A90', fontSize:'16px', margin:0, fontWeight:500}}>Record team details, BAR license, certifications, area(s) of specialty • 112 S Market St, Inglewood, CA • BAR ARD 284719</p></div>
        <div style={{display:'flex', gap:'8px', alignSelf:'flex-start'}}>
          <button onClick={fetchTeam} style={{height:'48px', borderRadius:'12px', background:'#fff', border:'1.5px solid #E2E8F0', fontWeight:800, fontSize:'13px', padding:'0 14px'}}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
          <button onClick={startAdd} style={{height:'48px', borderRadius:'12px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, fontSize:'14px', padding:'0 20px'}}><i className="bi bi-person-plus me-2"></i>Add Team Member</button>
        </div>
      </div>

      {error && <div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", color:"#991B1B", padding:"12px 14px", borderRadius:"12px", marginBottom:"12px", fontSize:"13px", fontWeight:700}}>{error}</div>}

      <div className="row g-3 mb-3" style={{margin:0, width:'100%'}}>
        <div className="col-md-3"><div className="team-stat" style={{background:'#0A192F', color:'#fff', borderColor:'#0A192F'}}><div style={{fontSize:'12px', fontWeight:800, color:'#94A3B8'}}>TOTAL TEAM • ALL ROLES</div><div style={{fontSize:'36px', fontWeight:900, marginTop:'8px'}}>{stats.total}</div><div style={{fontSize:'13px', color:'#CBD5E1', marginTop:'4px'}}>{stats.active} active • {stats.leave} on leave • {members.length - stats.active - stats.leave} inactive • BAR {stats.bar}</div></div></div>
        <div className="col-md-3"><div className="team-stat"><div style={{fontSize:'12px', fontWeight:800, color:'#6B7A90'}}>ACTIVE NOW • ON DUTY</div><div style={{fontSize:'36px', fontWeight:900, color:'#0A192F', marginTop:'8px'}}>{stats.active}</div><div style={{fontSize:'13px', color:'#6B7A90', marginTop:'4px'}}>{stats.total ? Math.round(stats.active/stats.total*100) : 0}% active • Avg {stats.avgExp} yrs exp • Ready for bookings</div></div></div>
        <div className="col-md-3"><div className="team-stat"><div style={{fontSize:'12px', fontWeight:800, color:'#6B7A90'}}>SPECIALTIES COVERED • AREAS</div><div style={{fontSize:'36px', fontWeight:900, color:'#0A192F', marginTop:'8px'}}>{stats.specialties}</div><div style={{fontSize:'13px', color:'#6B7A90', marginTop:'4px'}}>{ALL_SPECIALTIES.length} possible • {stats.specialties} covered • {ALL_SPECIALTIES.length - stats.specialties} gap • EV + Brake top</div></div></div>
        <div className="col-md-3"><div className="team-stat"><div style={{fontSize:'12px', fontWeight:800, color:'#6B7A90'}}>BAR COMPLIANCE • LICENSED</div><div style={{fontSize:'36px', fontWeight:900, color:'#0A192F', marginTop:'8px'}}>{stats.bar}/{stats.total}</div><div style={{fontSize:'13px', color:'#6B7A90', marginTop:'4px'}}>BAR ARD 284719 • {stats.bar} BAR techs • ASE + EV certified • Inglewood</div></div></div>
      </div>

      <div className="team-toolbar">
        <div className="team-search"><i className="bi bi-search"></i><input placeholder="Search name, role, specialty, cert, BAR..." value={search} onChange={e=>setSearch(e.target.value)} /></div>
        <div style={{display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center'}}>
          <select value={specF} onChange={e=>setSpecF(e.target.value)} style={{height:'48px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:700, fontSize:'14px', padding:'0 12px', minWidth:'180px'}}>{["All",...ALL_SPECIALTIES].map(s=><option key={s} value={s}>{s==="All"?"All Specialties":s}</option>)}</select>
          <select value={roleF} onChange={e=>setRoleF(e.target.value)} style={{height:'48px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:700, fontSize:'14px', padding:'0 12px'}}><option value="All">All Roles</option>{ROLES.map(r=><option key={r} value={r}>{r}</option>)}</select>
          <select value={statusF} onChange={e=>setStatusF(e.target.value)} style={{height:'48px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:700, fontSize:'14px', padding:'0 12px'}}><option>All</option>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select>
          <select value={sort} onChange={e=>setSort(e.target.value)} style={{height:'48px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:700, fontSize:'14px', padding:'0 12px'}}><option value="Newest">Newest Hire</option><option value="Experience">Most Experience</option><option value="Jobs">Most Jobs</option><option value="Rating">Highest Rated</option></select>
          <span style={{fontSize:'13px', fontWeight:700, color:'#6B7A90', background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'8px 12px', borderRadius:'20px'}}>{filtered.length}/{members.length} members</span>
        </div>
      </div>

      <div className="row g-3" style={{margin:0, width:'100%'}}>
        {filtered.map(m=>{
          const statusBg = m.status==="Active" ? "#DCFCE7" : m.status==="On Leave" ? "#FEF3C7" : "#FEE2E2";
          const statusColor = m.status==="Active" ? "#166534" : m.status==="On Leave" ? "#92400E" : "#991B1B";
          return (
            <div key={m.id} className="col-lg-6 col-xl-4">
              <div className="team-card">
                <div style={{display:'flex', gap:'14px', alignItems:'flex-start'}}>
                  <img src={m.avatar} alt={m.name} style={{width:'72px', height:'72px', borderRadius:'16px', objectFit:'cover', border:'2px solid #0A192F'}} />
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center'}}><span style={{fontWeight:900, fontSize:'17px', color:'#0A192F'}}>{m.name}</span><span style={{fontSize:'11px', fontWeight:800, background:statusBg, color:statusColor, padding:'4px 10px', borderRadius:'20px'}}>{m.status}</span><span style={{fontSize:'11px', fontWeight:700, background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'4px 10px', borderRadius:'20px', color:'#475569'}}>{m.id}</span></div>
                    <div style={{fontSize:'13px', fontWeight:700, color:'#1E40AF', marginTop:'2px'}}>{m.role} • {m.experience} yrs • {m.jobsCompleted} jobs • {m.rating}★</div>
                    <div style={{fontSize:'12px', color:'#6B7A90', marginTop:'2px', lineHeight:1.4}}>{m.phone} • {m.email} • Hire {m.hireDate}</div>
                  </div>
                </div>
                <div style={{marginTop:'14px'}}>
                  <div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90', letterSpacing:'0.04em', marginBottom:'6px'}}>AREA(S) OF SPECIALTY • {m.specialties.length} AREAS</div>
                  <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
                    {m.specialties.map(s=>{
                      const c=specColor(s);
                      return <span key={s} className="spec-badge" style={{background:c.bg, color:c.color, borderColor:c.border}}><i className="bi bi-tools"></i>{s}</span>
                    })}
                  </div>
                </div>
                <div style={{marginTop:'12px'}}>
                  <div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90', marginBottom:'6px'}}>CERTIFICATIONS • BAR • ASE</div>
                  <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
                    <span style={{fontSize:'11px', fontWeight:700, background:'#0A192F', color:'#fff', padding:'5px 10px', borderRadius:'20px'}}><i className="bi bi-patch-check-fill me-1"></i>{m.barLicense || "No BAR ID"}</span>
                    {m.certifications.map(c=><span key={c} style={{fontSize:'11px', fontWeight:700, background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'5px 10px', borderRadius:'20px', color:'#475569'}}>{c}</span>)}
                  </div>
                </div>
                <div style={{marginTop:'12px', fontSize:'13px', color:'#475569', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'12px', padding:'10px', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>{m.bio}</div>
                <div style={{marginTop:'12px', display:'flex', gap:'8px'}}>
                  <button onClick={()=>setViewing(m)} style={{flex:1, height:'42px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#fff', fontWeight:700, fontSize:'13px'}}><i className="bi bi-eye me-1"></i>View</button>
                  <button onClick={()=>startEdit(m)} style={{flex:1, height:'42px', borderRadius:'12px', border:'1.5px solid #0A192F', background:'#0A192F', color:'#fff', fontWeight:700, fontSize:'13px'}}><i className="bi bi-pencil me-1"></i>Edit</button>
                  <button onClick={()=>handleDelete(m)} disabled={deletingId===m.dbId} style={{flex:1, height:'42px', borderRadius:'12px', border:'1.5px solid #FECACA', background:'#FEF2F2', color:'#991B1B', fontWeight:700, fontSize:'13px', opacity: deletingId===m.dbId ? 0.6 : 1}}><i className="bi bi-trash me-1"></i>{deletingId===m.dbId ? "Deleting..." : "Delete"}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length===0 && <div style={{background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:'18px', padding:'40px', textAlign:'center', color:'#6B7A90', fontWeight:600, marginTop:'14px'}}>{members.length===0 ? "No team members yet. Click Add Team Member to create your first one." : `No team members for ${specF} • ${roleF} • ${statusF}`}</div>}

      <div style={{background:'#0A192F', borderRadius:'16px', padding:'18px', color:'#fff', marginTop:'16px', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'10px'}}>
        <span style={{fontSize:'14px', color:'#94A3B8', fontWeight:600}}><i className="bi bi-people me-1"></i>Team: {filtered.length}/{members.length} • {stats.specialties}/{ALL_SPECIALTIES.length} specialties covered • Active {stats.active} • BAR ARD 284719</span>
        <span style={{fontSize:'14px', fontWeight:800, color:'#fff'}}>Avg {stats.avgExp} yrs exp • 112 S Market St, Ste 1008, Inglewood, CA</span>
      </div>
    </div>

    {viewing && (
      <div className="team-modal-backdrop" onClick={()=>setViewing(null)}>
        <div className="team-modal" onClick={e=>e.stopPropagation()}>
          <div style={{padding:'18px', borderBottom:'1.5px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#F8FAFC', position:'sticky', top:0, zIndex:2}}>
            <div style={{display:'flex', gap:'14px', alignItems:'center'}}><img src={viewing.avatar} style={{width:'64px', height:'64px', borderRadius:'16px', objectFit:'cover', border:'2px solid #0A192F'}} alt="" /><div><div style={{fontWeight:900, fontSize:'20px', color:'#0A192F'}}>{viewing.name} • {viewing.id}</div><div style={{fontSize:'13px', color:'#6B7A90', fontWeight:600}}>{viewing.role} • {viewing.experience} yrs • {viewing.status} • {viewing.barLicense} • {viewing.rating}★ • {viewing.jobsCompleted} jobs</div></div></div>
            <button onClick={()=>setViewing(null)} style={{width:'42px', height:'42px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#fff'}}><i className="bi bi-x-lg"></i></button>
          </div>
          <div style={{padding:'18px', display:'grid', gap:'14px'}}>
            <div style={{border:'1.5px solid #0A192F', borderRadius:'16px', padding:'16px'}}>
              <div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90', marginBottom:'8px'}}>CONTACT • BAR LICENSE • HIRE DATE</div>
              <div style={{fontSize:'14px', color:'#0A192F', lineHeight:1.8}}><b>Phone:</b> {viewing.phone} • <b>Email:</b> {viewing.email}<br/><b>Hire:</b> {viewing.hireDate} • <b>Experience:</b> {viewing.experience} yrs • <b>Jobs:</b> {viewing.jobsCompleted} • <b>Rating:</b> {viewing.rating}★<br/><b>BAR:</b> {viewing.barLicense} • <b>Status:</b> {viewing.status} • {viewing.id}</div>
            </div>
            <div style={{border:'1.5px solid #E2E8F0', borderRadius:'16px', padding:'16px'}}>
              <div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90', marginBottom:'8px'}}>AREA(S) OF SPECIALTY • {viewing.specialties.length} SPECIALTIES</div>
              <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>{viewing.specialties.map(s=>{ const c=specColor(s); return <span key={s} className="spec-badge" style={{background:c.bg, color:c.color, borderColor:c.border, fontSize:'13px', padding:'8px 14px'}}><i className="bi bi-tools"></i>{s}</span>})}</div>
            </div>
            <div style={{border:'1.5px solid #E2E8F0', borderRadius:'16px', padding:'16px'}}>
              <div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90', marginBottom:'8px'}}>CERTIFICATIONS • ASE • BAR • EV</div>
              <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>{viewing.certifications.map(c=><span key={c} style={{fontSize:'12px', fontWeight:700, background:'#0A192F', color:'#fff', padding:'7px 12px', borderRadius:'20px'}}><i className="bi bi-award me-1"></i>{c}</span>)}<span style={{fontSize:'12px', fontWeight:700, background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'7px 12px', borderRadius:'20px'}}>{viewing.barLicense}</span></div>
            </div>
            <div style={{border:'1.5px solid #E2E8F0', borderRadius:'16px', padding:'16px'}}><div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90', marginBottom:'8px'}}>BIO • NOTES</div><div style={{fontSize:'14px', color:'#0A192F', lineHeight:1.7}}>{viewing.bio}</div></div>
            <div style={{display:'flex', gap:'10px'}}><button onClick={()=>{ startEdit(viewing); setViewing(null); }} style={{flex:1, height:'48px', borderRadius:'12px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800}}>Edit • {viewing.id}</button><button onClick={()=>handleDelete(viewing)} style={{flex:1, height:'48px', borderRadius:'12px', background:'#FEF2F2', color:'#991B1B', border:'1.5px solid #FECACA', fontWeight:800}}>Delete</button><button onClick={()=>setViewing(null)} style={{flex:1, height:'48px', borderRadius:'12px', background:'#fff', border:'1.5px solid #E2E8F0', fontWeight:700}}>Close</button></div>
          </div>
        </div>
      </div>
    )}

    {showAdd && draft && (
      <div className="team-modal-backdrop" onClick={()=>{ setShowAdd(false); setEditing(null); }}>
        <div className="team-modal" onClick={e=>e.stopPropagation()}>
          <div style={{padding:'18px', borderBottom:'1.5px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#F8FAFC', position:'sticky', top:0, zIndex:2}}>
            <div><div style={{fontWeight:900, fontSize:'18px', color:'#0A192F'}}>{editing ? `Edit ${editing.name} • ${editing.id}` : "Add Team Member • Specialty"}</div><div style={{fontSize:'12px', color:'#6B7A90', fontWeight:600}}>BAR ARD 284719 • Inglewood • Photo + Specialty required • Audit log</div></div>
            <button onClick={()=>{ setShowAdd(false); setEditing(null); }} style={{width:'42px', height:'42px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#fff'}}><i className="bi bi-x-lg"></i></button>
          </div>
          <div style={{padding:'18px', display:'grid', gap:'16px'}}>
            <div className={`upload-box ${dragOver ? "dragover" : ""}`} onDragOver={e=>{e.preventDefault(); setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files[0]);}} onClick={()=>fileRef.current.click()}>
              {avatarPreview ? <img src={avatarPreview} style={{width:'96px', height:'96px', borderRadius:'16px', objectFit:'cover', border:'2px solid #0A192F', margin:'0 auto', display:'block'}} alt="" /> : <div style={{width:'96px', height:'96px', borderRadius:'16px', background:'#E2E8F0', display:'grid', placeItems:'center', margin:'0 auto'}}><i className="bi bi-person" style={{fontSize:'32px', color:'#6B7A90'}}></i></div>}
              <div style={{marginTop:'10px', fontSize:'13px', fontWeight:700, color:'#0A192F'}}>{avatarPreview ? "Click / Drop to change photo" : "Upload team photo • Drag & drop or click • Base64"}</div>
              <div style={{fontSize:'11px', color:'#6B7A90', marginTop:'2px'}}>JPG/PNG • auto resize • stored as base64 for BAR audit</div>
              <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>onFile(e.target.files[0])} />
            </div>
            <div className="row g-3" style={{margin:0, width:'100%'}}>
              <div className="col-md-6"><label style={{fontSize:'12px', fontWeight:800, color:'#0A192F'}}>Full Name *</label><input value={draft.name} onChange={e=>setDraft({...draft, name:e.target.value})} placeholder="David Okonkwo" style={{width:'100%', height:'48px', border:'1.5px solid #E2E8F0', borderRadius:'12px', padding:'0 14px', fontSize:'15px', fontWeight:600, marginTop:'6px'}} /></div>
              <div className="col-md-3"><label style={{fontSize:'12px', fontWeight:800}}>Role *</label><select value={draft.role} onChange={e=>setDraft({...draft, role:e.target.value})} style={{width:'100%', height:'48px', border:'1.5px solid #E2E8F0', borderRadius:'12px', padding:'0 12px', fontSize:'14px', fontWeight:600, marginTop:'6px'}}>{ROLES.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
              <div className="col-md-3"><label style={{fontSize:'12px', fontWeight:800}}>Status</label><select value={draft.status} onChange={e=>setDraft({...draft, status:e.target.value})} style={{width:'100%', height:'48px', border:'1.5px solid #E2E8F0', borderRadius:'12px', padding:'0 12px', fontSize:'14px', fontWeight:600, marginTop:'6px'}}>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
              <div className="col-md-6"><label style={{fontSize:'12px', fontWeight:800}}>Phone *</label><input value={draft.phone} onChange={e=>setDraft({...draft, phone:e.target.value})} placeholder="+1 (323) 555-...." style={{width:'100%', height:'48px', border:'1.5px solid #E2E8F0', borderRadius:'12px', padding:'0 14px', fontSize:'15px', fontWeight:600, marginTop:'6px'}} /></div>
              <div className="col-md-6"><label style={{fontSize:'12px', fontWeight:800}}>Email *</label><input value={draft.email} onChange={e=>setDraft({...draft, email:e.target.value})} placeholder="name@elitegarage.la" style={{width:'100%', height:'48px', border:'1.5px solid #E2E8F0', borderRadius:'12px', padding:'0 14px', fontSize:'15px', fontWeight:600, marginTop:'6px'}} /></div>
              <div className="col-md-3"><label style={{fontSize:'12px', fontWeight:800}}>Experience (yrs)</label><input type="number" min="0" max="40" value={draft.experience} onChange={e=>setDraft({...draft, experience:Number(e.target.value)})} style={{width:'100%', height:'48px', border:'1.5px solid #E2E8F0', borderRadius:'12px', padding:'0 14px', fontSize:'15px', fontWeight:600, marginTop:'6px'}} /></div>
              <div className="col-md-3"><label style={{fontSize:'12px', fontWeight:800}}>Hire Date</label><input type="date" value={draft.hireDate} onChange={e=>setDraft({...draft, hireDate:e.target.value})} style={{width:'100%', height:'48px', border:'1.5px solid #E2E8F0', borderRadius:'12px', padding:'0 14px', fontSize:'14px', fontWeight:600, marginTop:'6px'}} /></div>
              <div className="col-md-6"><label style={{fontSize:'12px', fontWeight:800}}>BAR License / Tech ID</label><input value={draft.barLicense} onChange={e=>setDraft({...draft, barLicense:e.target.value})} placeholder="BAR ARD 284719 / BAR Tech ID..." style={{width:'100%', height:'48px', border:'1.5px solid #E2E8F0', borderRadius:'12px', padding:'0 14px', fontSize:'14px', fontWeight:600, marginTop:'6px'}} /></div>
            </div>
            <div style={{border:'1.5px solid #0A192F', borderRadius:'16px', padding:'16px'}}>
              <div style={{fontSize:'12px', fontWeight:900, color:'#0A192F', marginBottom:'10px', letterSpacing:'0.04em'}}>AREA(S) OF SPECIALTY • SELECT AT LEAST ONE • {draft.specialties.length} SELECTED *</div>
              <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
                {ALL_SPECIALTIES.map(s=>{
                  const active = draft.specialties.includes(s);
                  const c = specColor(s);
                  return (
                    <button key={s} onClick={()=>toggleArray("specialties", s)} style={{height:'40px', borderRadius:'20px', border:`1.5px solid ${active ? '#0A192F' : c.border}`, background: active ? '#0A192F' : c.bg, color: active ? '#fff' : c.color, fontWeight:700, fontSize:'13px', padding:'0 14px'}}>
                      <i className={`bi ${active ? 'bi-check2-circle' : 'bi-tools'} me-1`}></i>{s} {active ? "✓" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{border:'1.5px solid #E2E8F0', borderRadius:'16px', padding:'16px'}}>
              <div style={{fontSize:'12px', fontWeight:900, color:'#6B7A90', marginBottom:'10px'}}>CERTIFICATIONS • ASE • BAR • EV • OEM</div>
              <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
                {CERTS.map(c=>{
                  const active = draft.certifications.includes(c);
                  return <button key={c} onClick={()=>toggleArray("certifications", c)} style={{height:'38px', borderRadius:'20px', border:`1.5px solid ${active ? '#0A192F' : '#E2E8F0'}`, background: active ? '#0A192F' : '#fff', color: active ? '#fff' : '#475569', fontWeight:700, fontSize:'12px', padding:'0 12px'}}><i className={`bi ${active ? 'bi-award-fill' : 'bi-award'} me-1`}></i>{c}</button>
                })}
              </div>
            </div>
            <div><label style={{fontSize:'12px', fontWeight:800}}>Bio / Notes</label><textarea value={draft.bio} onChange={e=>setDraft({...draft, bio:e.target.value})} placeholder="14 years LA auto repair, BAR licensed..." style={{width:'100%', minHeight:'90px', border:'1.5px solid #E2E8F0', borderRadius:'12px', padding:'12px 14px', fontSize:'14px', fontWeight:500, marginTop:'6px', resize:'vertical'}}></textarea></div>
            <div className="row g-2" style={{margin:0, width:'100%'}}>
              <div className="col-6"><label style={{fontSize:'12px', fontWeight:800}}>Jobs Completed</label><input type="number" min="0" value={draft.jobsCompleted} onChange={e=>setDraft({...draft, jobsCompleted:Number(e.target.value)})} style={{width:'100%', height:'48px', border:'1.5px solid #E2E8F0', borderRadius:'12px', padding:'0 14px', marginTop:'6px', fontWeight:600}} /></div>
              <div className="col-6"><label style={{fontSize:'12px', fontWeight:800}}>Internal Rating (1-5)</label><input type="number" min="1" max="5" step="0.1" value={draft.rating} onChange={e=>setDraft({...draft, rating:Number(e.target.value)})} style={{width:'100%', height:'48px', border:'1.5px solid #E2E8F0', borderRadius:'12px', padding:'0 14px', marginTop:'6px', fontWeight:600}} /></div>
            </div>
            <div style={{display:'flex', gap:'10px', marginTop:'4px'}}>
              <button onClick={save} disabled={saving} style={{flex:1, height:'52px', borderRadius:'12px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, fontSize:'15px', opacity: saving ? 0.7 : 1}}><i className="bi bi-check2 me-1"></i>{saving ? "Saving..." : editing ? `Update ${draft.name} • Save Specialty` : "Add Member • Save Team"}</button>
              <button onClick={()=>{ setShowAdd(false); setEditing(null); }} style={{flex:1, height:'52px', borderRadius:'12px', background:'#fff', border:'1.5px solid #E2E8F0', fontWeight:700, fontSize:'15px'}}>Cancel</button>
            </div>
            {editing && (
              <button onClick={()=>handleDelete(editing)} disabled={deletingId===editing.dbId} style={{width:'100%', height:'48px', borderRadius:'12px', background:'#FEF2F2', color:'#991B1B', border:'1.5px solid #FECACA', fontWeight:800, fontSize:'14px'}}><i className="bi bi-trash me-1"></i>{deletingId===editing.dbId ? "Deleting..." : `Delete ${editing.name} • Remove from Team`}</button>
            )}
            <div style={{fontSize:'11px', color:'#6B7A90', textAlign:'center', marginTop:'2px'}}>BAR ARD 284719 • 112 S Market St, Ste 1008, Inglewood, CA 90301 • Specialty used for auto-routing bookings • LA/PST</div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}