// src/pages/CarOwnerDashboard.jsx - wired to backend + logout guard + fixes
import { useState, useEffect, useRef, useCallback } from "react";
import Swal from "sweetalert2";
import OwnerCarsPage from "./OwnerCarsPage";
import OwnerWorkshopsPage from "./OwnerWorkshopsPage";
import OwnerHistoryPage from "./OwnerHistoryPage";
import OwnerAnalyticsPage from "./OwnerAnalyticsPage";
import OwnerAppointmentsPage from "./OwnerAppointmentsPage";
import OwnerTrackingPage from "./OwnerTrackingPage";
import OwnerFavoritesPage from "./OwnerFavoritesPage";
import OwnerSettingsPage from "./OwnerSettingsPage";
import OwnerRemarksPage from "./OwnerRemarksPage";

const API = "http://127.0.0.1:5000/api";
const DEFAULT_AVATAR = "../img/usericon.png";

function getStoredUser(){ try{ return JSON.parse(localStorage.getItem("autoville_user")||"{}"); }catch{ return {}; } }
function getOwnerId(u){ return u?.id || u?.owner_id || u?.ownerId || u?.user_id || null; }
function isOwnerUser(u){
  if(!u || !getOwnerId(u)) return false;
  const role = String(u.role || u.user_type || u.type || "owner").toLowerCase();
  if(!u.role && !u.user_type && !u.type) return true;
  return ["owner","car_owner","vehicle_owner","carowner","customer"].includes(role);
}
function resolveAvatar(owner, stored){
  const cand = (owner?.avatar || owner?.logo || stored?.avatar || stored?.logo || "").toString().trim();
  if(!cand || cand === "null" || cand === "undefined") return DEFAULT_AVATAR;
  return cand;
}

export default function CarOwnerDashboard({ changeView }) {
  const [storedUser] = useState(()=> getStoredUser());
  const ownerId = getOwnerId(storedUser);
  const [authorized, setAuthorized] = useState(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activePage, setActivePage] = useState("dashboard");
  const [theme, setTheme] = useState(() => localStorage.getItem("av_owner_theme") || "light");
  const isDark = theme === "dark";
  const mainContentRef = useRef(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(()=>{
    const check = ()=>{
      const u = getStoredUser();
      const token = localStorage.getItem("autoville_user") || localStorage.getItem("autoville_token");
      if(!token || !isOwnerUser(u)){
        setAuthorized(false);
        if(changeView) changeView("landing");
        else window.location.href = "/";
        return false;
      }
      setAuthorized(true);
      return true;
    };
    if(!check()) return;
    const iv = setInterval(()=>{ if(!check()) clearInterval(iv); }, 30000);
    const onFocus = ()=> check();
    const onStorage = (e)=>{ if(e.key==="autoville_user" || e.key==="autoville_token") check(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return ()=>{ clearInterval(iv); window.removeEventListener("focus", onFocus); window.removeEventListener("storage", onStorage); };
  }, [changeView]);

  useEffect(()=>{ localStorage.setItem("av_owner_theme", theme); }, [theme]);
  useEffect(()=>{
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0; document.body.scrollTop = 0;
    if(mainContentRef.current) mainContentRef.current.scrollTop = 0;
  },[activePage]);
  useEffect(()=>{
    const close = (e)=>{ if(!e.target.closest(".owner-profile-wrap")) setProfileOpen(false); };
    document.addEventListener("mousedown", close);
    return ()=>document.removeEventListener("mousedown", close);
  },[]);

  const fetchDashboard = useCallback(async ()=>{
    if(!ownerId) return;
    setLoading(true); setError("");
    try{
      const res = await fetch(`${API}/owners/${ownerId}/dashboard`);
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || `Failed to load dashboard (${res.status})`);
      setDashboard(data);
    }catch(e){
      setError(e.message || "Could not load dashboard. Is Flask running on :5000?");
      setDashboard(null);
    }
    setLoading(false);
  }, [ownerId]);

  useEffect(()=>{ if(authorized) fetchDashboard(); }, [authorized, fetchDashboard]);

  const handleLogout = async ()=>{
    const res = await Swal.fire({ title:"Log out?", text:"You will be taken to the home page.", icon:"question", showCancelButton:true, confirmButtonColor:"#0A192F", confirmButtonText:"Yes, log out" });
    if(!res.isConfirmed) return;
    try{
      await fetch(`${API}/auth/logout`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ user_id: ownerId, role:"owner" }) });
    }catch{}
    localStorage.removeItem("autoville_user");
    localStorage.removeItem("autoville_token");
    localStorage.removeItem("autoville_owner");
    sessionStorage.clear();
    setProfileOpen(false);
    if(changeView) changeView("landing");
    else window.location.href = "/";
  };

  const C = {
    wrap: isDark ? "#070F1F" : "#F5F7FB",
    top: isDark ? "#0F1D33" : "#ffffff",
    topBorder: isDark ? "#1E2E4A" : "#E2E8F0",
    card: isDark ? "#11203B" : "#ffffff",
    cardBorder: isDark ? "#1E2E4A" : "#E2E8F0",
    text: isDark ? "#F1F5F9" : "#0A192F",
    muted: isDark ? "#94A3B8" : "#6B7A90",
    soft: isDark ? "#1A2B4A" : "#F8FAFC",
  };

  const handleNav = (page) => { setActivePage(page); setSideOpen(false); window.scrollTo(0,0); };

  const getPageTitle = () => {
    const map = {
      dashboard: "Car Owner Dashboard",
      cars: "My Garage",
      workshops: "Workshops",
      appointments: "Appointments",
      tracking: "Live Tracking",
      history: "Service History",
      analytics: "Analytics",
      favorites: "Favorites",
      remarks: "Remarks & Ratings",
      settings: "Settings",
    };
    return map[activePage] || activePage;
  };

  if(authorized === false) return <div style={{padding:"40px", textAlign:"center", color:"#64748B"}}>Logged out — redirecting to home...</div>;
  if(authorized === null) return <div style={{padding:"40px", textAlign:"center", color:"#64748B"}}>Checking login...</div>;

  const owner = dashboard?.owner || storedUser || {};
  const ownerName = owner.full_name || owner.name || storedUser.full_name || storedUser.name || "Car Owner";
  const ownerEmail = owner.email || storedUser.email || "";
  const ownerAvatar = resolveAvatar(owner, storedUser);
  const stats = dashboard?.stats || { activeBookings:0, appointmentsCount:0, liveCount:0, remarksCount:0, ratingAvg:0, totalSpent:0, totalJobs:0, positiveRemarks:0 };
  const activeBooking = dashboard?.activeBooking || null;
  const latestRemark = dashboard?.latestRemark || null;
  const hasRemarks = stats.remarksCount > 0 && !!latestRemark;

  return (
    <>
    <style>{`
      .owner-wrap{ min-height:100vh; display:flex; font-family:'Inter', system-ui, sans-serif; }
      .owner-side{ width:270px; background:#0A192F; display:flex; flex-direction:column; position:fixed; top:0; left:0; bottom:0; z-index:10; border-right:1px solid rgba(255,255,255,0.08); overflow:hidden; }
      .owner-side-scroll{ flex:1; overflow-y:auto; overflow-x:hidden; background:#0A192F; padding:24px 12px 10px; display:grid; gap:2px; align-content:start; scrollbar-width:thin; scrollbar-color:#1E2E4A #0A192F; }
      .owner-side-scroll::-webkit-scrollbar{ width:6px; } .owner-side-scroll::-webkit-scrollbar-track{ background:#0A192F; } .owner-side-scroll::-webkit-scrollbar-thumb{ background:#1E2E4A; border-radius:10px; } .owner-side-scroll::-webkit-scrollbar-thumb:hover{ background:#2A3F65; }
      .owner-main{ flex:1; min-height:100vh; } .owner-top{ height:68px; display:flex; align-items:center; justify-content:space-between; padding:0 20px; position:sticky; top:0; z-index:6; }
      .owner-navbtn{ width:100%; text-align:left; background:transparent; border:none; color:#94A3B8; padding:13px 14px; border-radius:10px; display:flex; align-items:center; gap:10px; font-weight:700; font-size:13.5px; transition:.15s; cursor:pointer; }
      .owner-navbtn.active, .owner-navbtn:hover{ background:rgba(255,255,255,0.10); color:#fff; }
      .owner-card{ border-radius:16px; transition:.2s; } .owner-avatar{ width:42px; height:42px; border-radius:50%; object-fit:cover; border:2px solid #0A192F; }
      .theme-btn{ width:42px; height:42px; border-radius:50%; border:1.5px solid #E2E8F0; background:#fff; display:grid; place-items:center; cursor:pointer; font-size:18px; } .theme-btn.dark{ background:#11203B; border-color:#1E2E4A; color:#FBBF24; }
      .owner-dropdown{ position:absolute; top:56px; right:0; width:280px; background:#fff; border:1.5px solid #0A192F; border-radius:18px; box-shadow:0 20px 50px rgba(10,25,47,0.18); overflow:hidden; z-index:50; } .owner-wrap.dark .owner-dropdown{ background:#11203B; border-color:#1E2E4A; }
      @media(max-width:991px){ .owner-side{ transform:translateX(-100%); transition:.25s; } .owner-side.open{ transform:translateX(0); } .owner-main{ margin-left:0 !important; } }
    `}</style>

    <div className={`owner-wrap ${isDark?"dark":""}`} style={{background:C.wrap}}>
      <aside className={`owner-side ${sideOpen?"open":""}`}>
        <div className="owner-side-scroll">
          <div style={{padding:'0 6px 14px', marginBottom:'6px', borderBottom:'1px solid rgba(255,255,255,0.08)'}}><div style={{fontWeight:900, fontSize:'11px', letterSpacing:'0.12em', color:'#64748B'}}>MENU</div></div>
          <button className={`owner-navbtn ${activePage==="dashboard"?"active":""}`} onClick={()=>handleNav("dashboard")}><i className="bi bi-grid-fill"></i> Dashboard</button>
          <button className={`owner-navbtn ${activePage==="cars"?"active":""}`} onClick={()=>handleNav("cars")}><i className="bi bi-car-front-fill"></i> My Cars</button>
          <button className={`owner-navbtn ${activePage==="workshops"?"active":""}`} onClick={()=>handleNav("workshops")}><i className="bi bi-shop"></i> Workshops</button>
          <button className={`owner-navbtn ${activePage==="appointments"?"active":""}`} onClick={()=>handleNav("appointments")}><i className="bi bi-calendar-week"></i> Appointments {stats.appointmentsCount>0 && <span className="ms-auto" style={{background:activePage==="appointments"?"#FBBF24":"rgba(255,255,255,0.15)", color:activePage==="appointments"?"#000":"#fff", fontSize:'11px', padding:'3px 8px', borderRadius:'20px', fontWeight:800}}>{stats.appointmentsCount}</span>}</button>
          <button className={`owner-navbtn ${activePage==="tracking"?"active":""}`} onClick={()=>handleNav("tracking")}><i className="bi bi-geo-alt-fill"></i> Live Tracking {stats.liveCount>0 && <span className="ms-auto bg-white text-dark" style={{fontSize:'10px', padding:'2px 6px', borderRadius:'10px', fontWeight:800}}>{stats.liveCount} LIVE</span>}</button>
          <button className={`owner-navbtn ${activePage==="history"?"active":""}`} onClick={()=>handleNav("history")}><i className="bi bi-clock-history"></i> History</button>
          <button className={`owner-navbtn ${activePage==="analytics"?"active":""}`} onClick={()=>handleNav("analytics")}><i className="bi bi-graph-up-arrow"></i> Analytics</button>
          <div style={{margin:'10px 0 6px', padding:'0 6px'}}><div style={{fontWeight:900, fontSize:'11px', letterSpacing:'0.12em', color:'#475569'}}>ACCOUNT</div></div>
          <button className={`owner-navbtn ${activePage==="favorites"?"active":""}`} onClick={()=>handleNav("favorites")}><i className="bi bi-heart"></i> Favorites</button>
          <button className={`owner-navbtn ${activePage==="remarks"?"active":""}`} onClick={()=>handleNav("remarks")}><i className="bi bi-star-half"></i> Remarks & Ratings {stats.remarksCount>0 && <span className="ms-auto" style={{background:activePage==="remarks"?"#FBBF24":"#F59E0B", color:"#000", fontSize:'10px', padding:'3px 7px', borderRadius:'20px', fontWeight:800}}>{stats.remarksCount}</span>}</button>
          <button className={`owner-navbtn ${activePage==="settings"?"active":""}`} onClick={()=>handleNav("settings")}><i className="bi bi-gear-fill"></i> Settings</button>
        </div>
        <div style={{padding:'12px', borderTop:'1px solid rgba(255,255,255,0.08)', background:'#0A192F'}}><button onClick={handleLogout} className="owner-navbtn"><i className="bi bi-box-arrow-left"></i> Logout • Home</button></div>
      </aside>

      <div className="owner-main" ref={mainContentRef} style={{marginLeft:'270px', background:C.wrap}}>
        <div className="owner-top" style={{background:C.top, borderBottom:`1.5px solid ${C.topBorder}`}}>
          <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            <button className="btn btn-dark d-lg-none" onClick={()=>setSideOpen(!sideOpen)} style={{borderRadius:'10px'}}><i className="bi bi-list"></i></button>
            <div><div style={{fontWeight:900, fontSize:'16px', color:C.text}}>{getPageTitle()}</div><div style={{fontSize:'11px', color:C.muted}}>/car-owner/{activePage} • Los Angeles, CA • ID #{ownerId}</div></div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            <button onClick={()=>setTheme(isDark?"light":"dark")} className={`theme-btn ${isDark?"dark":""}`}><i className={`bi ${isDark?"bi-sun-fill":"bi-moon-stars-fill"}`}></i></button>
            <button className="btn btn-dark d-none d-md-flex" style={{borderRadius:'10px', fontWeight:800, fontSize:'12px'}} onClick={()=>handleNav("workshops")}><i className="bi bi-search me-1"></i>Find Shops</button>
            <div className="owner-profile-wrap" style={{position:'relative'}}>
              <button onClick={()=>setProfileOpen(!profileOpen)} style={{border:'none', background:'transparent', display:'flex', alignItems:'center', gap:'10px'}}>
                <img src={ownerAvatar} onError={(e)=>{ e.target.onerror=null; e.target.src=DEFAULT_AVATAR; }} className="owner-avatar" alt="" />
                <div className="d-none d-md-block text-start" style={{lineHeight:1.1}}><div style={{fontWeight:900, fontSize:'13px', color:C.text}}>{ownerName}</div><div style={{fontSize:'11px', color:C.muted}}>Owner • LA</div></div>
                <i className="bi bi-chevron-down ms-1" style={{fontSize:'12px', color:C.muted}}></i>
              </button>
              {profileOpen && <div className="owner-dropdown"><div style={{padding:'16px', background:isDark?"#0F1D33":"#F8FAFC", borderBottom:`1px solid ${C.cardBorder}`, display:'flex', gap:'12px'}}><img src={ownerAvatar} onError={(e)=>{ e.target.onerror=null; e.target.src=DEFAULT_AVATAR; }} style={{width:'48px', height:'48px', borderRadius:'50%', objectFit:'cover'}} alt="" /><div><div style={{fontWeight:900, fontSize:'14px', color:isDark?"#fff":"#0A192F"}}>{ownerName}</div><div style={{fontSize:'12px', color:C.muted}}>{ownerEmail}</div></div></div><button className="owner-navbtn" style={{color:C.text, background:'transparent', padding:'12px 16px'}} onClick={handleLogout}><i className="bi bi-box-arrow-right"></i> Logout</button></div>}
            </div>
          </div>
        </div>

        <div style={{padding:'20px'}}>
          {error && <div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", color:"#991B1B", padding:"12px 14px", borderRadius:"12px", marginBottom:"12px", fontSize:"13px", fontWeight:700}}>{error} <button onClick={fetchDashboard} style={{marginLeft:"8px", background:"#fff", border:"1px solid #FECACA", borderRadius:"8px", padding:"4px 10px", fontWeight:800}}>Retry</button></div>}
          {activePage==="dashboard" && (
            <>
              {loading ? <div style={{padding:"40px", textAlign:"center", color:C.muted}}>Loading dashboard from backend...</div> : (
              <>
              <div className="row g-3">
                <div className="col-6 col-xl-3"><div className="owner-card p-3" style={{background:C.card, border:`1.5px solid ${C.cardBorder}`}}><div style={{fontSize:'11px', fontWeight:800, color:C.muted}}>ACTIVE BOOKING</div><div style={{fontSize:'22px', fontWeight:900, marginTop:'6px', color:C.text}}>{activeBooking ? `${activeBooking.car} • ${activeBooking.service_type}` : "No active booking"}</div><div style={{fontSize:'11px', color:'#22C55E', fontWeight:700}}><i className="bi bi-dot"></i>{activeBooking ? `Live at ${activeBooking.workshop_name} • ${activeBooking.status}` : "Book a service"}</div></div></div>
                <div className="col-6 col-xl-3"><div className="owner-card p-3" style={{background:C.card, border:`1.5px solid ${C.cardBorder}`}}><div style={{fontSize:'11px', fontWeight:800, color:C.muted}}>MY RATING AVG</div><div style={{fontSize:'28px', fontWeight:900, color:C.text}}>{hasRemarks ? stats.ratingAvg : "—"} {hasRemarks && <i className="bi bi-star-fill" style={{color:'#F59E0B', fontSize:'20px'}}></i>}</div><div style={{fontSize:'11px', color:C.muted}}>{hasRemarks ? `${stats.remarksCount} remarks • ${stats.positiveRemarks} positive` : "No remarks yet"}</div></div></div>
                <div className="col-6 col-xl-3"><div className="owner-card p-3" style={{background:C.card, border:`1.5px solid ${C.cardBorder}`}}><div style={{fontSize:'11px', fontWeight:800, color:C.muted}}>TOTAL SPENT</div><div style={{fontSize:'28px', fontWeight:900, color:C.text}}>${Number(stats.totalSpent).toLocaleString()}</div><div style={{fontSize:'11px', color:C.muted}}>{stats.totalJobs} jobs • LA</div></div></div>
                <div className="col-6 col-xl-3"><div className="owner-card p-3" style={{background:'#0A192F', color:'#fff'}}><div style={{fontSize:'11px', color:'#94A3B8'}}>SUPPORT • Peter</div><div style={{fontSize:'14px', fontWeight:800, marginTop:'6px'}}>+1-201-534-2657</div><div style={{fontSize:'11px', color:'#94A3B8'}}>support@ayindetechnologies.com</div></div></div>
              </div>

              {/* FIXED: Latest Remark only if user actually has a review */}
              <div className="row g-3 mt-1">
                <div className="col-lg-8">
                  {hasRemarks ? (
                    <div className="owner-card p-3" style={{background:C.card, border:`1.5px solid ${C.cardBorder}`}}><h6 style={{fontWeight:900, color:C.text}}><i className="bi bi-star-half me-2" style={{color:'#F59E0B'}}></i>Latest Remark {latestRemark?.booking_id ? `• #${latestRemark.booking_id} Impact` : ""}</h6><div style={{display:'flex', gap:'12px', marginTop:'12px', alignItems:'center'}}><img src={DEFAULT_AVATAR} style={{width:'80px', height:'80px', borderRadius:'12px', objectFit:'cover'}} alt="" /><div><div style={{fontWeight:800, color:C.text}}>{`${latestRemark.workshop_name} • ${latestRemark.service_type} • ${latestRemark.rating}★`}</div><div style={{fontSize:'12px', color:C.muted}}>{latestRemark.comment}</div><button onClick={()=>handleNav("remarks")} style={{marginTop:'8px', background:'#0A192F', color:'#fff', border:'none', borderRadius:'8px', padding:'6px 12px', fontWeight:800, fontSize:'11px'}}>View All Remarks <i className="bi bi-arrow-right ms-1"></i></button></div></div></div>
                  ) : (
                    <div className="owner-card p-3" style={{background:C.card, border:`1.5px solid ${C.cardBorder}`}}><h6 style={{fontWeight:900, color:C.text}}><i className="bi bi-star me-2" style={{color:'#F59E0B'}}></i>Remarks & Ratings</h6><div style={{fontSize:'13px', color:C.muted, marginTop:'8px', lineHeight:1.6}}>You haven&apos;t rated any service yet. After your first completed service, your rating will appear here and move the shop&apos;s overall.</div><button onClick={()=>handleNav("workshops")} style={{marginTop:'12px', background:'#0A192F', color:'#fff', border:'none', borderRadius:'8px', padding:'8px 14px', fontWeight:800, fontSize:'12px'}}>Find a Workshop <i className="bi bi-arrow-right ms-1"></i></button></div>
                  )}
                </div>
                <div className="col-lg-4"><div className="owner-card p-3" style={{background:C.card, border:`1.5px solid ${C.cardBorder}`}}><h6 style={{fontWeight:900, color:C.text}}><i className="bi bi-info-circle me-2"></i>How Overall Rating Works</h6><div style={{fontSize:'13px', color:C.muted, marginTop:'8px', lineHeight:1.6}}>Overall = (Base Avg × Base Count + Sum of your service ratings) / Total. Every service you rate moves the shop&apos;s overall.</div><button onClick={()=>handleNav("remarks")} style={{width:'100%', marginTop:'12px', height:'42px', borderRadius:'10px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, fontSize:'13px'}}><i className="bi bi-star me-1"></i> Rate a Service</button></div></div>
              </div>
              </>
              )}
            </>
          )}
          {activePage==="cars" && <OwnerCarsPage C={C} isDark={isDark} ownerId={ownerId} owner={owner} />}
          {activePage==="workshops" && <OwnerWorkshopsPage C={C} isDark={isDark} ownerId={ownerId} owner={owner} />}
          {activePage==="appointments" && <OwnerAppointmentsPage C={C} isDark={isDark} ownerId={ownerId} owner={owner} onTrack={()=>handleNav("tracking")} />}
          {activePage==="tracking" && <OwnerTrackingPage C={C} isDark={isDark} ownerId={ownerId} owner={owner} onBack={()=>handleNav("appointments")} />}
          {activePage==="history" && <OwnerHistoryPage C={C} isDark={isDark} ownerId={ownerId} owner={owner} />}
          {activePage==="analytics" && <OwnerAnalyticsPage C={C} isDark={isDark} ownerId={ownerId} owner={owner} />}
          {activePage==="favorites" && <OwnerFavoritesPage C={C} isDark={isDark} ownerId={ownerId} owner={owner} />}
          {activePage==="remarks" && <OwnerRemarksPage C={C} isDark={isDark} ownerId={ownerId} owner={owner} />}
          {activePage==="settings" && <OwnerSettingsPage C={C} isDark={isDark} ownerId={ownerId} owner={owner} />}
        </div>
      </div>
      {sideOpen && <div onClick={()=>setSideOpen(false)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:9}} className="d-lg-none"></div>}
    </div>
    </>
  );
}