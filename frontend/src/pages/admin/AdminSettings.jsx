import { useState, useEffect } from "react";
import Swal from "sweetalert2";

const API = "http://127.0.0.1:5000/api/admin";

export default function AdminSettings(){
  const [profile, setProfile] = useState({
    fullName:"Ayinde Admin", email:"admin@autoville.la", phone:"+1-310-555-0199",
    role:"Super Admin", avatar:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    bar:"BAR 142 • Inglewood CA 90301", address:"112 S Market St Ste 1008 Inglewood CA 90301",
    lastLogin:"—", ip:"—",
  });

  const [formName,setFormName]=useState("Ayinde Admin");
  const [formEmail,setFormEmail]=useState("admin@autoville.la");
  const [formPhone,setFormPhone]=useState("+1-310-555-0199");
  const [avatarPreview,setAvatarPreview]=useState(profile.avatar);
  const [loading,setLoading]=useState(true);

  const [currentPass,setCurrentPass]=useState("");
  const [newPass,setNewPass]=useState("");
  const [confirmPass,setConfirmPass]=useState("");
  const [showPass,setShowPass]=useState(false);

  const [currentPin,setCurrentPin]=useState("");
  const [newPin,setNewPin]=useState("");
  const [confirmPin,setConfirmPin]=useState("");
  const [showPin,setShowPin]=useState(false);
  const [saving,setSaving]=useState(false);

  // REAL DATA - load from DB on mount, not localStorage
  useEffect(()=>{
    fetch(`${API}/profile`)
      .then(r=>r.json())
      .then(d=>{
        if(d && d.full_name){
          const p = {
            fullName: d.full_name,
            email: d.email,
            phone: d.phone || "+1-310-555-0199",
            role: d.role || "Super Admin",
            avatar: d.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
            bar:"BAR 142 • Inglewood CA 90301",
            address:"112 S Market St Ste 1008 Inglewood CA 90301",
            lastLogin: d.last_login ? String(d.last_login).split("T")[0] + " " + String(d.last_login).split("T")[1]?.split(".")[0] + " PST" : "—",
            ip: d.ip || "—",
          };
          setProfile(p); setFormName(p.fullName); setFormEmail(p.email); setFormPhone(p.phone); setAvatarPreview(p.avatar);
          localStorage.setItem("admin_profile", JSON.stringify(p));
          localStorage.setItem("admin_user", JSON.stringify({name:p.fullName, email:p.email, avatar:p.avatar}));
        }
        setLoading(false);
      })
      .catch(()=> setLoading(false));
  },[]);

  function handleAvatar(e){
    var file = e.target.files[0];
    if(!file) return;
    if(file.size > 3*1024*1024){ Swal.fire("Too large","Max 3MB","warning"); return; }
    var reader = new FileReader();
    reader.onload = (ev)=> setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function saveProfile(){
    if(!formName.trim()){ Swal.fire("Required","Full name required","warning"); return; }
    if(!formEmail.includes("@")){ Swal.fire("Invalid","Valid email required","warning"); return; }
    setSaving(true);
    try{
      const res = await fetch(`${API}/profile`,{
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({fullName:formName.trim(), email:formEmail.trim(), phone:formPhone.trim(), avatar:avatarPreview})
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || "Failed");
      const updated = {...profile, fullName:formName.trim(), email:formEmail.trim(), phone:formPhone.trim(), avatar:avatarPreview};
      setProfile(updated);
      localStorage.setItem("admin_profile", JSON.stringify(updated));
      localStorage.setItem("admin_user", JSON.stringify({name:updated.fullName, email:updated.email, avatar:updated.avatar}));
      Swal.fire({ icon:"success", title:"Profile Updated", text:`${updated.fullName} • ${updated.email} • 112 S Market St Inglewood CA 90301 PST • Saved to DB`, confirmButtonColor:"#0A192F" });
    }catch(err){ Swal.fire("Error", err.message, "error"); }
    setSaving(false);
  }

  async function savePassword(){
    if(!currentPass || !newPass || !confirmPass){ Swal.fire("Required","Fill all password fields","warning"); return; }
    if(newPass.length < 8){ Swal.fire("Weak","Min 8 characters","warning"); return; }
    if(newPass !== confirmPass){ Swal.fire("Mismatch","New passwords don't match","error"); return; }
    try{
      const res = await fetch(`${API}/password`,{
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({current_password: currentPass, new_password: newPass})
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || "Failed");
      setCurrentPass(""); setNewPass(""); setConfirmPass("");
      Swal.fire({ icon:"success", title:"Password Changed", text:"Password updated in DB • Immutable audit log • PST • Next login use new password", confirmButtonColor:"#0A192F" });
    }catch(err){ Swal.fire("Incorrect", err.message + " • Hint: default admin123", "error"); }
  }

  async function savePin(){
    if(!currentPin || !newPin || !confirmPin){ Swal.fire("Required","Fill all PIN fields","warning"); return; }
    if(!/^\d{4}$/.test(newPin)){ Swal.fire("Invalid PIN","PIN must be 4 digits","warning"); return; }
    if(newPin !== confirmPin){ Swal.fire("Mismatch","New PINs don't match","error"); return; }
    try{
      const res = await fetch(`${API}/pin`,{
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({current_pin: currentPin, new_pin: newPin})
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || "Failed");
      setCurrentPin(""); setNewPin(""); setConfirmPin("");
      Swal.fire({ icon:"success", title:"PIN Updated", text:`New PIN set in DB • Console security • Audit logged • 112 S Market St`, confirmButtonColor:"#0A192F" });
    }catch(err){ Swal.fire("Incorrect", err.message + " • Default 1234", "error"); }
  }

  function resetAvatar(){
    setAvatarPreview("https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80");
  }

  if(loading) return <div style={{padding:20, textAlign:"center", color:"#94A3B8"}}>Loading admin profile from DB...</div>;

  return (
    <div style={{display:"grid", gap:"16px", fontSize:"15px"}}>
      <style>{`
        .owner-card{ background:#fff; border:1.5px solid #E2E8F0; border-radius:18px; padding:20px; }
        .field{ height:46px; width:100%; border-radius:12px; border:1.5px solid #E2E8F0; background:#F8FAFC; padding:0 14px; font-size:14px; font-weight:600; }
        .field:focus{ outline:none; border-color:#0A192F; background:#fff; }
        .label{ font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; margin-bottom:6px; display:block; }
        .section-title{ font-weight:900; font-size:16px; color:#0A192F; margin-bottom:14px; display:flex; align-items:center; gap:8px; }
      `}</style>

      <div className="row g-3" style={{margin:0, width:"100%"}}>
        <div className="col-12 col-lg-4">
          <div className="owner-card" style={{textAlign:"center", padding:"28px 20px"}}>
            <div style={{position:"relative", display:"inline-block"}}>
              <img src={avatarPreview} alt="Admin" style={{width:"110px", height:"110px", borderRadius:"24px", objectFit:"cover", border:"3px solid #0A192F"}} />
              <label htmlFor="avatarUp" style={{position:"absolute", bottom:"-6px", right:"-6px", width:"34px", height:"34px", borderRadius:"10px", background:"#0A192F", color:"#fff", display:"grid", placeItems:"center", cursor:"pointer", border:"2px solid #fff"}}><i className="bi bi-camera"></i></label>
              <input id="avatarUp" type="file" accept="image/*" onChange={handleAvatar} style={{display:"none"}} />
            </div>
            <div style={{marginTop:"14px"}}>
              <div style={{fontWeight:900, fontSize:"18px", color:"#0A192F"}}>{formName}</div>
              <div style={{fontSize:"13px", color:"#64748B", fontWeight:600}}>{profile.role} • {profile.bar}</div>
              <div style={{fontSize:"12px", color:"#94A3B8", marginTop:"4px"}}>{formEmail}</div>
              <div style={{fontSize:"11px", color:"#94A3B8"}}>{profile.address}</div>
            </div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginTop:"16px"}}>
              <button onClick={resetAvatar} style={{height:"40px", borderRadius:"12px", border:"1.5px solid #E2E8F0", background:"#fff", fontWeight:800, fontSize:"13px"}}>Reset Image</button>
              <label htmlFor="avatarUp" style={{height:"40px", borderRadius:"12px", background:"#0A192F", color:"#fff", display:"grid", placeItems:"center", fontWeight:800, fontSize:"13px", cursor:"pointer"}}>Change Image</label>
            </div>
            <div style={{marginTop:"16px", background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"12px", padding:"12px", textAlign:"left"}}>
              <div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>LAST LOGIN • IP • REAL DB</div>
              <div style={{fontSize:"12px", fontWeight:700}}>{profile.lastLogin}</div>
              <div style={{fontSize:"11px", color:"#64748B"}}>{profile.ip} • {profile.address}</div>
              <div style={{fontSize:"11px", color:"#16A34A", fontWeight:700, marginTop:"4px"}}>• Active • Audit immutable • PST</div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-8">
          <div style={{display:"grid", gap:"16px"}}>
            <div className="owner-card">
              <div className="section-title"><i className="bi bi-person"></i> Profile • Full Name & Contact • DB</div>
              <div className="row g-3" style={{margin:0, width:"100%"}}>
                <div className="col-12"><label className="label">Full Name *</label><input className="field" value={formName} onChange={e=>setFormName(e.target.value)} placeholder="Ayinde Admin" /></div>
                <div className="col-12 col-md-6"><label className="label">Email Address *</label><input className="field" value={formEmail} onChange={e=>setFormEmail(e.target.value)} placeholder="admin@autoville.la" /></div>
                <div className="col-12 col-md-6"><label className="label">Phone Number</label><input className="field" value={formPhone} onChange={e=>setFormPhone(e.target.value)} placeholder="+1-310-555-0199" /></div>
                <div className="col-12"><div style={{background:"#EFF6FF", border:"1.5px solid #DBEAFE", borderRadius:"12px", padding:"12px", display:"flex", gap:"8px"}}><i className="bi bi-info-circle" style={{color:"#1E40AF"}}></i><div style={{fontSize:"12px", color:"#1E40AF", fontWeight:600}}>Profile changes are audit logged • Saved to admin_users table • BAR compliance • 112 S Market St Ste 1008 Inglewood CA 90301 • PST</div></div></div>
                <div className="col-12"><button onClick={saveProfile} disabled={saving} style={{height:"46px", borderRadius:"12px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, padding:"0 22px", width:"100%"}}>{saving ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="bi bi-check-lg me-2"></i>} Save Profile • {formName}</button></div>
              </div>
            </div>

            <div className="owner-card">
              <div className="section-title"><i className="bi bi-shield-lock"></i> Password • Security • 8+ chars • DB</div>
              <div className="row g-3" style={{margin:0, width:"100%"}}>
                <div className="col-12"><label className="label">Current Password *</label><div style={{position:"relative"}}><input type={showPass?"text":"password"} className="field" value={currentPass} onChange={e=>setCurrentPass(e.target.value)} placeholder="Enter current • default admin123" style={{paddingRight:"44px"}} /><button type="button" onClick={()=>setShowPass(!showPass)} style={{position:"absolute", right:"6px", top:"50%", transform:"translateY(-50%)", width:"34px", height:"34px", borderRadius:"10px", border:"1.5px solid #E2E8F0", background:"#fff"}}><i className={`bi ${showPass?"bi-eye-slash":"bi-eye"}`}></i></button></div></div>
                <div className="col-12 col-md-6"><label className="label">New Password *</label><input type={showPass?"text":"password"} className="field" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="Min 8 characters" /></div>
                <div className="col-12 col-md-6"><label className="label">Confirm New Password *</label><input type={showPass?"text":"password"} className="field" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} placeholder="Re-enter new password" /></div>
                <div className="col-12"><div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", borderRadius:"12px", padding:"12px", display:"flex", gap:"8px"}}><i className="bi bi-exclamation-triangle" style={{color:"#DC2626"}}></i><div style={{fontSize:"12px", color:"#7F1D1D", fontWeight:600}}>Password changes are immutable audit • Verified against DB • Next login via /console/login or /admin-login • PST</div></div></div>
                <div className="col-12"><button onClick={savePassword} style={{height:"46px", borderRadius:"12px", background:"#fff", color:"#0A192F", border:"1.5px solid #0A192F", fontWeight:800, padding:"0 22px", width:"100%"}}><i className="bi bi-key me-2"></i> Update Password</button></div>
              </div>
            </div>

            <div className="owner-card">
              <div className="section-title"><i className="bi bi-123"></i> Console PIN • 4 Digits • Extra Security • DB</div>
              <div className="row g-3" style={{margin:0, width:"100%"}}>
                <div className="col-12 col-md-4"><label className="label">Current PIN *</label><div style={{position:"relative"}}><input type={showPin?"text":"password"} className="field" value={currentPin} onChange={e=>setCurrentPin(e.target.value)} placeholder="1234 default" style={{paddingRight:"44px", letterSpacing:"4px", fontWeight:900}} /><button type="button" onClick={()=>setShowPin(!showPin)} style={{position:"absolute", right:"6px", top:"50%", transform:"translateY(-50%)", width:"34px", height:"34px", borderRadius:"10px", border:"1.5px solid #E2E8F0", background:"#fff"}}><i className={`bi ${showPin?"bi-eye-slash":"bi-eye"}`}></i></button></div></div>
                <div className="col-12 col-md-4"><label className="label">New PIN * (4 digits)</label><input type={showPin?"text":"password"} className="field" value={newPin} onChange={e=>setNewPin(e.target.value)} placeholder="0000" maxLength={4} style={{letterSpacing:"6px", fontWeight:900, textAlign:"center"}} /></div>
                <div className="col-12 col-md-4"><label className="label">Confirm New PIN *</label><input type={showPin?"text":"password"} className="field" value={confirmPin} onChange={e=>setConfirmPin(e.target.value)} placeholder="0000" maxLength={4} style={{letterSpacing:"6px", fontWeight:900, textAlign:"center"}} /></div>
                <div className="col-12"><div style={{background:"#FFF7ED", border:"1.5px solid #FED7AA", borderRadius:"12px", padding:"12px", display:"flex", gap:"8px"}}><i className="bi bi-shield-check" style={{color:"#9A3412"}}></i><div style={{fontSize:"12px", color:"#9A3412", fontWeight:600}}>PIN used for sensitive actions: approving workshops BAR 142, hiding reviews, changing subscription plans $40/$100/$300. Verified against DB. Audit logged • Immutable.</div></div></div>
                <div className="col-12"><button onClick={savePin} style={{height:"46px", borderRadius:"12px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, padding:"0 22px", width:"100%"}}><i className="bi bi-lock me-2"></i> Update PIN • 4 Digits • Secure</button></div>
              </div>
            </div>

            <div className="owner-card" style={{background:"#F8FAFC"}}>
              <div style={{display:"flex", gap:"10px", alignItems:"center"}}><i className="bi bi-journal-text" style={{fontSize:"20px", color:"#0A192F"}}></i><div><div style={{fontWeight:900, fontSize:"14px"}}>Audit & Compliance</div><div style={{fontSize:"12px", color:"#64748B"}}>All profile, password, PIN changes are logged in Activity Logs • Immutable • No delete • 112 S Market St Ste 1008 Inglewood CA 90301 • BAR • PST • Zero commission platform</div></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}