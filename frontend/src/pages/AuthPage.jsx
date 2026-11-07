import { useState } from "react";
import Swal from "sweetalert2";

const API = "http://127.0.0.1:5000/api";

export default function AuthPage({ changeView, authRole, setAuthRole, setUser }) {
  const [localRole, setLocalRole] = useState(authRole || "owner");
  const [mode, setMode] = useState("login");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  // SINGLE email + phone for both roles - this was the bug
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState(""); // WhatsApp - register only
  const [businessName, setBusinessName] = useState("");
  const [shopAddress, setShopAddress] = useState("");

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);

  function saveSession(userObj){
    const payload = { ...userObj, role: userObj.role || (localRole === "workshop" ? "mechanic" : "owner"), rawRole: localRole, email: userObj.email || email.trim().toLowerCase() };
    localStorage.setItem("autoville_user", JSON.stringify(payload));
    if (remember) localStorage.setItem("autoville_remember", "1");
    else sessionStorage.setItem("autoville_user", JSON.stringify(payload));
    if (setUser) setUser(payload);
    return payload;
  }

  function goToDashboard(){
    if (localRole === "workshop") changeView("mechanic-dashboard");
    else changeView("car-owner/dashboard");
  }

  function goTerms(e){
    if(e) e.preventDefault();
    if(changeView) changeView("terms");
    else window.location.href = "/terms";
  }
  function goPrivacy(e){
    if(e) e.preventDefault();
    if(changeView) changeView("privacy");
    else window.location.href = "/privacy";
  }

  function switchRole(role){
    setLocalRole(role);
    if(setAuthRole) setAuthRole(role);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(e){
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (mode === "login" && !cleanEmail.includes("@")) {
      Swal.fire({ icon: 'warning', title: 'Valid email required', text: 'Login with the email address you used when registering.', confirmButtonColor: '#0A192F' });
      return;
    }
    if (mode === "register" && !agreed) {
      Swal.fire({ icon: 'warning', title: 'Accept Terms', text: 'Please turn ON the toggle to accept Terms & Privacy Policy before creating your account.', confirmButtonColor: '#0A192F' });
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      Swal.fire({ icon: 'error', title: 'Passwords do not match', confirmButtonColor: '#0A192F' });
      return;
    }
    if (mode === "register" && password.length < 6) {
      Swal.fire({ icon: 'error', title: 'Password too short', text: 'Password must be at least 6 characters.', confirmButtonColor: '#0A192F' });
      return;
    }
    setLoading(true);
    try {
      let url = "", body = {};
      if (mode === "login") {
        // EMAIL + PASSWORD ONLY - same for owner and workshop
        url = localRole === "workshop" ? `${API}/auth/login/workshop` : `${API}/auth/login/owner`;
        body = { email: cleanEmail, password };
      } else {
        if (localRole === "owner") {
          url = `${API}/auth/register/owner`;
          body = { full_name: fullName.trim(), email: cleanEmail, phone: phone.trim(), password };
        } else {
          url = `${API}/auth/register/workshop`;
          body = { business_name: businessName.trim(), email: cleanEmail, phone: phone.trim(), address: shopAddress.trim(), shop_address: shopAddress.trim(), password };
        }
      }
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(()=>({}));
      if (!res.ok || !data.success) throw new Error(data.error || data.message || "Something went wrong. Try again.");
      const userObj = saveSession(data.user || {});
      await Swal.fire({
        icon: "success",
        title: mode === "login" ? `Welcome back!` : "Account created!",
        html: mode === "login" ? `Logged in as <b>${userObj.business_name || userObj.full_name || userObj.email}</b>` : localRole === "workshop" ? `Workshop <b>${userObj.business_name}</b> created.<br/>Your <b>7-day Free Trial</b> is active.` : `Welcome to AutoVille, <b>${userObj.full_name}</b>!`,
        confirmButtonColor: "#0A192F"
      });
      goToDashboard();
    } catch (err) {
      const isNetwork = err.message === "Failed to fetch" || err.name === "TypeError";
      Swal.fire({
        icon: "error",
        title: mode === "login" ? "Login failed" : "Registration failed",
        html: isNetwork
          ? `Backend not reachable.<br/>Is <b>py app.py</b> running on <b>http://127.0.0.1:5000</b>?`
          : err.message,
        confirmButtonColor: "#0A192F"
      });
    } finally { setLoading(false); }
  }

  async function handleForgotSubmit(e){
    e.preventDefault();
    if(!forgotEmail || !forgotEmail.includes("@")){
      Swal.fire({ icon:"warning", title:"Valid email required", text:"Enter the email address you used when registering.", confirmButtonColor:"#0A192F" });
      return;
    }
    setForgotSending(true);
    try{ await fetch(API + "/auth/forgot-password",{ method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ email: forgotEmail.trim().toLowerCase(), role: localRole }) }); }catch(err){}
    setForgotSending(false); setShowForgot(false);
    Swal.fire({ icon:"success", title:"Reset link sent", html:`If <b>${forgotEmail}</b> is registered as <b>${localRole === "workshop" ? "Workshop" : "Vehicle Owner"}</b>, a reset link has been sent.<br/>Check inbox + spam. Link expires in 30 minutes.`, confirmButtonColor:"#0A192F" });
    setForgotEmail("");
  }
  function openForgot(){ setForgotEmail(email || ""); setShowForgot(true); }
  function socialSoon(provider){ Swal.fire({ icon:"info", title:`${provider} login coming soon`, text:"Use Email login for now.", confirmButtonColor:"#0A192F" }); }

  return (
    <>
      <style>{`
          .auth-wrap{ min-height:100vh; background:#EEF2F7; display:flex; align-items:center; justify-content:center; padding:20px; font-family:'Inter', system-ui, sans-serif; }
          .auth-box{ width:100%; max-width:1120px; background:#fff; border:2px solid #0A192F; border-radius:28px; display:grid; grid-template-columns:1fr 1fr; overflow:hidden; min-height:760px; box-shadow:0 30px 80px rgba(10,25,47,0.12); }
          @media(max-width: 991px){ .auth-box{ grid-template-columns:1fr; } .auth-img{ display:none !important; } .auth-form{ padding:24px 20px !important; } }
          .auth-form{ padding:28px 32px; background:#fff; }
          .auth-img{ position:relative; background:url(https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=1200&q=80) center/cover; padding:28px; display:flex; flex-direction:column; justify-content:space-between; }
          .auth-overlay{ position:absolute; inset:0; background:linear-gradient(to top, rgba(10,25,47,0.95), rgba(10,25,47,0.25) 55%, rgba(10,25,47,0.15)); }
          .a-logo{ height:32px; cursor:pointer; }
          .back-home{ display:inline-flex; align-items:center; gap:6px; background:#F1F5F9; border:1.5px solid #CBD5E1; border-radius:20px; padding:6px 12px; font-size:12px; font-weight:800; color:#0A192F; cursor:pointer; margin-bottom:14px; }
          .back-home:hover{ background:#0A192F; color:#fff; border-color:#0A192F; }
          .a-role{ display:flex; background:#E8EEF5; border-radius:14px; padding:4px; gap:4px; margin:16px 0 18px; border:1px solid #D0DAE8; }
          .a-role button{ flex:1; border:none; padding:11px; border-radius:10px; font-weight:800; font-size:13px; background:transparent; color:#5B6B82; display:flex; gap:6px; justify-content:center; align-items:center; }
          .a-role button.on{ background:#0A192F; color:#fff; }
          .a-tabs{ display:flex; gap:24px; border-bottom:2px solid #D0DAE8; margin-bottom:20px; }
          .a-tabs button{ background:none; border:none; padding:0 0 12px; font-weight:800; font-size:15px; color:#8A9BB0; border-bottom:3px solid transparent; margin-bottom:-2px; }
          .a-tabs button.on{ color:#0A192F; border-color:#0A192F; }
          .a-social{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; }
          .social-btn{ height:52px; border-radius:12px; font-weight:900; font-size:14px; display:flex; align-items:center; justify-content:center; gap:8px; border:none; cursor:pointer; transition:0.2s; box-shadow:0 4px 12px rgba(0,0,0,0.08); }
          .social-btn:hover{ transform:translateY(-2px); box-shadow:0 8px 20px rgba(0,0,0,0.18); }
          .gmail-btn{ background:#DB4437; color:#fff; }
          .fb-btn{ background:#1877F2; color:#fff; }
          .a-div{ display:flex; align-items:center; gap:10px; color:#6B7A90; font-size:11px; font-weight:800; letter-spacing:0.08em; margin:14px 0; }
          .a-div::before,.a-div::after{ content:""; flex:1; height:1px; background:#CBD5E1; }
          .f-group{ position:relative; margin-bottom:13px; }
          .f-group.has-icon input{ padding-left:44px; }
          .f-group .left-icon{ position:absolute; left:14px; top:50%; transform:translateY(-50%); color:#6B7A90; font-size:18px; z-index:1; }
          .f-group input{ width:100%; height:56px; border:1.8px solid #B8C4D4; border-radius:12px; padding:20px 44px 6px 14px; font-size:15px; font-weight:600; outline:none; background:#FCFDFF; color:#0A192F; }
          .f-group input:focus{ border-color:#0A192F; background:#fff; box-shadow:0 0 0 4px rgba(10,25,47,0.08); }
          .f-group label{ position:absolute; left:12px; top:50%; transform:translateY(-50%); background:#fff; padding:0 6px; color:#5B6B82; font-size:14px; font-weight:600; pointer-events:none; transition:0.2s; border-radius:4px; }
          .f-group.has-icon label{ left:36px; }
          .f-group input:focus + label, .f-group input:not(:placeholder-shown) + label{ top:-7px; font-size:10.5px; font-weight:800; color:#0A192F; text-transform:uppercase; }
          .eye{ position:absolute; right:8px; top:50%; transform:translateY(-50%); border:none; background:#F1F5F9; width:36px; height:36px; display:grid; place-items:center; color:#0A192F; border-radius:8px; }
          .forgot-link{ background:none; border:none; color:#1E40AF; font-weight:800; font-size:12px; padding:0; cursor:pointer; }
          .forgot-link:hover{ text-decoration:underline; }
          .terms-row{ display:flex; gap:12px; align-items:flex-start; margin:2px 0 14px; background:#F8FAFC; border:1.5px solid #E2E8F0; border-radius:14px; padding:12px; }
          .switch{ position:relative; display:inline-block; width:48px; height:26px; flex-shrink:0; margin-top:2px; cursor:pointer; }
          .switch input{ opacity:0; width:0; height:0; }
          .slider{ position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background:#CBD5E1; transition:0.25s; border-radius:34px; border:1.5px solid #94A3B8; }
          .slider:before{ position:absolute; content:""; height:20px; width:20px; left:2px; bottom:2px; background:#fff; transition:0.25s; border-radius:50%; box-shadow:0 2px 6px rgba(0,0,0,0.25); }
          .switch input:checked + .slider{ background:#0A192F; border-color:#0A192F; }
          .switch input:checked + .slider:before{ transform:translateX(22px); }
          .switch input:focus + .slider{ box-shadow:0 0 0 4px rgba(10,25,47,0.12); }
          .terms-text{ font-size:12px; font-weight:600; color:#475569; line-height:1.5; }
          .terms-text button{ background:none; border:none; padding:0; color:#1E40AF; font-weight:800; font-size:12px; cursor:pointer; text-decoration:underline; }
          .terms-text button:hover{ color:#0A192F; }
          .toggle-state{ font-size:10px; font-weight:900; letter-spacing:0.06em; text-transform:uppercase; }
          .toggle-state.on{ color:#16A34A; }
          .toggle-state.off{ color:#94A3B8; }
          .modal-overlay{ position:fixed; inset:0; background:rgba(10,25,47,0.65); backdrop-filter:blur(6px); z-index:90; display:grid; place-items:center; padding:16px; }
          .modal-box{ width:100%; background:#fff; border-radius:22px; border:1.5px solid #E2E8F0; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.2); animation:pop 0.22s ease; }
          @keyframes pop{ from{transform:scale(0.96) translateY(8px); opacity:0} to{transform:scale(1) translateY(0); opacity:1} }
      `}</style>

      <div className="auth-wrap">
        <div className="auth-box">
          <div className="auth-form">
            <button className="back-home" onClick={() => changeView("landing")}><i className="bi bi-arrow-left"></i> Back to Home</button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <img src="img/logo.png" alt="AutoVille" className="a-logo" onClick={() => changeView("landing")} />
              <span style={{ fontSize: '11px', background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '5px 10px', borderRadius: '20px', fontWeight: 700 }}><i className="bi bi-shield-lock me-1"></i>Secure</span>
            </div>
            <h2 style={{ fontWeight: 900, fontSize: '28px', letterSpacing: '-0.04em', margin: '12px 0 6px', lineHeight: 0.95, color: '#0A192F' }}>Welcome to AutoVille</h2>
            <p style={{ color: '#5B6B82', fontSize: '13px', fontWeight: 500 }}>Product of Ayinde Technologies • Los Angeles + US</p>
            <div className="a-role">
              <button className={localRole === "owner" ? "on" : ""} onClick={() => switchRole("owner")}><i className="bi bi-car-front-fill"></i> Vehicle Owner</button>
              <button className={localRole === "workshop" ? "on" : ""} onClick={() => switchRole("workshop")}><i className="bi bi-tools"></i> Workshop</button>
            </div>
            <div className="a-tabs">
              <button className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>Login</button>
              <button className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>Create Account</button>
            </div>
            <div className="a-social">
                <button type="button" className="social-btn gmail-btn" onClick={()=>socialSoon("Gmail")}><i className="bi bi-envelope-fill" style={{fontSize:'18px'}}></i> Gmail</button>
                <button type="button" className="social-btn fb-btn" onClick={()=>socialSoon("Facebook")}><i className="bi bi-facebook" style={{fontSize:'18px'}}></i> Facebook</button>
            </div>
            <div className="a-div">OR CONTINUE WITH EMAIL</div>

            <form onSubmit={handleSubmit}>
              {mode === "login" && (
                <div className="f-group has-icon"><i className="bi bi-envelope left-icon"></i><input type="email" placeholder=" " required value={email} onChange={e=>setEmail(e.target.value)} /><label>Email address</label></div>
              )}
              {mode === "register" && localRole === "owner" && (
                <>
                  <div className="f-group has-icon"><i className="bi bi-person left-icon"></i><input type="text" placeholder=" " required value={fullName} onChange={e=>setFullName(e.target.value)} /><label>Full Name</label></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="f-group has-icon"><i className="bi bi-envelope left-icon"></i><input type="email" placeholder=" " required value={email} onChange={e=>setEmail(e.target.value)} /><label>Email</label></div>
                    <div className="f-group has-icon"><i className="bi bi-telephone left-icon"></i><input type="text" placeholder=" " required value={phone} onChange={e=>setPhone(e.target.value)} /><label>WhatsApp</label></div>
                  </div>
                </>
              )}
              {mode === "register" && localRole === "workshop" && (
                <>
                  <div className="f-group has-icon"><i className="bi bi-building left-icon"></i><input type="text" placeholder=" " required value={businessName} onChange={e=>setBusinessName(e.target.value)} /><label>Business Name</label></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="f-group has-icon"><i className="bi bi-envelope left-icon"></i><input type="email" placeholder=" " required value={email} onChange={e=>setEmail(e.target.value)} /><label>Email</label></div>
                    <div className="f-group has-icon"><i className="bi bi-telephone left-icon"></i><input type="text" placeholder=" " required value={phone} onChange={e=>setPhone(e.target.value)} /><label>WhatsApp</label></div>
                  </div>
                  <div className="f-group has-icon"><i className="bi bi-geo-alt left-icon"></i><input type="text" placeholder=" " required value={shopAddress} onChange={e=>setShopAddress(e.target.value)} /><label>Shop Address • Inglewood, CA</label></div>
                </>
              )}

              <div className="f-group has-icon">
                <i className="bi bi-lock left-icon"></i>
                <input type={showPass ? "text" : "password"} placeholder=" " required value={password} onChange={e=>setPassword(e.target.value)} />
                <label>Password</label>
                <button type="button" className="eye" onClick={() => setShowPass(!showPass)}><i className={`bi ${showPass ? "bi-eye-slash-fill" : "bi-eye-fill"}`}></i></button>
              </div>

              {mode === "register" && (
                <div className="f-group has-icon">
                  <i className="bi bi-lock-fill left-icon"></i>
                  <input type={showConfirm ? "text" : "password"} placeholder=" " required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} />
                  <label>Confirm Password</label>
                  <button type="button" className="eye" onClick={() => setShowConfirm(!showConfirm)}><i className={`bi ${showConfirm ? "bi-eye-slash-fill" : "bi-eye-fill"}`}></i></button>
                </div>
              )}

              {mode === "login" && (
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", margin:"2px 0 14px"}}>
                  <label style={{display:"flex", gap:"6px", alignItems:"center", fontSize:"12px", fontWeight:600, color:"#5B6B82", cursor:"pointer"}}>
                    <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} style={{width:"16px", height:"16px", accentColor:"#0A192F"}} /> Remember me
                  </label>
                  <button type="button" className="forgot-link" onClick={openForgot}>Forgot password?</button>
                </div>
              )}

              {mode === "register" && (
                <div className="terms-row">
                  <label className="switch" title={agreed ? "Accepted" : "Turn on to accept"}>
                    <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} />
                    <span className="slider"></span>
                  </label>
                  <div style={{flex:1}}>
                    <div className="terms-text">
                      I agree to AutoVille <button type="button" onClick={goTerms}>Terms</button> &amp; <button type="button" onClick={goPrivacy}>Privacy Policy</button> • BAR compliance • 112 S Market St Inglewood CA
                    </div>
                    <div style={{display:"flex", gap:"6px", alignItems:"center", marginTop:"4px"}}>
                      <span className={`toggle-state ${agreed ? "on" : "off"}`}>{agreed ? "✓ Accepted" : "Toggle ON to accept"}</span>
                      {agreed && <span style={{fontSize:"10px", color:"#64748B"}}>— you can read Terms / Privacy anytime before continuing</span>}
                    </div>
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn btn-dark w-100" style={{ height: '52px', borderRadius: '12px', fontWeight: 900, fontSize: '14px' }}>{loading ? "Please wait..." : mode === "login" ? "Login Now" : "Create Account"} <i className="bi bi-arrow-right ms-1"></i></button>
              {mode === "register" && <p style={{fontSize:"11px", color:"#94A3B8", textAlign:"center", marginTop:"10px"}}>By toggling ON, you confirm you have read our <button type="button" onClick={goTerms} style={{background:"none", border:"none", color:"#1E40AF", fontWeight:800, fontSize:"11px", textDecoration:"underline", cursor:"pointer"}}>Terms</button> and <button type="button" onClick={goPrivacy} style={{background:"none", border:"none", color:"#1E40AF", fontWeight:800, fontSize:"11px", textDecoration:"underline", cursor:"pointer"}}>Privacy Policy</button>.</p>}
            </form>
          </div>

          <div className="auth-img">
            <div className="auth-overlay"></div>
            <div style={{ position: 'relative', zIndex: 2, color: '#fff' }}>
              <span style={{background:"#FACC15", color:"#0A192F", padding:"6px 12px", borderRadius:"20px", fontSize:"11px", fontWeight:900, letterSpacing:"0.06em"}}>BAR-VERIFIED WORKSHOPS</span>
              <h3 style={{ fontWeight: 900, fontSize: '32px', color: '#fff', lineHeight: 0.95, marginTop:"16px", textShadow:"0 2px 12px rgba(0,0,0,0.5)" }}>Your car, tracked.<br /><span style={{color:"#FACC15"}}>No guesswork.</span></h3>
              <p style={{fontSize:"13px", color:"#E2E8F0", marginTop:"12px", maxWidth:"320px", textShadow:"0 1px 8px rgba(0,0,0,0.6)"}}>Book a BAR-verified workshop in Inglewood / LA, track your job live, pay $0 commission.</p>
            </div>
            <div style={{ position: 'relative', zIndex: 2, color: '#fff' }}>
              <div style={{background:"rgba(10,25,47,0.72)", backdropFilter:"blur(6px)", border:"1px solid rgba(255,255,255,0.18)", borderRadius:"16px", padding:"14px", display:"flex", gap:"10px", alignItems:"center"}}>
                <div style={{width:"42px", height:"42px", borderRadius:"50%", background:"#FACC15", display:"grid", placeItems:"center", fontWeight:900, color:"#0A192F", flexShrink:0}}>★ 4.9</div>
                <div>
                  <div style={{fontWeight:800, fontSize:"13px"}}>Trusted by 2,400+ LA drivers</div>
                  <div style={{fontSize:"11px", color:"#CBD5E1"}}>Live job tracking • BAR 142 • PST • Inglewood</div>
                </div>
              </div>
              <div style={{display:"flex", gap:"8px", flexWrap:"wrap", marginTop:"12px"}}>
                <span style={{background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.25)", padding:"6px 12px", borderRadius:"20px", fontSize:"11px", fontWeight:800}}>BAR 142 Verified</span>
                <span style={{background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.25)", padding:"6px 12px", borderRadius:"20px", fontSize:"11px", fontWeight:800}}>Live Tracking</span>
                <span style={{background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.25)", padding:"6px 12px", borderRadius:"20px", fontSize:"11px", fontWeight:800}}>PST • LA</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showForgot && (
        <div className="modal-overlay" onClick={()=>setShowForgot(false)}>
          <div className="modal-box" style={{maxWidth:"460px"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:"#0A192F", padding:"18px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", color:"#fff"}}>
              <div>
                <div style={{fontWeight:900, fontSize:"16px"}}>Forgot password?</div>
                <div style={{fontSize:"12px", color:"#94A3B8"}}>{localRole === "workshop" ? "Workshop" : "Vehicle Owner"} • Reset via email</div>
              </div>
              <button onClick={()=>setShowForgot(false)} style={{width:"38px", height:"38px", borderRadius:"12px", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.18)", color:"#fff"}}><i className="bi bi-x-lg"></i></button>
            </div>
            <form onSubmit={handleForgotSubmit} style={{padding:"22px", display:"grid", gap:"14px"}}>
              <div style={{display:"flex", gap:"10px", background:"#EFF6FF", border:"1.5px solid #DBEAFE", borderRadius:"12px", padding:"12px"}}>
                <i className="bi bi-info-circle" style={{color:"#1E40AF", fontSize:"18px"}}></i>
                <div style={{fontSize:"12px", color:"#1E40AF", fontWeight:600, lineHeight:1.5}}>Enter the <b>email address you used when registering</b>. If it exists, we will send a reset link. Link expires in 30 minutes.</div>
              </div>
              <div className="f-group has-icon" style={{marginBottom:0}}>
                <i className="bi bi-envelope left-icon"></i>
                <input type="email" placeholder=" " required value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} autoFocus />
                <label>Email address used in registering</label>
              </div>
              <button disabled={forgotSending} type="submit" style={{height:"48px", borderRadius:"12px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"14px"}}>{forgotSending ? "Sending..." : "Send reset link"}</button>
              <button type="button" onClick={()=>setShowForgot(false)} style={{height:"44px", borderRadius:"12px", background:"#fff", color:"#0A192F", border:"1.5px solid #E2E8F0", fontWeight:800, fontSize:"13px"}}>Back to login</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}