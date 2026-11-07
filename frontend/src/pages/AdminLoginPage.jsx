import { useState } from "react";

export default function AdminLoginPage({ changeView }) {
  const [form, setForm] = useState({ username:"", password:"", pin:"" });
  const [showPass, setShowPass] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e)=>{
    e.preventDefault();
    if(!form.username || !form.password || !form.pin){ setErr("All fields required"); return; }
    if(form.pin.length < 4){ setErr("PIN must be 4-6 digits"); return; }
    setErr("");
    setLoading(true);
    try{
      const res = await fetch("http://127.0.0.1:5000/api/auth/login/admin",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({username: form.username.trim(), password: form.password, pin: form.pin})
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok){
        setErr(data.error || "Invalid login. Check username, password and PIN.");
        setLoading(false);
        return;
      }
      // SUCCESS - real admin from DB, not any values
      localStorage.setItem("autoville_admin", JSON.stringify({ id: data.id, username: data.username, name: data.full_name || data.name, email: data.email, role: data.role || "super_admin", avatar: data.avatar, loginAt: new Date().toISOString() }));
      localStorage.setItem("autoville_user", JSON.stringify({ name: data.full_name || data.name, email: data.email, role:"super_admin", avatar: data.avatar }));
      localStorage.setItem("admin_profile", JSON.stringify({ fullName: data.full_name || data.name, email: data.email, phone: data.phone || "", role: data.role || "Super Admin", avatar: data.avatar || "" }));
      setLoading(false);
      if(changeView) changeView("admin-dashboard");
      else { window.history.pushState({}, "", "/console/dashboard"); window.location.reload(); }
    }catch(err2){
      setErr("Cannot reach server. Is backend running on http://127.0.0.1:5000 ?");
      setLoading(false);
    }
  };

  return (
    <>
    <style>{`
      .admin-login-bg{ min-height:100vh; background:radial-gradient(900px 500px at 50% -10%, #1E3A5F 0%, #0A192F 55%, #070F1F 100%); display:flex; align-items:center; justify-content:center; padding:16px; }
      .admin-card-simple{ width:100%; max-width:420px; background:#fff; border-radius:18px; border:1px solid #E2E8F0; box-shadow:0 20px 50px rgba(0,0,0,0.25); padding:28px 24px 22px; }
      .admin-brand{ display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:18px; }
      .admin-brand img{ width:42px; height:42px; border-radius:11px; background:#fff; padding:6px; border:1px solid #E2E8F0; object-fit:contain; }
      .admin-title{ text-align:center; margin-bottom:20px; }
      .admin-title h1{ font-weight:900; font-size:22px; color:#0A192F; margin:0; letter-spacing:-0.3px; }
      .admin-title p{ font-size:12px; color:#64748B; font-weight:600; margin-top:6px; }
      .admin-form{ display:grid; gap:14px; }
      .admin-field-group{ display:grid; gap:6px; }
      .admin-field-label{ font-size:12px; font-weight:700; color:#0A192F; padding-left:2px; }
      .admin-input-wrap{ position:relative; width:100%; }
      .admin-input-wrap .left-icon{ position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#94A3B8; font-size:16px; pointer-events:none; }
      .admin-input{ width:100%; height:46px; border-radius:11px; border:1.5px solid #CBD5E1; background:#F8FAFC; padding:0 44px 0 38px; font-weight:600; font-size:13px; color:#0A192F; outline:none; transition:0.18s; box-sizing:border-box; }
      .admin-input:focus{ border-color:#0A192F; background:#fff; box-shadow:0 0 0 3px rgba(10,25,47,0.08); }
      .eye-btn{ position:absolute; right:6px; top:50%; transform:translateY(-50%); width:34px; height:34px; border:none; background:transparent; border-radius:8px; display:grid; place-items:center; color:#64748B; cursor:pointer; }
      .eye-btn:hover{ background:#F1F5F9; color:#0A192F; }
      .admin-error{ background:#FEF2F2; border:1px solid #FECACA; color:#991B1B; border-radius:10px; padding:9px 11px; font-size:12px; font-weight:700; }
      .admin-submit{ height:46px; border-radius:11px; background:#0A192F; color:#fff; border:none; font-weight:800; font-size:13px; letter-spacing:0.2px; }
      .admin-submit:disabled{ opacity:0.7; }
      .admin-foot{ margin-top:14px; display:flex; justify-content:space-between; font-size:11px; color:#94A3B8; font-weight:600; }
      .admin-home{ height:36px; border-radius:9px; border:1px solid #E2E8F0; background:#fff; font-weight:700; font-size:12px; padding:0 12px; }
      @media(max-width:480px){
        .admin-card-simple{ padding:22px 16px 18px; border-radius:16px; max-width:100%; }
        .admin-login-bg{ padding:12px; align-items:flex-start; padding-top:28px; }
        .admin-title h1{ font-size:20px; }
      }
    `}</style>

    <div className="admin-login-bg">
      <div className="admin-card-simple">
        <div style={{display:"flex", justifyContent:"flex-end", marginBottom:"4px"}}>
          <button className="admin-home" onClick={()=> changeView ? changeView("landing") : window.history.pushState({}, "", "/")}><i className="bi bi-arrow-left me-1"></i>Home</button>
        </div>

        <div className="admin-brand">
          <img src="/img/logo-trans.png" alt="AutoVille" onError={e=>e.currentTarget.src="img/logo-trans.png"} />
          <div style={{textAlign:"left"}}>
            <div style={{fontWeight:900, fontSize:"16px", color:"#0A192F", lineHeight:1}}>AutoVille</div>
            <div style={{fontSize:"10px", color:"#94A3B8", fontWeight:700}}>Ayinde Technologies</div>
          </div>
        </div>

        <div className="admin-title">
          <h1>Console Login</h1>
          <p>Super Admin • Username + Password + PIN (2FA) • Validated by DB</p>
        </div>

        <form className="admin-form" onSubmit={handleSubmit}>
          {err && <div className="admin-error"><i className="bi bi-exclamation-triangle me-1"></i>{err}</div>}

          <div className="admin-field-group">
            <span className="admin-field-label">Username</span>
            <div className="admin-input-wrap">
              <i className="bi bi-person-badge left-icon"></i>
              <input className="admin-input" value={form.username} onChange={e=>setForm({...form, username:e.target.value})} placeholder="admin / Ayinde Admin / admin@autoville.la" />
            </div>
          </div>

          <div className="admin-field-group">
            <span className="admin-field-label">Password</span>
            <div className="admin-input-wrap">
              <i className="bi bi-key left-icon"></i>
              <input className="admin-input" type={showPass ? "text" : "password"} value={form.password} onChange={e=>setForm({...form, password:e.target.value})} placeholder="Password • default admin123" />
              <button type="button" className="eye-btn" onClick={()=>setShowPass(!showPass)}><i className={`bi ${showPass ? "bi-eye-slash" : "bi-eye"}`}></i></button>
            </div>
          </div>

          <div className="admin-field-group">
            <span className="admin-field-label">Login PIN • 2FA</span>
            <div className="admin-input-wrap">
              <i className="bi bi-shield-lock left-icon"></i>
              <input className="admin-input" type={showPin ? "text" : "password"} inputMode="numeric" maxLength={6} value={form.pin} onChange={e=>setForm({...form, pin:e.target.value.replace(/[^0-9]/g,"")})} placeholder="4-6 digit PIN • default 1234" />
              <button type="button" className="eye-btn" onClick={()=>setShowPin(!showPin)}><i className={`bi ${showPin ? "bi-eye-slash" : "bi-eye"}`}></i></button>
            </div>
          </div>

          <button disabled={loading} type="submit" className="admin-submit">
            {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Verifying...</> : <><i className="bi bi-box-arrow-in-right me-2"></i>Login to Dashboard</>}
          </button>

          <div className="admin-foot">
            <span>PST • BAR • $ USD</span>
            <span style={{color:"#64748B"}}>Validated • Audit logged</span>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}