import { useState, useEffect, useRef, useMemo } from "react";
import Swal from "sweetalert2";
import AdminVehicleOwners from "./admin/AdminVehicleOwners.jsx";
import AdminWorkshops from "./admin/AdminWorkshops.jsx";
import AdminBookings from "./admin/AdminBookings.jsx";
import AdminJobsTracking from "./admin/AdminJobsTracking.jsx";
import AdminIncomes from "./admin/AdminIncomes.jsx";
import AdminExpenditures from "./admin/AdminExpenditures.jsx";
import AdminBookkeeping from "./admin/AdminBookkeeping.jsx";
import AdminSubscriptions from "./admin/AdminSubscriptions.jsx";
import AdminReviews from "./admin/AdminReviews.jsx";
import AdminAnalytics from "./admin/AdminAnalytics.jsx";
import AdminLogs from "./admin/AdminLogs.jsx";
import AdminSettings from "./admin/AdminSettings.jsx";
import { useAdminGuard } from "../hooks/useAdminGuard.js";
import { logoutAdmin, getStoredAdmin } from "../utils/adminAuth.js";

const API = "http://127.0.0.1:5000/api";
const FALLBACK_AVATAR = "../img/usericon.png"; // public/img/usericon.png

function getAvatar(admin){
  var a = admin?.avatar || admin?.avatar_url || "";
  // reject old unsplash placeholders + empty
  if(!a || a.includes("unsplash") || a.includes("images.unsplash")) return FALLBACK_AVATAR;
  return a;
}
function handleImgError(e){
  if(e.currentTarget.src.indexOf("usericon.png") === -1){
    e.currentTarget.onerror = null;
    e.currentTarget.src = "/img/usericon.png";
  }
}

const MENU = [
  { id:"overview", label:"Overview", icon:"bi-speedometer2", desc:"System Stats" },
  { id:"owners", label:"Vehicle Owners", icon:"bi-people", desc:"Active" },
  { id:"workshops", label:"Workshops", icon:"bi-tools", desc:"BAR 142" },
  { id:"bookings", label:"Bookings", icon:"bi-calendar-check", desc:"Live LA" },
  { id:"jobs", label:"Jobs & Tracking", icon:"bi-geo-alt", desc:"In progress" },
  { id:"incomes", label:"Incomes", icon:"bi-graph-up-arrow", desc:"Subscriptions USD" },
  { id:"expenditures", label:"Expenditures", icon:"bi-receipt", desc:"Audit Locked" },
  { id:"bookkeeping", label:"Bookkeeping", icon:"bi-journal-check", desc:"P/L Margin" },
  { id:"subscriptions", label:"Subscriptions", icon:"bi-gem", desc:"Plans" },
  { id:"reviews", label:"Reviews", icon:"bi-star", desc:"Ratings" },
  { id:"analytics", label:"Analytics", icon:"bi-graph-up", desc:"Growth" },
  { id:"logs", label:"Activity Logs", icon:"bi-journal-text", desc:"Audit" },
  { id:"settings", label:"Settings", icon:"bi-gear", desc:"Config" },
];

export default function AdminDashboard({ changeView }){
  useAdminGuard(changeView);
  const [active, setActive] = useState(function(){
    var p = window.location.pathname.replace(/\/+$/,"").split("/").pop();
    if(MENU.some(function(m){return m.id===p})) return p;
    return localStorage.getItem("admin_active") || "overview";
  });
  const [showSidebar, setShowSidebar] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);
  const [admin, setAdmin] = useState({ username:"ayinde_admin", fullName:"Ayinde Admin" });
  const [stats, setStats] = useState({ owners:0, workshops:0, bookings:0, revenue:0, verified:0 });

  useEffect(function(){
    var raw = localStorage.getItem("autoville_admin");
    if(raw){ try{ setAdmin(JSON.parse(raw)); }catch(e){} }
    // REAL - profile from DB (avatar, name, email) - not localStorage only
    fetch(API + "/admin/profile").then(r=>r.json()).then(d=>{
      if(d && d.full_name){
        var merged = { username: d.username || d.full_name, fullName: d.full_name, name: d.full_name, email: d.email, phone: d.phone, role: d.role, avatar: d.avatar || d.avatar_url || "", avatar_url: d.avatar || d.avatar_url || "" };
        setAdmin(function(prev){ return { ...prev, ...merged }; });
        localStorage.setItem("autoville_admin", JSON.stringify({ ...merged, loginAt: new Date().toISOString() }));
      }
    }).catch(()=>{});
    // REAL - counts for sidebar + overview
    fetch(API + "/admin/analytics?range=6M").then(r=>r.json()).then(d=>{
      if(d){
        setStats({
          owners: d.totals?.owners ?? d.owners ?? 0,
          workshops: d.totals?.workshops ?? d.workshops ?? 0,
          bookings: d.totals?.bookings ?? d.bookings ?? 0,
          revenue: d.totals?.income ?? d.income ?? d.totalIncome ?? 0,
          verified: d.totals?.verifiedWorkshops ?? d.verified ?? 0,
        });
      }
    }).catch(()=>{});
    function onPop(){
      var pp = window.location.pathname.split("/").pop();
      if(MENU.some(function(m){return m.id===pp})) setActive(pp);
    }
    window.addEventListener("popstate", onPop);
    function clickOut(e){ if(profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false); }
    document.addEventListener("mousedown", clickOut);
    return function(){ window.removeEventListener("popstate", onPop); document.removeEventListener("mousedown", clickOut); };
  },[]);

  function handleNav(id){
    setActive(id);
    localStorage.setItem("admin_active", id);
    setShowSidebar(false);
    setShowProfile(false);
    window.scrollTo(0,0);
    var path = id==="overview" ? "/console/dashboard" : "/console/dashboard/" + id;
    window.history.pushState({}, "", path);
  }
  function handleLogout(){
    // Deletes cookies + localStorage + sessionStorage + backend log, then landing
    logoutAdmin(changeView);
  }

  var activeLabel = (MENU.find(function(m){return m.id===active})||{}).label || "Overview";
  var displayName = admin.fullName || admin.name || admin.username || "Ayinde Admin";
  var avatarSrc = getAvatar(admin);

  function menuDesc(m){
    if(m.id==="owners") return stats.owners ? stats.owners + " Active" : "Active";
    if(m.id==="workshops") return stats.workshops ? stats.workshops + " BAR 142" : "BAR 142";
    if(m.id==="bookings") return stats.bookings ? stats.bookings + " Total" : "Live LA";
    if(m.id==="incomes") return stats.revenue ? "$" + Number(stats.revenue).toLocaleString() + " Total" : "Subscriptions USD";
    return m.desc;
  }

  return (
    <>
    <style>{`
      .admin-layout{ display:flex; min-height:100vh; background:#F8FAFC; width:100%; overflow-x:hidden; }
      .admin-sidebar{ width:300px; background:#0A192F; color:#fff; display:flex; flex-direction:column; position:fixed; top:0; left:0; bottom:0; z-index:30; }
      .admin-sidebar-scroll{ flex:1; overflow-y:auto; padding:12px; background:#0A192F; }
      .admin-sidebar-scroll::-webkit-scrollbar{ width:6px; }
      .admin-sidebar-scroll::-webkit-scrollbar-track{ background:#0A192F; }
      .admin-sidebar-scroll::-webkit-scrollbar-thumb{ background:#1E2E4A; border-radius:10px; }
      .admin-sidebar-scroll::-webkit-scrollbar-thumb:hover{ background:#2A3F5F; }
      .admin-main{ flex:1; margin-left:300px; min-width:0; width:calc(100% - 300px); display:flex; flex-direction:column; }
      .admin-topbar{ height:72px; min-height:72px; background:#fff; border-bottom:1.5px solid #E2E8F0; display:flex; align-items:center; justify-content:space-between; padding:0 18px; gap:12px; position:sticky; top:0; z-index:20; }
      .admin-content{ padding:18px; flex:1; min-width:0; width:100%; box-sizing:border-box; }
      .admin-nav{ width:100%; height:54px; border-radius:12px; border:1px solid transparent; background:transparent; color:#94A3B8; display:flex; align-items:center; gap:12px; padding:0 14px; font-weight:700; font-size:14px; cursor:pointer; text-align:left; }
      .admin-nav:hover{ background:rgba(255,255,255,0.06); color:#fff; } .admin-nav.active{ background:#fff; color:#0A192F; }
      .admin-avatar{ width:42px; height:42px; border-radius:12px; object-fit:cover; border:2px solid #0A192F; background:#F1F5F9; }
      .admin-badge{ font-size:11px; font-weight:800; background:#DCFCE7; color:#166534; border:1px solid #BBF7D0; padding:5px 10px; border-radius:20px; display:inline-flex; gap:6px; white-space:nowrap; }
      .profile-drop{ position:absolute; top:calc(100% + 10px); right:0; width:300px; background:#fff; border:1.5px solid #E2E8F0; border-radius:16px; box-shadow:0 16px 40px rgba(10,25,47,0.14); padding:10px; z-index:60; }
      @media(max-width:991px){ .admin-sidebar{ transform:translateX(-100%); transition:0.3s; } .admin-sidebar.open{ transform:translateX(0); } .admin-main{ margin-left:0; width:100%; } .admin-topbar{ min-height:64px; padding:10px 12px; } .admin-content{ padding:12px; } }
    `}</style>

    <div className="admin-layout">
      <aside className={"admin-sidebar " + (showSidebar?"open":"")}>
        <div style={{padding:"16px 14px 12px", borderBottom:"1.5px solid rgba(255,255,255,0.08)", display:"flex", gap:"12px", alignItems:"center", background:"#0A192F"}}>
          <img src="/img/logo-trans.png" alt="" onError={handleImgError} style={{width:"42px", height:"42px", borderRadius:"10px", background:"#fff", padding:"4px"}} />
          <div><div style={{fontWeight:900}}>AutoVille Admin</div><div style={{fontSize:"11px", color:"#94A3B8"}}>Ayinde Tech</div></div>
          <button onClick={function(){setShowSidebar(false)}} className="d-lg-none ms-auto" style={{width:"36px", height:"36px", borderRadius:"10px", background:"rgba(255,255,255,0.06)", color:"#fff", border:"1px solid rgba(255,255,255,0.15)"}}><i className="bi bi-x-lg"></i></button>
        </div>
        <div className="admin-sidebar-scroll">
          <div style={{display:"grid", gap:"8px"}}>
            {MENU.map(function(m){
              var cls = "admin-nav " + (active===m.id ? "active" : "");
              return (
                <button key={m.id} onClick={function(){handleNav(m.id)}} className={cls}>
                  <i className={"bi " + m.icon} style={{width:"22px"}}></i>
                  <span style={{flex:1}}>{m.label}<span style={{display:"block", fontSize:"11px", fontWeight:500, opacity:0.8}}>{menuDesc(m)}</span></span>
                </button>
              )
            })}
          </div>
        </div>
        <div style={{padding:"12px", borderTop:"1.5px solid rgba(255,255,255,0.08)", background:"#0A192F"}}>
          <button onClick={handleLogout} style={{width:"100%", height:"46px", borderRadius:"12px", border:"1.5px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.06)", color:"#fff", fontWeight:800}}><i className="bi bi-box-arrow-left me-2"></i>Logout Admin</button>
        </div>
      </aside>

      <div className="admin-main">
        <div className="admin-topbar">
          <div style={{display:"flex", gap:"12px", alignItems:"center", minWidth:0, flex:1}}>
            <button onClick={function(){setShowSidebar(true)}} className="d-lg-none" style={{width:"44px", height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", background:"#fff"}}><i className="bi bi-list"></i></button>
            <div style={{minWidth:0}}>
              <div style={{display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap"}}>
                <span style={{fontWeight:900, fontSize:"18px", color:"#0A192F"}}>{activeLabel}</span>
                <span className="admin-badge">SUPER ADMIN {admin.username || displayName}</span>
              </div>
              <div style={{fontSize:"11px", color:"#64748B", fontWeight:600, marginTop:"2px"}}>112 S Market St, Ste 1008, Inglewood, CA 90301 • PST • BAR</div>
            </div>
          </div>
          <div style={{display:"flex", gap:"10px", alignItems:"center"}}>
            <div ref={profileRef} style={{position:"relative"}}>
              <button onClick={function(){setShowProfile(!showProfile)}} style={{display:"flex", gap:"10px", alignItems:"center", border:"1.5px solid #E2E8F0", background:"#fff", borderRadius:"14px", padding:"4px 8px 4px 4px"}}>
                <img src={avatarSrc} alt="" onError={handleImgError} className="admin-avatar" />
                <div className="d-none d-sm-block" style={{textAlign:"left"}}><div style={{fontWeight:800, fontSize:"13px", color:"#0A192F"}}>{displayName}</div><div style={{fontSize:"11px", color:"#6B7A90"}}>Super Admin</div></div>
                <i className="bi bi-chevron-down d-none d-sm-block" style={{fontSize:"12px", color:"#94A3B8", marginRight:"4px"}}></i>
              </button>
              {showProfile && (
                <div className="profile-drop">
                  <div style={{display:"flex", gap:"10px", alignItems:"center"}}>
                    <img src={avatarSrc} alt="" onError={handleImgError} style={{width:"44px", height:"44px", borderRadius:"12px", objectFit:"cover", background:"#F1F5F9"}} />
                    <div><div style={{fontWeight:900, fontSize:"13px", color:"#0A192F"}}>{displayName}</div><div style={{fontSize:"11px", color:"#64748B"}}>{admin.email || "admin@autoville.la"}</div><div style={{fontSize:"11px", color:"#16A34A", fontWeight:700}}>2FA Active</div></div>
                  </div>
                  <button onClick={function(){handleNav("settings");}} style={{width:"100%", height:"40px", borderRadius:"10px", border:"1.5px solid #E2E8F0", background:"#fff", color:"#0A192F", fontWeight:800, marginTop:"10px"}}><i className="bi bi-gear me-2"></i>Settings</button>
                  <button onClick={handleLogout} style={{width:"100%", height:"40px", borderRadius:"10px", border:"none", background:"#FEF2F2", color:"#DC2626", fontWeight:800, marginTop:"8px"}}>Logout Console</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="admin-content">
          {active==="overview" && <OverviewPage onNav={handleNav} stats={stats} />}
          {active==="owners" && <AdminVehicleOwners />}
          {active==="workshops" && <AdminWorkshops />}
          {active==="bookings" && <AdminBookings />}
          {active==="jobs" && <AdminJobsTracking />}
          {active==="incomes" && <AdminIncomes />}
          {active==="expenditures" && <AdminExpenditures />}
          {active==="bookkeeping" && <AdminBookkeeping />}
          {active==="subscriptions" && <AdminSubscriptions />}
          {active==="reviews" && <AdminReviews />}
          {active==="analytics" && <AdminAnalytics />}
          {active==="logs" && <AdminLogs />}
          {active==="settings" && <AdminSettings />}
        </div>
      </div>
      {showSidebar && <div onClick={function(){setShowSidebar(false)}} className="d-lg-none" style={{position:"fixed", inset:0, background:"rgba(10,25,47,0.45)", zIndex:20}}></div>}
    </div>
    </>
  );
}

function BarChart(props){
  var data = props.data;
  var labels = props.labels;
  var color = props.color || "#0A192F";
  var maxV = 0;
  for(var i=0; i<data.length; i++){ if(data[i] > maxV) maxV = data[i]; }
  var minV = 0;
  var range = maxV - minV;
  if(range===0){ range = 1; }
  return (
    <div style={{width:"100%"}}>
      <div style={{display:"flex", gap:"10px", alignItems:"flex-end", height:"160px", padding:"0 6px"}}>
        {data.map(function(v,i){
          var pct = ((v - minV) / range) * 100;
          return (
            <div key={i} style={{flex:1, height:"100%", display:"flex", flexDirection:"column", justifyContent:"flex-end"}}>
              <div style={{flex:1, height:pct + "%", background:color, borderRadius:"10px 10px 4px 4px", minHeight:"6px", position:"relative"}}>
                <span style={{position:"absolute", top:"-18px", left:"50%", transform:"translateX(-50%)", fontSize:"10px", fontWeight:800, color:"#0A192F", whiteSpace:"nowrap"}}>{v}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{display:"flex", gap:"10px", marginTop:"8px", padding:"0 6px"}}>
        {labels.map(function(l,i){ return <span key={i} style={{flex:1, textAlign:"center", fontSize:"10px", fontWeight:700, color:"#94A3B8"}}>{l}</span> })}
      </div>
    </div>
  )
}

function OverviewPage(props){
  var onNav = props.onNav;
  var stats = props.stats || {};
  var [analytics, setAnalytics] = useState(null);
  var [loading, setLoading] = useState(true);

  useEffect(function(){
    fetch(API + "/admin/analytics?range=6M").then(r=>r.json()).then(d=>{ setAnalytics(d); setLoading(false); }).catch(()=> setLoading(false));
  },[]);

  // REAL from /api/admin/analytics - fallback to stats from dashboard if analytics fails
  var monthly = analytics?.monthly || analytics?.data || [];
  var revenue = monthly.length ? monthly.map(function(m){ return Number(m.income || m.revenue || 0); }) : [0,0,0,0,0,0];
  var bookingsArr = monthly.length ? monthly.map(function(m){ return Number(m.bookings || 0); }) : [0,0,0,0,0,0];
  var revLabels = monthly.length ? monthly.map(function(m){ return m.month || m.label || ""; }) : ["Jan","Feb","Mar","Apr","May","Jun"];
  var totalRevenue = analytics?.totals?.income ?? analytics?.totalIncome ?? stats.revenue ?? 0;
  var totalOwners = analytics?.totals?.owners ?? stats.owners ?? 0;
  var totalWorkshops = analytics?.totals?.workshops ?? stats.workshops ?? 0;
  var totalBookings = analytics?.totals?.bookings ?? stats.bookings ?? 0;

  return (
    <div style={{display:"grid", gap:"14px"}}>
      <div style={{background:"#0A192F", borderRadius:"18px", padding:"20px", color:"#fff", display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:"12px"}}>
        <div>
          <div style={{fontWeight:900, fontSize:"22px"}}>Ayinde Team Console - LA - BAR - PST</div>
          <div style={{color:"#94A3B8", fontSize:"13px", marginTop:"6px"}}>Zero commission • 112 S Market St Inglewood CA • $ USD {loading ? "• Loading DB..." : "• Live DB"}</div>
        </div>
        <div style={{background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:"12px", padding:"10px 14px", fontSize:"12px", color:"#CBD5E1"}}>BAR Verified {stats.verified || "—"}/{totalWorkshops || "—"}</div>
      </div>
      <div className="row g-3" style={{margin:0, width:"100%"}}>
        <div className="col-6 col-lg-3"><div onClick={function(){onNav("owners")}} style={{background:"#0A192F", border:"1.5px solid #E2E8F0", borderRadius:"16px", padding:"16px", cursor:"pointer"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>Owners</div><div style={{fontSize:"26px", fontWeight:900, color:"#fff"}}>{Number(totalOwners).toLocaleString()}</div></div></div>
        <div className="col-6 col-lg-3"><div onClick={function(){onNav("workshops")}} style={{background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:"16px", padding:"16px", cursor:"pointer"}}><div style={{fontSize:"11px", fontWeight:800, color:"#6B7A90"}}>Workshops</div><div style={{fontSize:"26px", fontWeight:900, color:"#0A192F"}}>{Number(totalWorkshops).toLocaleString()}</div></div></div>
        <div className="col-6 col-lg-3"><div onClick={function(){onNav("bookings")}} style={{background:"#EFF6FF", border:"1.5px solid #E2E8F0", borderRadius:"16px", padding:"16px", cursor:"pointer"}}><div style={{fontSize:"11px", fontWeight:800, color:"#6B7A90"}}>Bookings Total</div><div style={{fontSize:"26px", fontWeight:900, color:"#1E40AF"}}>{Number(totalBookings).toLocaleString()}</div></div></div>
        <div className="col-6 col-lg-3"><div onClick={function(){onNav("incomes")}} style={{background:"#DCFCE7", border:"1.5px solid #E2E8F0", borderRadius:"16px", padding:"16px", cursor:"pointer"}}><div style={{fontSize:"11px", fontWeight:800, color:"#6B7A90"}}>Revenue (Total)</div><div style={{fontSize:"26px", fontWeight:900, color:"#166534"}}>${Number(totalRevenue).toLocaleString()}</div></div></div>
      </div>
      <div className="row g-3" style={{margin:0, width:"100%"}}>
        <div className="col-lg-8"><div style={{background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:"18px", padding:"16px"}}><div style={{fontWeight:900, fontSize:"14px", marginBottom:"10px"}}>Revenue Trend • Last 6 Months • DB</div><BarChart data={revenue} labels={revLabels} color="#0A192F" /></div></div>
        <div className="col-lg-4"><div style={{background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:"18px", padding:"16px", height:"100%"}}><div style={{fontWeight:900, fontSize:"14px"}}>Bookings • Last 6 Months • DB</div><BarChart data={bookingsArr} labels={revLabels} color="#3B82F6" /><div style={{fontSize:"12px", color:"#64748B", marginTop:"10px", textAlign:"center"}}>Monthly $40 / $100 / $300 • Zero commission</div></div></div>
      </div>
    </div>
  );
}