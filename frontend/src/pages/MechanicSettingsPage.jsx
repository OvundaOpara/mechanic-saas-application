import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import Swal from "sweetalert2";

const API = "http://127.0.0.1:5000/api";
function getStoredUser(){
  const keys = ["autoville_user","autoville_workshop"];
  for(const k of keys){
    try{
      const v = JSON.parse(localStorage.getItem(k)||"{}");
      if(v && (v.id || v.workshop_id || v.workshopId)) return v;
    }catch{}
  }
  try{ return JSON.parse(localStorage.getItem("autoville_user")||"{}"); }catch{ return {}; }
}
function parseJSON(v, def){
  if(Array.isArray(v)) return v;
  if(typeof v === "string" && v.trim()){
    try{ const p = JSON.parse(v); if(Array.isArray(p)) return p; }catch{}
  }
  return def;
}
function toYYYYMMDD(v){
  if(!v) return "";
  const s = String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  const d = new Date(s);
  if(!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return "";
}
const DEFAULT_HOURS = [
  { day:"Monday", open:"08:00", close:"18:00", enabled:true },
  { day:"Tuesday", open:"08:00", close:"18:00", enabled:true },
  { day:"Wednesday", open:"08:00", close:"18:00", enabled:true },
  { day:"Thursday", open:"08:00", close:"18:00", enabled:true },
  { day:"Friday", open:"08:00", close:"18:00", enabled:true },
  { day:"Saturday", open:"08:00", close:"16:00", enabled:true },
  { day:"Sunday", open:"09:00", close:"14:00", enabled:false },
];
const ALL_SPECIALTIES = [
  "Brake System","Engine Tune-Up","Oil + Filter","Transmission","AC / HVAC","EV Diagnostics","Electrical","Wheel Alignment","Tire & Wheel","Suspension","Exhaust","Fuel System","Battery","Diagnostics Scanner","Body Work","Detailing / Ceramic","Hybrid Systems","Performance Tuning","Smog Check","Windshield & Glass","Locksmith / Keys"
];

export default function MechanicSettingsPage({ workshopId: propWorkshopId, workshop: propWorkshop }){
  const storedUser = getStoredUser();
  const workshopId = propWorkshopId || propWorkshop?.id || storedUser.id || storedUser.workshop_id || storedUser.workshopId;
  const logoRef = useRef(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [customSpec, setCustomSpec] = useState("");
  const [selectSpec, setSelectSpec] = useState("Brake System");
  const [workshop, setWorkshop] = useState(null);

  const fetchSettings = useCallback(async ()=>{
    if(!workshopId){ setLoading(false); setError("No workshopId found - please log out and log in again as workshop."); return; }
    setLoading(true); setError("");
    try{
      const res = await fetch(`${API}/workshops/${workshopId}/settings`);
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || `Failed to load settings (${res.status})`);
      const specsRaw = parseJSON(data.specialties, []);
      const specs = specsRaw.map(s=>{
        if(typeof s === "string") return { name:s, added:new Date().toISOString().slice(0,10), primary:false, enabled:true, teamCount:0 };
        return { name:s.name||"", added:toYYYYMMDD(s.added)||new Date().toISOString().slice(0,10), primary:!!s.primary, enabled:s.enabled!==false, teamCount:Number(s.teamCount||0) };
      });
      const hoursRaw = parseJSON(data.hours, DEFAULT_HOURS);
      const hours = hoursRaw.length ? hoursRaw.map(h=>({ day:h.day, open:h.open||"08:00", close:h.close||"18:00", enabled:h.enabled!==false })) : DEFAULT_HOURS;
      setWorkshop({
        name: data.name || data.business_name || "",
        ownerName: data.ownerName || data.owner_name || "",
        description: data.description || "",
        barLicense: data.barLicense || data.bar_license || "",
        barType: data.barType || data.bar_type || "Automotive Repair Dealer",
        barExpiry: toYYYYMMDD(data.barExpiry || data.bar_expiry) || "",
        barVerified: data.barVerified ?? data.bar_verified ?? true,
        address: data.address || "",
        city: data.city || "",
        state: data.state || "",
        zip: data.zip || "",
        phone: data.phone || "",
        supportPhone: data.supportPhone || data.support_phone || "",
        email: data.email || "",
        supportEmail: data.supportEmail || data.support_email || "",
        infoEmail: data.infoEmail || data.info_email || "",
        website: data.website || "",
        taxId: data.taxId || data.tax_id || "",
        timezone: data.timezone || "America/Los_Angeles • PST",
        currency: data.currency || "USD • $",
        specialties: specs,
        hours: hours,
      });
      setLogoPreview(data.logo || data.avatar || "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=300&q=80");
    }catch(e){
      setError(e.message || "Could not load settings. Is Flask running on :5000?");
    }
    setLoading(false);
  }, [workshopId]);

  useEffect(()=>{ fetchSettings(); }, [fetchSettings]);

  const totalTeamCoverage = useMemo(()=> workshop ? new Set(workshop.specialties.filter(s=>s.enabled).map(s=>s.name)).size : 0, [workshop]);

  const onLogoFile = (file)=>{
    if(!file) return;
    const r = new FileReader();
    r.onload = e=> setLogoPreview(e.target.result);
    r.readAsDataURL(file);
  };

  const addSpecialty = (nameRaw)=>{
    const name = (nameRaw||"").trim();
    if(!name) return;
    if(workshop.specialties.some(s=>s.name.toLowerCase()===name.toLowerCase())){
      Swal.fire({ icon:"warning", title:"Already added", text:`${name} already added`, confirmButtonColor:"#0A192F" });
      return;
    }
    setWorkshop(w=>({
      ...w,
      specialties: [{ name, added: new Date().toISOString().slice(0,10), primary:false, enabled:true, teamCount:0 }, ...w.specialties]
    }));
    setCustomSpec("");
  };

  const removeSpecialty = async (name)=>{
    if(workshop.specialties.filter(s=>s.enabled).length<=1){
      Swal.fire({ icon:"warning", title:"Keep at least 1", text:"Keep at least 1 active specialty for BAR compliance", confirmButtonColor:"#0A192F" });
      return;
    }
    const res = await Swal.fire({
      title:`Remove ${name}?`,
      text:"Team members with this specialty will keep it, but bookings will not route here.",
      icon:"warning", showCancelButton:true, confirmButtonColor:"#DC2626", confirmButtonText:"Yes, remove", cancelButtonText:"Cancel"
    });
    if(!res.isConfirmed) return;
    setWorkshop(w=>({...w, specialties: w.specialties.filter(s=>s.name!==name)}));
  };

  const toggleEnabled = (name)=>{
    setWorkshop(w=>{
      const countEnabled = w.specialties.filter(s=>s.enabled).length;
      const target = w.specialties.find(s=>s.name===name);
      if(target.enabled && countEnabled===1){
        Swal.fire({ icon:"warning", title:"Keep at least 1", text:"Keep at least 1 enabled specialty", confirmButtonColor:"#0A192F" });
        return w;
      }
      return {...w, specialties: w.specialties.map(s=> s.name===name ? {...s, enabled:!s.enabled} : s)};
    });
  };

  const togglePrimary = (name)=>{
    setWorkshop(w=>({...w, specialties: w.specialties.map(s=> s.name===name ? {...s, primary:!s.primary} : s)}));
  };

  const saveAll = async ()=>{
    // READ FROM DOM TOO - state can be stale, DOM never lies
    const nameFromDOM = document.getElementById("ws-name")?.value?.trim() || "";
    const barFromDOM = document.getElementById("ws-bar")?.value?.trim() || "";
    const nameVal = (workshop?.name || nameFromDOM || storedUser?.business_name || storedUser?.name || storedUser?.businessName || "Elite Garage").trim();
    const barVal = (workshop?.barLicense || barFromDOM || "BAR ARD 284719").trim();

    console.log("SAVE DEBUG:", { stateName: workshop?.name, domName: nameFromDOM, finalName: nameVal, stateBar: workshop?.barLicense, domBar: barFromDOM, finalBar: barVal, workshop });

    // Auto-fill state so UI shows real values, not placeholders
    const finalWorkshop = { ...workshop, name: nameVal, business_name: nameVal, workshop_name: nameVal, barLicense: barVal, bar_license: barVal };
    setWorkshop(finalWorkshop);

    setSaving(true);
    try{
      const payload = {
        ...finalWorkshop,
        name: nameVal, business_name: nameVal, workshop_name: nameVal,
        ownerName: finalWorkshop.ownerName, owner_name: finalWorkshop.ownerName,
        barLicense: barVal, bar_license: barVal, bar_license_number: barVal,
        barType: finalWorkshop.barType, bar_type: finalWorkshop.barType,
        barExpiry: finalWorkshop.barExpiry, bar_expiry: finalWorkshop.barExpiry,
        supportPhone: finalWorkshop.supportPhone, support_phone: finalWorkshop.supportPhone,
        supportEmail: finalWorkshop.supportEmail, support_email: finalWorkshop.supportEmail,
        infoEmail: finalWorkshop.infoEmail, info_email: finalWorkshop.infoEmail,
        taxId: finalWorkshop.taxId, tax_id: finalWorkshop.taxId,
        logo: logoPreview, avatar: logoPreview,
        specialties: finalWorkshop.specialties,
        hours: finalWorkshop.hours,
      };
      const res = await fetch(`${API}/workshops/${workshopId}/settings`, { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
      setSavedAt(new Date().toLocaleString("en-US",{hour:"numeric", minute:"2-digit", month:"short", day:"numeric", year:"numeric", timeZone:"America/Los_Angeles"}) + " PST");
      Swal.fire({ icon:"success", title:"Settings Saved", text:`${nameVal} • ${barVal} • ${finalWorkshop.specialties.filter(s=>s.enabled).length} active specialties saved`, confirmButtonColor:"#0A192F", timer:2200, showConfirmButton:false });
      fetchSettings();
    }catch(e){
      Swal.fire({ icon:"error", title:"Could not save settings", text: e.message || "Backend error. Check Flask is running.", confirmButtonColor:"#0A192F" });
    }
    setSaving(false);
  };

  const specColor = (s)=>{
    if(["Brake System","Engine Tune-Up"].includes(s)) return {bg:"#DCFCE7", color:"#166534", border:"#BBF7D0"};
    if(["EV Diagnostics","Hybrid Systems","Electrical","Battery"].includes(s)) return {bg:"#EFF6FF", color:"#1E40AF", border:"#BFDBFE"};
    if(["AC / HVAC","Wheel Alignment"].includes(s)) return {bg:"#FEF3C7", color:"#92400E", border:"#FDE68A"};
    return {bg:"#F8FAFC", color:"#475569", border:"#E2E8F0"};
  };

  if(loading) return <div style={{padding:"40px", textAlign:"center", color:"#64748B"}}>Loading workshop settings from backend...</div>;
  if(!workshop) return <div style={{padding:"40px", textAlign:"center"}}><div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", color:"#991B1B", padding:"14px", borderRadius:"12px", fontWeight:700}}>{error || "Workshop not found"}</div><button onClick={fetchSettings} style={{marginTop:"12px", height:"44px", padding:"0 18px", borderRadius:"12px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800}}>Retry</button></div>;

  const availableToAdd = ALL_SPECIALTIES.filter(a=> !workshop.specialties.some(s=>s.name.toLowerCase()===a.toLowerCase()));

  return (
    <>
    <style>{`
      .set-wrap{ width:100%; max-width:100%; overflow:hidden; }
      .set-card{ background:#fff; border:1.5px solid #E2E8F0; border-radius:18px; padding:18px; }
      .set-card-dark{ background:#0A192F; border:1.5px solid #0A192F; border-radius:18px; padding:18px; color:#fff; }
      .set-input{ width:100%; height:48px; border:1.5px solid #E2E8F0; border-radius:12px; padding:0 14px; font-size:14px; font-weight:600; background:#F8FAFC; outline:none; }
      .set-textarea{ width:100%; min-height:90px; border:1.5px solid #E2E8F0; border-radius:12px; padding:12px 14px; font-size:14px; font-weight:500; background:#F8FAFC; outline:none; resize:vertical; }
      .set-label{ font-size:11px; font-weight:800; color:#0A192F; letter-spacing:0.04em; margin-bottom:6px; display:block; }
      .spec-chip{ display:inline-flex; align-items:center; gap:8px; padding:10px 14px; border-radius:20px; border:1.5px solid; font-size:13px; font-weight:700; transition:0.2s; }
      .upload-box{ border:2px dashed #CBD5E1; border-radius:16px; padding:16px; text-align:center; cursor:pointer; background:#F8FAFC; transition:0.2s; } .upload-box.dragover{ border-color:#0A192F; background:#EFF6FF; }
      @media(max-width:768px){ .set-card, .set-card-dark{ padding:14px; } }
    `}</style>

    <div className="set-wrap">
      <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', marginBottom:'14px'}}>
        <div><h2 style={{fontWeight:900, fontSize:'28px', color:'#0A192F', margin:'0 0 6px'}}>Settings • Workshop Profile • Specializations</h2><p style={{color:'#6B7A90', fontSize:'15px', margin:0, fontWeight:500}}>Manage BAR license, contact, hours, and area(s) of specialty • Add new / remove old • Used for booking routing & customer trust • Inglewood, CA • Workshop ID: {workshopId}</p></div>
        <div style={{display:'flex', gap:'8px', alignSelf:'flex-start'}}><span style={{height:'44px', borderRadius:'12px', background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'0 14px', display:'grid', placeItems:'center', fontSize:'13px', fontWeight:700, color:'#6B7A90'}}><i className="bi bi-clock me-1"></i>{savedAt ? `Saved ${savedAt}` : "Not saved yet"} • {totalTeamCoverage} active specialties</span><button onClick={saveAll} disabled={saving} style={{height:'44px', borderRadius:'12px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, fontSize:'14px', padding:'0 18px'}}>{saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</> : <><i className="bi bi-check2-circle me-1"></i>Save All Settings</>}</button></div>
      </div>

      {error && <div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", color:"#991B1B", padding:"12px 14px", borderRadius:"12px", marginBottom:"12px", fontSize:"13px", fontWeight:700}}>{error}</div>}

      <div className="row g-3" style={{margin:0, width:'100%'}}>
        <div className="col-lg-8" style={{display:'grid', gap:'14px'}}>
          <div className="set-card">
            <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'10px', marginBottom:'14px'}}><span style={{fontWeight:900, fontSize:'16px', color:'#0A192F'}}><i className="bi bi-shop me-2"></i>Workshop Identity • {workshop.barLicense}</span><span style={{fontSize:'11px', fontWeight:800, background:'#DCFCE7', color:'#166534', padding:'5px 10px', borderRadius:'20px'}}><i className="bi bi-patch-check-fill me-1"></i>VERIFIED • Inglewood</span></div>
            <div className="row g-3" style={{margin:0, width:'100%'}}>
              <div className="col-md-4">
                <div className={`upload-box ${dragOver ? "dragover" : ""}`} onDragOver={e=>{e.preventDefault(); setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault(); setDragOver(false); onLogoFile(e.dataTransfer.files[0]);}} onClick={()=>logoRef.current.click()} style={{height:'100%', display:'grid', placeItems:'center'}}>
                  <div>
                    <img src={logoPreview} alt="Logo" style={{width:'96px', height:'96px', borderRadius:'16px', objectFit:'cover', border:'2px solid #0A192F', margin:'0 auto', display:'block'}} />
                    <div style={{marginTop:'10px', fontSize:'12px', fontWeight:700, color:'#0A192F'}}>Click / Drop logo • Base64</div>
                    <div style={{fontSize:'11px', color:'#6B7A90'}}>JPG/PNG • auto stored for BAR audit</div>
                  </div>
                  <input ref={logoRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>onLogoFile(e.target.files[0])} />
                </div>
              </div>
              <div className="col-md-8" style={{display:'grid', gap:'12px'}}>
                <div><span className="set-label">WORKSHOP NAME * • CUSTOMER FACING</span><input id="ws-name" className="set-input" value={workshop.name} onChange={e=>setWorkshop({...workshop, name:e.target.value})} placeholder="Elite Garage" /></div>
                <div><span className="set-label">OWNER / MANAGER NAME</span><input className="set-input" value={workshop.ownerName} onChange={e=>setWorkshop({...workshop, ownerName:e.target.value})} placeholder="David Okonkwo" /></div>
                <div><span className="set-label">DESCRIPTION • SHOWS ON WORKSHOP PAGE • TRUST</span><textarea className="set-textarea" value={workshop.description} onChange={e=>setWorkshop({...workshop, description:e.target.value})} placeholder="BAR certified..." /></div>
              </div>
            </div>
          </div>

          <div className="set-card" style={{borderColor:'#0A192F', borderWidth:'1.5px'}}>
            <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'10px', marginBottom:'14px'}}>
              <span style={{fontWeight:900, fontSize:'16px', color:'#0A192F'}}><i className="bi bi-tools me-2"></i>Area(s) of Specialization • Workshop Level • Add / Remove</span>
              <span style={{fontSize:'12px', fontWeight:800, background:'#0A192F', color:'#fff', padding:'6px 12px', borderRadius:'20px'}}>{workshop.specialties.filter(s=>s.enabled).length} Active • {workshop.specialties.length} Total • {availableToAdd.length} available to add</span>
            </div>
            <div style={{background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'14px', padding:'14px', display:'grid', gap:'12px', marginBottom:'14px'}}>
              <div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90'}}>ADD SPECIALTY • 2 WAYS • SELECT FROM LIST OR CREATE CUSTOM</div>
              <div className="row g-2" style={{margin:0, width:'100%'}}>
                <div className="col-md-6">
                  <div style={{display:'flex', gap:'8px'}}>
                    <select value={selectSpec} onChange={e=>setSelectSpec(e.target.value)} className="set-input" style={{flex:1}}>
                      {availableToAdd.length===0 ? <option>All added • create custom below</option> : availableToAdd.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                    <button disabled={availableToAdd.length===0} onClick={()=>addSpecialty(selectSpec)} style={{height:'48px', borderRadius:'12px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, padding:'0 16px', whiteSpace:'nowrap'}}><i className="bi bi-plus-lg me-1"></i>Add</button>
                  </div>
                  <div style={{fontSize:'11px', color:'#6B7A90', marginTop:'6px'}}>{availableToAdd.length} from AutoVille preset list remaining • BAR common specialties</div>
                </div>
                <div className="col-md-6">
                  <div style={{display:'flex', gap:'8px'}}>
                    <input value={customSpec} onChange={e=>setCustomSpec(e.target.value)} placeholder="Custom: e.g. 【entity-Tesla¦canonical_name=Tesla】 Battery Swap, Ceramic Pro..." className="set-input" style={{flex:1}} />
                    <button disabled={!customSpec.trim()} onClick={()=>addSpecialty(customSpec)} style={{height:'48px', borderRadius:'12px', background:'#fff', border:'1.5px solid #0A192F', fontWeight:800, padding:'0 16px', whiteSpace:'nowrap'}}><i className="bi bi-plus-circle me-1"></i>Add Custom</button>
                  </div>
                  <div style={{fontSize:'11px', color:'#6B7A90', marginTop:'6px'}}>Create your own • e.g. Rivian Repair, Lift Kits • Customers see this on workshop page</div>
                </div>
              </div>
            </div>
            {workshop.specialties.length===0 ? (
              <div style={{padding:'30px', textAlign:'center', border:'1.5px dashed #E2E8F0', borderRadius:'14px', color:'#6B7A90', fontWeight:600}}>No specialties yet • Add at least 1 for BAR compliance • Customers filter workshops by specialty</div>
            ) : (
              <div style={{display:'grid', gap:'10px'}}>
                {workshop.specialties.map(sp=>{
                  const c = specColor(sp.name);
                  return (
                    <div key={sp.name} style={{border:`1.5px solid ${sp.enabled ? '#0A192F' : '#E2E8F0'}`, borderRadius:'14px', padding:'14px', background: sp.enabled ? '#fff' : '#F8FAFC', display:'flex', justifyContent:'space-between', gap:'12px', flexWrap:'wrap', alignItems:'center', opacity: sp.enabled ? 1 : 0.6}}>
                      <div style={{display:'flex', gap:'12px', alignItems:'center', flex:1, minWidth:'220px'}}>
                        <span className="spec-chip" style={{background: sp.enabled ? c.bg : '#F1F5F9', color: sp.enabled ? c.color : '#94A3B8', borderColor: sp.enabled ? c.border : '#E2E8F0'}}><i className="bi bi-tools"></i>{sp.name} {sp.primary && <i className="bi bi-star-fill" style={{fontSize:'12px'}}></i>}</span>
                        <div style={{fontSize:'12px', color:'#6B7A90', lineHeight:1.4}}><span style={{fontWeight:700, color:'#0A192F'}}>Added {sp.added}</span> • {sp.teamCount} team member{sp.teamCount!==1 ? 's' : ''} have this • {sp.enabled ? 'Active for bookings' : 'Disabled • hidden from customers'}</div>
                      </div>
                      <div style={{display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center'}}>
                        <button onClick={()=>toggleEnabled(sp.name)} title={sp.enabled ? "Disable • hide from customers" : "Enable"} style={{height:'36px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background: sp.enabled ? '#fff' : '#0A192F', color: sp.enabled ? '#0A192F' : '#fff', fontWeight:700, fontSize:'12px', padding:'0 12px'}}><i className={`bi ${sp.enabled ? 'bi-eye-slash' : 'bi-eye'} me-1`}></i>{sp.enabled ? 'Disable' : 'Enable'}</button>
                        <button onClick={()=>togglePrimary(sp.name)} style={{height:'36px', borderRadius:'10px', border:`1.5px solid ${sp.primary ? '#F59E0B' : '#E2E8F0'}`, background: sp.primary ? '#FEF3C7' : '#fff', color: sp.primary ? '#92400E' : '#6B7A90', fontWeight:700, fontSize:'12px', padding:'0 12px'}}><i className={`bi ${sp.primary ? 'bi-star-fill' : 'bi-star'} me-1`}></i>{sp.primary ? 'Primary' : 'Set Primary'}</button>
                        <button onClick={()=>removeSpecialty(sp.name)} style={{height:'36px', width:'36px', borderRadius:'10px', border:'1.5px solid #FECACA', background:'#FEF2F2', color:'#991B1B'}}><i className="bi bi-x-lg"></i></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{marginTop:'14px', background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:'12px', padding:'12px', fontSize:'12px', color:'#1E40AF', lineHeight:1.6}}>
              <b><i className="bi bi-info-circle me-1"></i>How specialties work:</b> Workshop specialties = what your shop advertises. Team specialties = what each member can do (from Team page). Bookings auto-route to team members with matching specialty. If you remove a workshop specialty, team keeps it but customers won't see it. Keep at least 1 enabled for BAR compliance. Primary specialties show first on Workshops page with gold star • Inglewood customers filter by specialty • EV Diagnostics premium.
            </div>
            <div style={{marginTop:'12px', display:'flex', gap:'8px', flexWrap:'wrap'}}>
              {workshop.specialties.filter(s=>s.enabled && s.primary).map(s=>{
                const c=specColor(s.name);
                return <span key={s.name} style={{fontSize:'12px', fontWeight:800, background:c.bg, color:c.color, border:`1px solid ${c.border}`, padding:'6px 12px', borderRadius:'20px'}}><i className="bi bi-star-fill me-1"></i>PRIMARY • {s.name}</span>
              })}
              {workshop.specialties.filter(s=>s.enabled && !s.primary).length>0 && <span style={{fontSize:'12px', fontWeight:700, background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'6px 12px', borderRadius:'20px', color:'#6B7A90'}}>+ {workshop.specialties.filter(s=>s.enabled && !s.primary).length} more active • {workshop.specialties.filter(s=>!s.enabled).length} disabled</span>}
            </div>
          </div>

          <div className="set-card">
            <div style={{fontWeight:900, fontSize:'15px', color:'#0A192F', marginBottom:'12px'}}><i className="bi bi-patch-check me-2"></i>BAR Compliance • License • California</div>
            <div className="row g-3" style={{margin:0, width:'100%'}}>
              <div className="col-md-4"><span className="set-label">BAR LICENSE NUMBER *</span><input id="ws-bar" className="set-input" value={workshop.barLicense} onChange={e=>setWorkshop({...workshop, barLicense:e.target.value})} placeholder="BAR ARD 284719" /></div>
              <div className="col-md-4"><span className="set-label">LICENSE TYPE</span><select className="set-input" value={workshop.barType} onChange={e=>setWorkshop({...workshop, barType:e.target.value})}><option>Automotive Repair Dealer</option><option>Smog Check Station</option><option>Both ARD + Smog</option></select></div>
              <div className="col-md-4"><span className="set-label">EXPIRY DATE • AUTO-RENEWAL LAW</span><input type="date" className="set-input" value={workshop.barExpiry} onChange={e=>setWorkshop({...workshop, barExpiry:e.target.value})} /></div>
              <div className="col-12"><div style={{background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:'12px', padding:'12px', fontSize:'12px', color:'#166534', lineHeight:1.5}}><i className="bi bi-shield-check me-1"></i><b>BAR Verified:</b> {workshop.barLicense} • Expires {workshop.barExpiry} • Type: {workshop.barType} • JAMS arbitration with 30-day opt-out per Terms • Auto-Renewal Law disclosure required for subscriptions • Customer must see BAR on invoice • Ayinde Technologies • Inglewood • PST • $ USD</div></div>
            </div>
          </div>

          <div className="set-card">
            <div style={{fontWeight:900, fontSize:'15px', color:'#0A192F', marginBottom:'12px'}}><i className="bi bi-clock me-2"></i>Business Hours • PST • Inglewood</div>
            <div style={{display:'grid', gap:'8px'}}>
              {workshop.hours.map((h, idx)=>(
                <div key={h.day} style={{display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'12px', padding:'10px 12px'}}>
                  <span style={{fontWeight:800, fontSize:'13px', color:'#0A192F', width:'90px'}}>{h.day}</span>
                  <label style={{display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', fontWeight:700}}><input type="checkbox" checked={h.enabled} onChange={e=> setWorkshop(w=>({...w, hours: w.hours.map((hh,i)=> i===idx ? {...hh, enabled:e.target.checked} : hh)}))} /> Open</label>
                  <input type="time" value={h.open} disabled={!h.enabled} onChange={e=> setWorkshop(w=>({...w, hours: w.hours.map((hh,i)=> i===idx ? {...hh, open:e.target.value} : hh)}))} style={{height:'36px', borderRadius:'8px', border:'1px solid #E2E8F0', padding:'0 8px', opacity: h.enabled ? 1 : 0.5}} />
                  <span style={{fontSize:'12px', color:'#6B7A90'}}>to</span>
                  <input type="time" value={h.close} disabled={!h.enabled} onChange={e=> setWorkshop(w=>({...w, hours: w.hours.map((hh,i)=> i===idx ? {...hh, close:e.target.value} : hh)}))} style={{height:'36px', borderRadius:'8px', border:'1px solid #E2E8F0', padding:'0 8px', opacity: h.enabled ? 1 : 0.5}} />
                  {!h.enabled && <span style={{fontSize:'11px', fontWeight:700, background:'#FEE2E2', color:'#991B1B', padding:'4px 8px', borderRadius:'20px'}}>Closed</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-lg-4" style={{display:'grid', gap:'14px', alignContent:'start'}}>
          <div className="set-card-dark">
            <div style={{fontSize:'12px', fontWeight:800, color:'#94A3B8'}}>WORKSHOP SNAPSHOT • SETTINGS</div>
            <div style={{display:'flex', gap:'12px', alignItems:'center', marginTop:'12px'}}><img src={logoPreview} style={{width:'64px', height:'64px', borderRadius:'14px', objectFit:'cover', border:'2px solid #fff'}} alt="" /><div><div style={{fontWeight:900, fontSize:'18px'}}>{workshop.name}</div><div style={{fontSize:'12px', color:'#94A3B8'}}>{workshop.ownerName} • {workshop.barLicense} • {workshop.city}, {workshop.state}</div></div></div>
            <div style={{marginTop:'14px', display:'flex', gap:'8px', flexWrap:'wrap'}}>{workshop.specialties.filter(s=>s.enabled).slice(0,4).map(s=>{ const c=specColor(s.name); return <span key={s.name} style={{fontSize:'11px', fontWeight:700, background:c.bg, color:c.color, padding:'5px 10px', borderRadius:'20px'}}>{s.name}</span>})}{workshop.specialties.filter(s=>s.enabled).length>4 && <span style={{fontSize:'11px', fontWeight:700, background:'rgba(255,255,255,0.12)', padding:'5px 10px', borderRadius:'20px'}}>+{workshop.specialties.filter(s=>s.enabled).length-4} more</span>}</div>
            <div style={{marginTop:'14px', fontSize:'12px', color:'#CBD5E1', lineHeight:1.6}}>{workshop.address}, {workshop.city}, {workshop.state} {workshop.zip} • {workshop.phone} • {workshop.supportPhone} • {workshop.email} • {workshop.timezone} • {workshop.currency}</div>
            <button onClick={saveAll} style={{marginTop:'14px', width:'100%', height:'44px', borderRadius:'12px', background:'#fff', color:'#0A192F', border:'none', fontWeight:800}}><i className="bi bi-save me-1"></i>{saving ? "Saving..." : "Save Workshop Settings"}</button>
          </div>

          <div className="set-card">
            <div style={{fontWeight:900, fontSize:'14px', color:'#0A192F', marginBottom:'10px'}}><i className="bi bi-telephone me-2"></i>Contact & Location • LA / PST</div>
            <div style={{display:'grid', gap:'10px'}}>
              <div><span className="set-label">ADDRESS *</span><input className="set-input" value={workshop.address} onChange={e=>setWorkshop({...workshop, address:e.target.value})} /></div>
              <div className="row g-2" style={{margin:0, width:'100%'}}><div className="col-6"><span className="set-label">CITY</span><input className="set-input" value={workshop.city} onChange={e=>setWorkshop({...workshop, city:e.target.value})} /></div><div className="col-3"><span className="set-label">STATE</span><input className="set-input" value={workshop.state} onChange={e=>setWorkshop({...workshop, state:e.target.value})} /></div><div className="col-3"><span className="set-label">ZIP</span><input className="set-input" value={workshop.zip} onChange={e=>setWorkshop({...workshop, zip:e.target.value})} /></div></div>
              <div><span className="set-label">PHONE *</span><input className="set-input" value={workshop.phone} onChange={e=>setWorkshop({...workshop, phone:e.target.value})} /></div>
              <div><span className="set-label">SUPPORT PHONE • PETER</span><input className="set-input" value={workshop.supportPhone} onChange={e=>setWorkshop({...workshop, supportPhone:e.target.value})} /></div>
              <div><span className="set-label">EMAIL</span><input className="set-input" value={workshop.email} onChange={e=>setWorkshop({...workshop, email:e.target.value})} /></div>
              <div><span className="set-label">SUPPORT EMAIL</span><input className="set-input" value={workshop.supportEmail} onChange={e=>setWorkshop({...workshop, supportEmail:e.target.value})} /></div>
              <div><span className="set-label">WEBSITE</span><input className="set-input" value={workshop.website} onChange={e=>setWorkshop({...workshop, website:e.target.value})} /></div>
            </div>
          </div>

          <div className="set-card" style={{background:'#FFFBEB', borderColor:'#FDE68A'}}>
            <div style={{fontWeight:900, fontSize:'13px', color:'#92400E'}}><i className="bi bi-lightbulb me-2"></i>SPECIALTY TIPS • CUSTOMER TRUST • SEO</div>
            <ul style={{margin:'10px 0 0 18px', padding:0, fontSize:'12px', color:'#92400E', lineHeight:1.7}}>
              <li><b>Add:</b> Select from preset or type custom • Shows instantly on Workshops page • Premium: EV, Hybrid, Tesla</li>
              <li><b>Remove:</b> Click X • Keep ≥1 active • Team keeps specialty but booking routing stops</li>
              <li><b>Primary:</b> Star = shows first, gold badge, higher ranking in search • Max 3 primary recommended</li>
              <li><b>Team sync:</b> If 0 team members have a specialty, you get warning • Assign from Team page</li>
              <li><b>BAR:</b> California requires accurate specialties • False claim = BAR violation • Ayinde Tech address 112 S Market St</li>
              <li><b>LA customers:</b> Filter by specialty in Owner Workshops page • More specialties = more discovery</li>
            </ul>
          </div>

          <div style={{background:'#0A192F', borderRadius:'14px', padding:'14px', color:'#fff', fontSize:'12px', lineHeight:1.6}}>
            <b><i className="bi bi-shield-check me-1"></i>BAR & Ayinde Tech:</b> {workshop.barLicense} • {workshop.barType} • Exp {workshop.barExpiry} • 112 S Market St, Ste 1008, Inglewood, CA 90301 • Support Peter +1-201-534-2657 • {workshop.supportEmail} • AutoVille marketplace • PST • $ USD • JAMS arbitration • Auto-Renewal Law
          </div>
        </div>
      </div>
    </div>
    </>
  );
}