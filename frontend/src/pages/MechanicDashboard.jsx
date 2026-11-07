import { useState, useEffect, useRef } from "react";
import MechanicBookingsPage from "./MechanicBookingsPage";
import MechanicJobsPage from "./MechanicJobsPage";
import MechanicPaymentsPage from "./MechanicPaymentsPage";
import MechanicExpensesPage from "./MechanicExpensesPage";
import MechanicBookkeepingPage from "./MechanicBookkeepingPage";
import MechanicCustomersPage from "./MechanicCustomersPage";
import MechanicReviewsPage from "./MechanicReviewsPage";
import MechanicTeamPage from "./MechanicTeamPage";
import MechanicSettingsPage from "./MechanicSettingsPage";
import MechanicSubscriptionPage from "./MechanicSubscriptionPage";
import MechanicHelpPage from "./MechanicHelpPage";

const API = "http://127.0.0.1:5000/api";

const MENU = [
  { id:"dashboard", label:"Dashboard", icon:"bi-speedometer2", desc:"Overview • P/L" },
  { id:"bookings", label:"Bookings", icon:"bi-calendar-check", desc:"New requests" },
  { id:"jobs", label:"Jobs", icon:"bi-tools", desc:"In progress" },
  { id:"payments", label:"Payments", icon:"bi-credit-card", desc:"Income log" },
  { id:"expenses", label:"Expenses", icon:"bi-receipt", desc:"Audit locked" },
  { id:"bookkeeping", label:"Bookkeeping", icon:"bi-journal-text", desc:"P/L + audit" },
  { id:"customers", label:"Customers", icon:"bi-people", desc:"Booked & done" },
  { id:"reviews", label:"Reviews", icon:"bi-star", desc:"Read-only + lazy" },
  { id:"team", label:"Team & Specialty", icon:"bi-people-fill", desc:"Members + areas" },
  { id:"subscription", label:"Subscription", icon:"bi-gem", desc:"Plan + receipts" },
  { id:"settings", label:"Settings", icon:"bi-gear", desc:"Profile + BAR + specs" },
  { id:"workshop-help", label:"Help Center", icon:"bi-life-preserver", desc:"Guide • BAR • tips" },
];

function calcDaysLeft(endDateStr){
  if(!endDateStr) return 0;
  const end = new Date(String(endDateStr).slice(0,10) + "T23:59:59");
  return Math.max(0, Math.ceil((end - new Date())/(1000*60*60*24)));
}
function getActiveFromPath(){
  const path = window.location.pathname.replace(/\/+$/,"");
  const last = path.split("/").pop();
  if(MENU.some(m=>m.id===last)) return last;
  if(path.startsWith("/mechanic-workshop/")) return last && last!=="mechanic-workshop" ? last : "dashboard";
  return localStorage.getItem("mech_activePage") || "dashboard";
}
function normalizeSubscription(s){
  if(!s) return null;
  const raw = String(s.plan || s.planName || "Trial").trim().toLowerCase();
  const plan = raw === "monthly" ? "Monthly" : raw === "quarterly" ? "Quarterly" : raw === "annual" ? "Annual" : "Trial";
  const price = plan === "Trial" ? 0 : Number(s.amount ?? s.price ?? (plan==="Monthly" ? 40 : plan==="Quarterly" ? 100 : plan==="Annual" ? 300 : 0));
  const end = s.end_date || s.endDate || s.renewalDate || "";
  const start = s.start_date || s.startDate || "";
  const endStr = String(end).slice(0,10);
  const startStr = String(start).slice(0,10);
  const daysRemaining = calcDaysLeft(endStr);
  let statusRaw = String(s.status || "").toLowerCase();
  let status = statusRaw === "trial" || statusRaw === "trialing" ? "Trialing" : statusRaw === "active" ? "Active" : statusRaw === "expired" ? "Expired" : statusRaw === "cancelled" || statusRaw === "canceled" ? "Cancelled" : statusRaw ? (statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1)) : "Trialing";
  if (endStr && daysRemaining === 0 && new Date(endStr + "T23:59:59") < new Date() && status !== "Cancelled") status = "Expired";
  return {
    id: s.id, planId: plan.toLowerCase(), planName: plan, price,
    period: plan==="Monthly" ? "1 month" : plan==="Quarterly" ? "3 months" : plan==="Annual" ? "12 months" : "7 days",
    status, startDate: startStr, endDate: endStr, renewalDate: endStr, daysRemaining,
    autoRenew: s.auto_renew ?? s.autoRenew ?? (plan === "Trial" ? false : true),
    paymentMethod: s.payment_method || s.paymentMethod || (plan === "Trial" ? "Free Trial" : ""),
    billingEmail: s.billing_email || s.billingEmail || "",
  };
}
function pickBestSubscription(list){
  if(!list || !list.length) return null;
  const sorted = [...list].sort((a,b) => Number(b.id || 0) - Number(a.id || 0));
  const active = sorted.find(x => ["active","trial","trialing"].includes(String(x.status || "").toLowerCase()));
  return active || sorted[0];
}
function getStoredUser(){ try{ return JSON.parse(localStorage.getItem("autoville_user")||"{}"); }catch{ return {}; } }
function getStoredSubscription(){
  try{
    const fromLogin = JSON.parse(localStorage.getItem("autoville_subscription") || "null");
    if (fromLogin) return normalizeSubscription(fromLogin);
    const fromElite = JSON.parse(localStorage.getItem("elite_workshop_subscription") || "null");
    if (fromElite) return normalizeSubscription(fromElite);
    const u = getStoredUser();
    if (u.subscription) return normalizeSubscription(u.subscription);
    if (u.plan) return normalizeSubscription({ plan: u.plan, status: u.subscription_status || "trial", end_date: u.subscription_end });
  }catch{}
  return null;
}
function parseList(data){
  if(Array.isArray(data)) return data;
  if(!data || typeof data !== "object") return [];
  return data.subscriptions || data.bookings || data.jobs || data.reviews || data.expenses || data.payments || data.incomes || data.data || data.items || [];
}
async function fetchJson(url){
  try{
    const res = await fetch(url);
    const data = await res.json().catch(()=> ({}));
    return { ok: res.ok, data };
  }catch{ return { ok: false, data: null }; }
}

export default function MechanicDashboard({ changeView }) {
  const [activePage, setActivePage] = useState(()=> getActiveFromPath());
  const [showSidebar, setShowSidebar] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(()=> getStoredUser());
  const [workshop, setWorkshop] = useState(null);
  const [subscription, setSubscription] = useState(()=> getStoredSubscription());
  const [stats, setStats] = useState({ totalBookings:0, newBookings:0, activeJobs:0, revenueMonth:0, expensesMonth:0, profitMonth:0, avgRating:0, reviewCount:0, teamTotal:0 });

  function applySubscription(raw){
    const norm = raw ? normalizeSubscription(raw) : null;
    if (norm) {
      setSubscription(norm);
      localStorage.setItem("elite_workshop_subscription", JSON.stringify(raw));
      localStorage.setItem("autoville_subscription", JSON.stringify(raw));
      try{
        const u = getStoredUser();
        localStorage.setItem("autoville_user", JSON.stringify({ ...u, plan: norm.planName, subscription_status: norm.status.toLowerCase(), subscription_end: norm.endDate, subscription: raw }));
      }catch{}
    }
    return norm;
  }

  async function fetchDashboard(){
    const u = getStoredUser();
    const workshopId = u.id || u.workshop_id || u.workshopId;
    if(!workshopId){
      setLoading(false);
      if(changeView) changeView("auth");
      return;
    }
    setUser(u);
    setLoading(true);
    try{
      const main = await fetchJson(`${API}/workshops/${workshopId}/dashboard`);
      if(main.ok && main.data && main.data.success){
        const w = main.data.workshop || {};
        setWorkshop(w);
        setUser(prev=>({...prev, business_name: w.business_name || w.name || prev.business_name, name: w.business_name || w.name || prev.name, email: w.email || prev.email, phone: w.phone || prev.phone, address: w.address || prev.address, verified: w.verified ?? prev.verified }));
        let subApplied = null;
        if(main.data.subscription) subApplied = applySubscription(main.data.subscription);
        if(main.data.stats) setStats(main.data.stats);
        if(!subApplied){
          const sRes = await fetchJson(`${API}/subscriptions?workshop_id=${workshopId}`);
          const best = pickBestSubscription(parseList(sRes.data));
          if(best) applySubscription(best);
          else setSubscription(null);
        }
        setLoading(false);
        return;
      }
      const [wRes, sRes, bRes, jRes, rRes, incRes, expRes] = await Promise.all([
        fetchJson(`${API}/workshops/${workshopId}`),
        fetchJson(`${API}/subscriptions?workshop_id=${workshopId}`),
        fetchJson(`${API}/bookings?workshop_id=${workshopId}`),
        fetchJson(`${API}/bookings/jobs?workshop_id=${workshopId}`),
        fetchJson(`${API}/reviews?workshop_id=${workshopId}`),
        fetchJson(`${API}/workshops/${workshopId}/incomes`),
        fetchJson(`${API}/workshops/${workshopId}/expenses`),
      ]);
      const w = (wRes.data && (wRes.data.workshop || wRes.data)) || {};
      if(w && w.id) {
        setWorkshop(w);
        setUser(prev=>({...prev, business_name: w.business_name || w.name || prev.business_name, email: w.email || prev.email, phone: w.phone || prev.phone, address: w.address || prev.address, verified: w.verified ?? prev.verified }));
      }
      const best = pickBestSubscription(parseList(sRes.data));
      if(best) applySubscription(best);
      else setSubscription(null);
      const bookings = parseList(bRes.data);
      const jobs = parseList(jRes.data);
      const reviews = parseList(rRes.data);
      const incomes = parseList(incRes.data);
      const expenses = parseList(expRes.data);
      const now = new Date();
      const inThisMonth = (d)=>{ if(!d) return false; const dt = new Date(d); return dt.getFullYear()===now.getFullYear() && dt.getMonth()===now.getMonth(); };
      const revenueMonth = incomes.reduce((s,x)=> s + (inThisMonth(x.created_at || x.date || x.receipt_date) ? Number(x.amount||0) : 0), 0);
      const expensesMonth = expenses.reduce((s,x)=> s + (inThisMonth(x.created_at || x.date) ? Number(x.amount||0) : 0), 0);
      const avg = reviews.length ? reviews.reduce((s,x)=> s + Number(x.rating||0),0)/reviews.length : 0;
      setStats({
        totalBookings: bookings.length,
        newBookings: bookings.filter(b=> ["pending","new","requested"].includes(String(b.status||"").toLowerCase())).length,
        activeJobs: jobs.filter(j=> ["in_progress","accepted","in-progress","ongoing","in progress","diagnosing","diagnostics"].includes(String(j.status||"").toLowerCase())).length,
        revenueMonth, expensesMonth, profitMonth: revenueMonth - expensesMonth,
        avgRating: Math.round(avg*10)/10, reviewCount: reviews.length, teamTotal: 0,
      });
    }catch(e){ console.log("Dashboard fetch failed", e); }
    setLoading(false);
  }

  useEffect(()=>{
    setActivePage(getActiveFromPath());
    fetchDashboard();
    const onPop = ()=> setActivePage(getActiveFromPath());
    window.addEventListener("popstate", onPop);
    const handleClickOutside = (e)=>{ if(profileRef.current && !profileRef.current.contains(e.target)) setShowProfileMenu(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return ()=>{ window.removeEventListener("popstate", onPop); document.removeEventListener("mousedown", handleClickOutside); };
    // eslint-disable-next-line
  },[]);

  const daysLeft = calcDaysLeft(subscription?.endDate);
  const totalDays = subscription?.planName==="Monthly" ? 30 : subscription?.planName==="Quarterly" ? 90 : subscription?.planName==="Annual" ? 365 : 7;
  const subProgress = subscription ? Math.min(100, Math.max(5, (daysLeft / totalDays)*100)) : 0;
  const subColor = subscription?.status==="Active" ? "#22C55E" : subscription?.status==="Trialing" ? "#3B82F6" : "#EF4444";
  const workshopName = workshop?.business_name || workshop?.name || user?.business_name || user?.full_name || user?.name || "Workshop";
  const workshopAddress = workshop?.address || user?.address || "112 S Market St, Ste 1008, Inglewood, CA 90301";
  const workshopEmail = workshop?.email || user?.email || "";
  const workshopId = workshop?.id || user?.id;

  const handleNav = (id)=>{
    setActivePage(id);
    localStorage.setItem("mech_activePage", id);
    setShowSidebar(false);
    setShowProfileMenu(false);
    window.scrollTo(0,0);
    const path = id==="dashboard" ? "/mechanic-workshop/dashboard" : `/mechanic-workshop/${id}`;
    window.history.pushState({}, "", path);
    if(id === "dashboard" || id === "subscription") fetchDashboard();
  };

  const handleLogout = async ()=>{
    const u = getStoredUser();
    try{ await fetch(`${API}/auth/logout/workshop`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ email: u.email || "", workshop_id: u.id }) }); }catch{}
    localStorage.removeItem("autoville_user");
    localStorage.removeItem("autoville_subscription");
    localStorage.removeItem("av_owner_theme");
    localStorage.removeItem("mech_activePage");
    localStorage.removeItem("elite_workshop_subscription");
    sessionStorage.clear();
    document.cookie.split(";").forEach(c=>{ const n=c.split("=")[0].trim(); if(n) document.cookie = n+"=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"; });
    if(changeView) changeView("landing");
    else { window.history.pushState({}, "", "/"); window.location.reload(); }
  };

  const renderContent = ()=>{
    switch(activePage){
      case "bookings": return <MechanicBookingsPage workshopId={workshopId} workshop={workshop} />;
      case "jobs": return <MechanicJobsPage workshopId={workshopId} workshop={workshop} />;
      case "payments": return <MechanicPaymentsPage workshopId={workshopId} workshop={workshop} />;
      case "expenses": return <MechanicExpensesPage workshopId={workshopId} workshop={workshop} />;
      case "bookkeeping": return <MechanicBookkeepingPage workshopId={workshopId} workshop={workshop} />;
      case "customers": return <MechanicCustomersPage workshopId={workshopId} workshop={workshop} />;
      case "reviews": return <MechanicReviewsPage workshopId={workshopId} workshop={workshop} />;
      case "team": return <MechanicTeamPage workshopId={workshopId} workshop={workshop} />;
      case "subscription": return <MechanicSubscriptionPage workshopId={workshopId} workshop={workshop} subscription={subscription} onRefresh={fetchDashboard} />;
      case "settings": return <MechanicSettingsPage workshopId={workshopId} workshop={workshop} onRefresh={fetchDashboard} />;
      case "workshop-help": return <MechanicHelpPage workshopId={workshopId} />;
      default: return <DashboardHome onNav={handleNav} sub={subscription} daysLeft={daysLeft} subProgress={subProgress} subColor={subColor} totalDays={totalDays} workshopName={workshopName} workshopAddress={workshopAddress} workshopEmail={workshopEmail} workshop={workshop} stats={stats} loading={loading} />;
    }
  };

  return (
    <>
    <style>{`
      .mech-layout{ display:flex; min-height:100vh; background:#F8FAFC; width:100%; overflow-x:hidden; }
      .mech-sidebar{ width:300px; background:#0A192F; color:#fff; display:flex; flex-direction:column; position:fixed; top:0; left:0; bottom:0; z-index:30; border-right:1.5px solid #0A192F; }
      .mech-sidebar-scroll{ flex:1; overflow-y:auto; overflow-x:hidden; padding:12px; }
      .mech-sidebar-scroll::-webkit-scrollbar{ width:8px; } .mech-sidebar-scroll::-webkit-scrollbar-track{ background:#0A192F; } .mech-sidebar-scroll::-webkit-scrollbar-thumb{ background:#1E3A5F; border-radius:8px; }
      .mech-main{ flex:1; margin-left:300px; min-width:0; width:calc(100% - 300px); display:flex; flex-direction:column; }
      .mech-topbar{ height:72px; min-height:72px; background:#fff; border-bottom:1.5px solid #E2E8F0; display:flex; align-items:center; justify-content:space-between; padding:0 18px; gap:12px; position:sticky; top:0; z-index:20; width:100%; box-sizing:border-box; }
      .mech-content{ padding:18px; flex:1; min-width:0; width:100%; max-width:100%; box-sizing:border-box; overflow-x:hidden; }
      .mech-nav-item{ width:100%; height:54px; border-radius:12px; border:1px solid transparent; background:transparent; color:#94A3B8; display:flex; align-items:center; gap:12px; padding:0 14px; font-weight:700; font-size:14px; text-align:left; transition:0.2s; cursor:pointer; }
      .mech-nav-item:hover{ background:rgba(255,255,255,0.06); color:#fff; }
      .mech-nav-item.active{ background:#fff; color:#0A192F; box-shadow:0 4px 14px rgba(0,0,0,0.15); }
      .mech-nav-item.help{ background:rgba(59,130,246,0.12); border-color:rgba(59,130,246,0.22); color:#93C5FD; }
      .mech-nav-item.help:hover{ background:rgba(59,130,246,0.18); color:#BFDBFE; }
      .mech-nav-item.help.active{ background:#EFF6FF; color:#1E40AF; border-color:#3B82F6; }
      .mech-avatar{ width:42px; height:42px; border-radius:12px; object-fit:cover; border:2px solid #0A192F; flex-shrink:0; }
      .mech-badge-verified{ font-size:11px; font-weight:800; background:#DCFCE7; color:#166534; border:1px solid #BBF7D0; padding:5px 10px; border-radius:20px; display:inline-flex; align-items:center; gap:6px; white-space:nowrap; }
      .sub-indicator{ background:linear-gradient(135deg, rgba(59,130,246,0.18), rgba(255,255,255,0.06)); border:1.5px solid rgba(59,130,246,0.35); border-radius:16px; padding:14px; margin:10px 0; }
      .sub-indicator-track{ height:10px; background:rgba(255,255,255,0.14); border-radius:20px; overflow:hidden; margin-top:10px; }
      .profile-drop{ position:absolute; top:calc(100% + 10px); right:0; width:300px; background:#fff; border:1.5px solid #E2E8F0; border-radius:16px; box-shadow:0 16px 40px rgba(10,25,47,0.14); padding:10px; z-index:60; animation: dropIn 0.18s ease; }
      @keyframes dropIn{ from{ opacity:0; transform: translateY(-8px);} to{ opacity:1; transform: translateY(0);} }
      .profile-drop-item{ width:100%; height:44px; border-radius:10px; border:1px solid transparent; background:transparent; display:flex; align-items:center; gap:10px; padding:0 12px; font-weight:700; font-size:13px; color:#0A192F; cursor:pointer; text-align:left; }
      .profile-drop-item:hover{ background:#F8FAFC; border-color:#E2E8F0; }
      @media(max-width: 991px){ .mech-sidebar{ transform: translateX(-100%); transition: transform 0.3s; } .mech-sidebar.open{ transform: translateX(0); } .mech-main{ margin-left:0; width:100%; } .mech-topbar{ height:auto; min-height:68px; flex-wrap:wrap; padding:10px 12px; } .mech-content{ padding:12px; } .profile-drop{ width:280px; right:-6px; } }
    `}</style>

    <div className="mech-layout">
      <aside className={`mech-sidebar ${showSidebar ? "open" : ""}`}>
        <div style={{padding:"16px 14px 12px", borderBottom:"1.5px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", gap:"12px"}}>
          <img src="../img/logo-trans.png" alt="AutoVille" onError={e=>{ e.currentTarget.src="img/logo-trans.png"; }} style={{width:"42px", height:"42px", borderRadius:"10px", objectFit:"contain", background:"#fff", padding:"4px"}} />
          <div style={{minWidth:0}}><div style={{fontWeight:900, fontSize:"16px", color:"#fff", lineHeight:1.1}}>AutoVille</div><div style={{fontSize:"12px", color:"#94A3B8", fontWeight:600}}>{workshopName} • {workshop?.verified ? "BAR Verified" : "BAR Pending"}</div></div>
          <button onClick={()=>setShowSidebar(false)} className="d-lg-none ms-auto" style={{width:"36px", height:"36px", borderRadius:"10px", border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.06)", color:"#fff"}}><i className="bi bi-x-lg"></i></button>
        </div>

        <div className="mech-sidebar-scroll">
          <div style={{fontSize:"11px", fontWeight:800, color:"#64748B", letterSpacing:"0.06em", margin:"8px 6px 10px"}}>WORKSHOP MENU • MECHANIC</div>
          <div style={{display:"grid", gap:"8px"}}>
            {MENU.map(m=>(
              <button key={m.id} onClick={()=>handleNav(m.id)} className={`mech-nav-item ${m.id==="workshop-help" ? "help" : ""} ${activePage===m.id ? "active" : ""}`}>
                <i className={`bi ${m.icon}`} style={{fontSize:"18px", width:"22px", textAlign:"center"}}></i>
                <span style={{flex:1, minWidth:0}}><span style={{display:"block", lineHeight:1.1}}>{m.label}</span><span style={{display:"block", fontSize:"11px", fontWeight:500, opacity:0.8, lineHeight:1.1, marginTop:"2px"}}>{m.desc}</span></span>
                {m.id==="subscription" && subscription && <span style={{fontSize:"11px", fontWeight:900, background:subColor, color:"#fff", padding:"4px 8px", borderRadius:"20px", whiteSpace:"nowrap"}}>{subscription.planName} • {daysLeft}d</span>}
                {m.id==="workshop-help" && <span style={{fontSize:"10px", fontWeight:800, background:"#3B82F6", color:"#fff", padding:"3px 7px", borderRadius:"10px"}}>GUIDE</span>}
                {m.id==="team" && <span style={{fontSize:"10px", fontWeight:800, background:"#22C55E", color:"#fff", padding:"3px 7px", borderRadius:"10px"}}>NEW</span>}
              </button>
            ))}
          </div>

          {/* 1. SIDEBAR - SUBSCRIPTION STATUS - BIG, ALWAYS VISIBLE */}
          <div className="sub-indicator">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span style={{fontSize:'11px', fontWeight:900, color:'#BFDBFE', letterSpacing:'0.05em'}}><i className="bi bi-gem me-1"></i>YOUR SUBSCRIPTION</span>
              <span style={{width:'10px', height:'10px', borderRadius:'50%', background:subColor, display:'inline-block', boxShadow:`0 0 10px ${subColor}`}}></span>
            </div>
            {loading && !subscription ? (
              <div style={{marginTop:'12px', color:'#BFDBFE', fontSize:'13px', fontWeight:700}}>Checking subscription...</div>
            ) : subscription ? (
              <>
                <div style={{display:'flex', alignItems:'flex-end', gap:'10px', marginTop:'12px'}}>
                  <div style={{fontSize:'42px', fontWeight:900, color:'#fff', lineHeight:1}}>{daysLeft}</div>
                  <div style={{paddingBottom:'6px'}}>
                    <div style={{fontSize:'13px', fontWeight:900, color:'#fff', lineHeight:1}}>days left</div>
                    <div style={{fontSize:'11px', color:'#BFDBFE', marginTop:'2px'}}>of {totalDays}-day {subscription.planName}</div>
                  </div>
                  <span style={{marginLeft:'auto', marginBottom:'6px', fontSize:'11px', fontWeight:900, background: subscription.status==="Active" ? '#DCFCE7' : subscription.status==="Trialing" ? '#EFF6FF' : '#FEE2E2', color: subscription.status==="Active" ? '#166534' : subscription.status==="Trialing" ? '#1E40AF' : '#991B1B', padding:'5px 9px', borderRadius:'20px'}}>{subscription.status}</span>
                </div>
                <div style={{marginTop:'10px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <span style={{fontWeight:900, fontSize:'16px', color:'#fff'}}>{subscription.planName} • ${subscription.price}</span>
                  <span style={{fontSize:'11px', color:'#94A3B8'}}>{subscription.period}</span>
                </div>
                <div style={{fontSize:'11px', color:'#94A3B8', marginTop:'4px'}}>{subscription.startDate} → Renews {subscription.renewalDate} PST • Auto-renew {subscription.autoRenew ? 'ON' : 'OFF'}</div>
                <div className="sub-indicator-track"><div style={{width:`${subProgress}%`, height:"100%", background: daysLeft<=2 ? '#EF4444' : daysLeft<=5 ? '#F59E0B' : '#22C55E'}}></div></div>
                <div style={{display:'flex', justifyContent:'space-between', marginTop:'6px', fontSize:'11px', fontWeight:700}}>
                  <span style={{color: daysLeft<=2 ? '#FCA5A5' : '#BBF7D0'}}><i className="bi bi-clock me-1"></i>{daysLeft} days left before renewal</span>
                  <span style={{color:'#94A3B8'}}>{subProgress.toFixed(0)}% left</span>
                </div>
                <button onClick={()=>handleNav("subscription")} style={{marginTop:'12px', width:'100%', height:'40px', borderRadius:'10px', background:'#fff', color:'#0A192F', border:'none', fontWeight:900, fontSize:'12px'}}><i className="bi bi-eye me-1"></i>View Plan • Receipts • Renew</button>
              </>
            ) : (
              <>
                <div style={{marginTop:'12px', fontWeight:900, fontSize:'16px', color:'#FCA5A5'}}>No Active Subscription</div>
                <div style={{fontSize:'12px', color:'#94A3B8', marginTop:'4px'}}>Start your 7-day free trial to unlock bookings.</div>
                <button onClick={()=>handleNav("subscription")} style={{marginTop:'10px', width:'100%', height:'40px', borderRadius:'10px', background:'#FBBF24', color:'#0A192F', border:'none', fontWeight:900, fontSize:'12px'}}><i className="bi bi-gem me-1"></i>Subscribe Now • Free Trial</button>
              </>
            )}
          </div>

          <div style={{marginTop:"12px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"14px", padding:"12px"}}>
            <div style={{fontSize:"12px", fontWeight:800, color:"#fff"}}><i className="bi bi-shield-check me-1" style={{color:"#22C55E"}}></i>BAR Compliant • Audit</div>
            <div style={{fontSize:"11px", color:"#94A3B8", lineHeight:1.5, marginTop:"6px"}}>{workshopAddress} • PST • $ USD • Help Center now in sidebar</div>
          </div>
        </div>

        <div style={{padding:"12px", borderTop:"1.5px solid rgba(255,255,255,0.08)", background:"#0A192F"}}>
          {subscription && <div style={{background:"rgba(255,255,255,0.06)", borderRadius:"10px", padding:"8px 10px", marginBottom:"10px", display:"flex", justifyContent:"space-between", fontSize:"11px"}}><span style={{color:"#94A3B8"}}><span style={{width:"6px", height:"6px", borderRadius:"50%", background:subColor, display:"inline-block", marginRight:"6px"}}></span>{subscription.planName} • {subscription.status}</span><span style={{fontWeight:800, color: daysLeft<=2?"#FCA5A5":"#BBF7D0"}}>{daysLeft}d left</span></div>}
          <button onClick={handleLogout} style={{width:"100%", height:"46px", borderRadius:"12px", border:"1.5px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.06)", color:"#fff", fontWeight:800, fontSize:"14px"}}><i className="bi bi-box-arrow-left me-2"></i>Logout • Workshop</button>
        </div>
      </aside>

      <div className="mech-main">
        <div className="mech-topbar">
          <div style={{display:"flex", alignItems:"center", gap:"12px", minWidth:0, flex:1}}>
            <button onClick={()=>setShowSidebar(true)} className="d-lg-none" style={{width:"44px", height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", background:"#fff", flexShrink:0}}><i className="bi bi-list"></i></button>
            <div style={{minWidth:0, flex:1}}>
              <div style={{display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap"}}><span style={{fontWeight:900, fontSize:"18px", color:"#0A192F", lineHeight:1}}>{MENU.find(m=>m.id===activePage)?.label || "Dashboard"}</span>{workshop?.verified ? <span className="mech-badge-verified"><i className="bi bi-patch-check-fill"></i>BAR VERIFIED</span> : <span style={{fontSize:"11px", fontWeight:800, background:"#FEF3C7", color:"#92400E", padding:"5px 10px", borderRadius:"20px"}}>BAR PENDING</span>}</div>
              <div className="d-none d-md-block" style={{fontSize:"12px", color:"#6B7A90", fontWeight:500, marginTop:"2px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>AutoVille Workshop • {workshopAddress} • {subscription ? `${subscription.planName} • ${daysLeft}d left` : 'No subscription'}</div>
            </div>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:"10px", flexShrink:0}}>
            {/* 2. TOPBAR - SUBSCRIPTION PILL - NOW VISIBLE ON MOBILE TOO */}
            {subscription ? (
              <button onClick={()=>handleNav("subscription")} style={{display:"flex", alignItems:"center", gap:"8px", background: daysLeft<=2 ? '#FEF2F2' : daysLeft<=5 ? '#FFFBEB' : '#F0FDF4', border:`1.5px solid ${daysLeft<=2 ? '#FECACA' : daysLeft<=5 ? '#FDE68A' : '#BBF7D0'}`, padding:"7px 12px", borderRadius:"20px", whiteSpace:"nowrap", cursor:"pointer"}}>
                <span style={{width:'9px', height:'9px', borderRadius:'50%', background:subColor, display:"inline-block"}}></span>
                <span style={{fontSize:"12px", fontWeight:900, color: daysLeft<=2 ? '#991B1B' : daysLeft<=5 ? '#92400E' : '#166534'}}>{subscription.planName} • {subscription.status} • {daysLeft}d left</span>
                <i className="bi bi-chevron-right" style={{fontSize:"11px", color:"#64748B"}}></i>
              </button>
            ) : (
              <button onClick={()=>handleNav("subscription")} style={{display:"flex", alignItems:"center", gap:"6px", background:"#FEF2F2", border:"1.5px solid #FECACA", padding:"7px 12px", borderRadius:"20px", whiteSpace:"nowrap", cursor:"pointer", fontSize:"12px", fontWeight:900, color:"#991B1B"}}><i className="bi bi-exclamation-triangle"></i>No Subscription</button>
            )}
            <div ref={profileRef} style={{position:"relative"}}>
              <button onClick={()=>setShowProfileMenu(!showProfileMenu)} style={{display:"flex", alignItems:"center", gap:"10px", border:"1.5px solid #E2E8F0", background:"#fff", borderRadius:"14px", padding:"4px 8px 4px 4px", cursor:"pointer"}}>
                <img src="../img/usericon.png" alt="" onError={e=>{e.currentTarget.src="img/usericon.png";}} className="mech-avatar" />
                <div className="d-none d-sm-block" style={{textAlign:"left", minWidth:0}}><div style={{fontWeight:800, fontSize:"13px", color:"#0A192F", whiteSpace:"nowrap"}}>{workshopName}</div><div style={{fontSize:"11px", color:"#6B7A90", whiteSpace:"nowrap"}}>{subscription ? `${subscription.planName} • ${daysLeft}d left` : workshopEmail}</div></div>
                <i className={`bi bi-chevron-${showProfileMenu?"up":"down"}`} style={{color:"#64748B"}}></i>
              </button>
              {showProfileMenu && (
                <div className="profile-drop">
                  <div style={{padding:"10px", display:"flex", gap:"10px", alignItems:"center", borderBottom:"1.5px solid #F1F5F9", marginBottom:"8px"}}>
                    <img src="../img/usericon.png" alt="" onError={e=>{e.currentTarget.src="img/usericon.png";}} className="mech-avatar" style={{width:"46px", height:"46px"}} />
                    <div style={{minWidth:0, flex:1}}>
                      <div style={{fontWeight:900, fontSize:"14px", color:"#0A192F"}}>{workshopName}</div>
                      <div style={{fontSize:"12px", color:"#64748B", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{workshopEmail}</div>
                      <div style={{marginTop:"4px", display:"flex", gap:"6px", flexWrap:"wrap"}}>
                        <span className="mech-badge-verified" style={{fontSize:"10px"}}><i className="bi bi-patch-check-fill"></i>{workshop?.verified ? "BAR Verified" : "BAR Pending"}</span>
                        {subscription && <span style={{fontSize:"10px", fontWeight:800, background:subColor, color:"#fff", padding:"3px 8px", borderRadius:"20px"}}>{subscription.planName} • {daysLeft}d left</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{display:"grid", gap:"4px"}}>
                    <button onClick={()=>handleNav("settings")} className="profile-drop-item"><i className="bi bi-person-gear" style={{width:"20px"}}></i> Profile Settings • BAR</button>
                    <button onClick={()=>handleNav("team")} className="profile-drop-item"><i className="bi bi-people-fill" style={{width:"20px"}}></i> Team & Specialty <span style={{marginLeft:"auto", fontSize:"10px", background:"#22C55E", color:"#fff", padding:"2px 6px", borderRadius:"8px"}}>NEW</span></button>
                    <button onClick={()=>handleNav("subscription")} className="profile-drop-item"><i className="bi bi-gem" style={{width:"20px"}}></i> Subscription • {subscription ? `${subscription.planName} • ${daysLeft}d left` : 'No subscription'} <span style={{marginLeft:"auto", width:"8px", height:"8px", borderRadius:"50%", background:subColor}}></span></button>
                    <button onClick={()=>handleNav("workshop-help")} className="profile-drop-item" style={{background:"#EFF6FF", borderColor:"#BFDBFE", color:"#1E40AF"}}><i className="bi bi-life-preserver" style={{width:"20px"}}></i> Help Center • Guide</button>
                    <div style={{height:"1px", background:"#F1F5F9", margin:"6px 0"}}></div>
                    <button onClick={handleLogout} className="profile-drop-item" style={{color:"#DC2626"}}><i className="bi bi-box-arrow-left" style={{width:"20px"}}></i> Logout Workshop</button>
                  </div>
                  <div style={{marginTop:"8px", background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:"10px", padding:"8px 10px", fontSize:"11px", color:"#64748B"}}>
                    <i className="bi bi-geo-alt me-1"></i>{workshopAddress} • PST
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mech-content">{loading && activePage==="dashboard" ? <div style={{padding:"40px", textAlign:"center", color:"#64748B"}}>Loading workshop dashboard...</div> : renderContent()}</div>
      </div>
      {showSidebar && <div onClick={()=>setShowSidebar(false)} className="d-lg-none" style={{position:"fixed", inset:0, background:"rgba(10,25,47,0.45)", zIndex:20}}></div>}
    </div>
    </>
  );
}

function DashboardHome({ onNav, sub, daysLeft, subProgress, subColor, totalDays, workshopName, workshopAddress, workshopEmail, workshop, stats, loading }){
  const fmt = (n)=> "$" + Number(n||0).toLocaleString("en-US", {minimumFractionDigits:0});
  return (
    <div style={{display:"grid", gap:"14px"}}>
      {/* 3. DASHBOARD PAGE ITSELF - SUBSCRIPTION BANNER - TOP OF PAGE */}
      {sub ? (
        <div style={{background: sub.status==="Trialing" ? "#EFF6FF" : sub.status==="Active" ? "#F0FDF4" : "#FEF2F2", border:`1.5px solid ${sub.status==="Trialing" ? "#3B82F6" : sub.status==="Active" ? "#22C55E" : "#EF4444"}`, borderRadius:"18px", padding:"18px", display:"flex", justifyContent:"space-between", gap:"16px", flexWrap:"wrap", alignItems:"center"}}>
          <div style={{display:"flex", gap:"16px", alignItems:"center", flex:1, minWidth:"260px"}}>
            <div style={{width:"64px", height:"64px", borderRadius:"16px", background: subColor, color:"#fff", display:"grid", placeItems:"center", flexShrink:0}}><i className="bi bi-gem" style={{fontSize:"28px"}}></i></div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:"11px", fontWeight:900, letterSpacing:"0.06em", color:"#64748B"}}>YOUR SUBSCRIPTION • PLAN • STATUS • DAYS REMAINING</div>
              <div style={{fontSize:"22px", fontWeight:900, color:"#0A192F", lineHeight:1.2, marginTop:"4px"}}>{sub.planName} Plan • {sub.status} • <span style={{color: subColor}}>{daysLeft} days left</span></div>
              <div style={{fontSize:"13px", color:"#475569", marginTop:"4px"}}>${sub.price} • {sub.period} • {sub.startDate} to {sub.endDate} • Renews {sub.renewalDate} PST • Auto-renew {sub.autoRenew ? 'ON' : 'OFF'} • {sub.paymentMethod || "Free Trial"}</div>
              <div style={{height:"10px", background:"#E2E8F0", borderRadius:"20px", overflow:"hidden", marginTop:"10px", maxWidth:"420px"}}><div style={{width:`${subProgress}%`, height:"100%", background: daysLeft<=2 ? '#EF4444' : daysLeft<=5 ? '#F59E0B' : '#22C55E'}}></div></div>
              <div style={{fontSize:"12px", color:"#64748B", marginTop:"5px"}}>{subProgress.toFixed(0)}% of {totalDays}-day period left • {daysLeft} of {totalDays} days remaining</div>
            </div>
          </div>
          <div style={{display:"flex", gap:"8px", flexWrap:"wrap"}}>
            <button onClick={()=>onNav("subscription")} style={{height:"46px", borderRadius:"12px", background:"#0A192F", color:"#fff", border:"none", fontWeight:900, padding:"0 18px", fontSize:"13px"}}><i className="bi bi-eye me-1"></i>View Plan & Receipts</button>
            {sub.status==="Trialing" && <button onClick={()=>onNav("subscription")} style={{height:"46px", borderRadius:"12px", background:"#22C55E", color:"#fff", border:"none", fontWeight:900, padding:"0 18px", fontSize:"13px"}}>Upgrade • $40/mo</button>}
          </div>
        </div>
      ) : (
        <div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", borderRadius:"18px", padding:"18px", display:"flex", justifyContent:"space-between", gap:"16px", flexWrap:"wrap", alignItems:"center"}}>
          <div style={{display:"flex", gap:"14px", alignItems:"center"}}>
            <div style={{width:"56px", height:"56px", borderRadius:"14px", background:"#EF4444", color:"#fff", display:"grid", placeItems:"center"}}><i className="bi bi-exclamation-triangle" style={{fontSize:"24px"}}></i></div>
            <div><div style={{fontSize:"11px", fontWeight:900, letterSpacing:"0.06em", color:"#991B1B"}}>YOUR SUBSCRIPTION</div><div style={{fontSize:"20px", fontWeight:900, color:"#0A192F", marginTop:"2px"}}>No Active Subscription</div><div style={{fontSize:"13px", color:"#475569"}}>Start your 7-day free trial to unlock bookings and jobs.</div></div>
          </div>
          <button onClick={()=>onNav("subscription")} style={{height:"46px", borderRadius:"12px", background:"#FBBF24", color:"#0A192F", border:"none", fontWeight:900, padding:"0 18px"}}><i className="bi bi-gem me-1"></i>Subscribe • Free Trial</button>
        </div>
      )}

      <div style={{background:"#0A192F", borderRadius:"18px", padding:"20px", color:"#fff", display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:"12px"}}>
        <div><div style={{fontWeight:900, fontSize:"26px"}}>{workshopName} • Dashboard {workshop?.verified ? "• BAR Verified" : "• BAR Pending"} • {sub ? `${sub.planName} • ${daysLeft}d left` : 'No Plan'}</div><div style={{color:"#94A3B8", fontSize:"14px", marginTop:"4px"}}>{workshopAddress} • AutoVille • $ USD • PST • {sub ? `Renews ${sub.renewalDate} • Auto-renew ${sub.autoRenew ? 'ON' : 'OFF'}` : 'Subscribe to appear'} • Expenses immutable • Help Center in sidebar now</div></div>
        <div style={{display:"flex", gap:"8px", flexWrap:"wrap"}}><button onClick={()=>onNav("bookings")} style={{height:"44px", borderRadius:"12px", background:"#fff", color:"#0A192F", border:"none", fontWeight:800, padding:"0 16px"}}>Bookings</button><button onClick={()=>onNav("workshop-help")} style={{height:"44px", borderRadius:"12px", background:"#3B82F6", color:"#fff", border:"none", fontWeight:800, padding:"0 16px"}}><i className="bi bi-life-preserver me-1"></i>Help Center</button><button onClick={()=>onNav("subscription")} style={{height:"44px", borderRadius:"12px", background: daysLeft<=2 ? '#EF4444' : '#22C55E', color:"#fff", border:"none", fontWeight:800, padding:"0 16px"}}><i className="bi bi-gem me-1"></i>{sub ? `${sub.planName} • ${daysLeft}d left` : 'Subscribe'}</button></div>
      </div>

      <div className="row g-3" style={{margin:0, width:"100%"}}>
        {[
          {label:"Total Bookings", value: String(stats?.totalBookings ?? 0), sub:`${stats?.newBookings ?? 0} new • LA`, icon:"bi-calendar-check", bg:"#0A192F", color:"#fff"},
          {label:"Revenue (Month)", value: fmt(stats?.revenueMonth), sub:"Income log • Payments", icon:"bi-credit-card", bg:"#fff", color:"#0A192F"},
          {label:"Expenses (Month)", value: fmt(stats?.expensesMonth), sub:"Audit locked • No delete", icon:"bi-receipt", bg:"#fff", color:"#0A192F"},
          {label:"Profit • P/L", value: fmt(stats?.profitMonth), sub:"Bookkeeping • lazy load", icon:"bi-graph-up", bg:"#DCFCE7", color:"#166534"},
          {label:"Avg Rating", value: `${stats?.avgRating ?? 0} ★`, sub:`${stats?.reviewCount ?? 0} reviews • read-only`, icon:"bi-star-fill", bg:"#FEF3C7", color:"#92400E"},
          {label:"Team Active", value: `${stats?.teamTotal ?? 0}`, sub:"Team & Specialty • NEW", icon:"bi-people-fill", bg:"#EFF6FF", color:"#1E40AF"},
        ].map((s,i)=>(
          <div key={i} className="col-md-4 col-xl-2">
            <div style={{background:s.bg, border:`1.5px solid ${s.bg==="#fff" ? "#E2E8F0" : s.bg==="#0A192F" ? "#0A192F" : s.bg==="#DCFCE7" ? "#BBF7D0" : s.bg==="#FEF3C7" ? "#FDE68A" : "#BFDBFE"}`, borderRadius:"16px", padding:"16px", height:"100%"}}>
              <div style={{display:"flex", justifyContent:"space-between"}}><i className={`bi ${s.icon}`} style={{fontSize:"20px", color:s.color=== "#fff" ? "#fff" : s.color}}></i><span style={{fontSize:"11px", fontWeight:800, background: s.color==="#fff" ? "rgba(255,255,255,0.15)" : "#0A192F", color:"#fff", padding:"4px 8px", borderRadius:"20px"}}>{s.sub.split("•")[0]}</span></div>
              <div style={{fontSize:"11px", fontWeight:800, color: s.color==="#fff" ? "#94A3B8" : "#6B7A90", marginTop:"10px"}}>{s.label.toUpperCase()}</div>
              <div style={{fontSize:"26px", fontWeight:900, color:s.color, marginTop:"4px"}}>{loading ? "..." : s.value}</div>
              <div style={{fontSize:"12px", color: s.color==="#fff" ? "#94A3B8" : "#6B7A90", marginTop:"2px"}}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3" style={{margin:0, width:"100%"}}>
        <div className="col-lg-8">
          <div style={{background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:"18px", padding:"18px"}}>
            <div style={{fontWeight:900, fontSize:"16px", color:"#0A192F", marginBottom:"12px"}}>Quick Actions • Mechanic Workshop • Help Center now in sidebar</div>
            <div className="row g-2" style={{margin:0, width:"100%"}}>
              {[
                {id:"bookings", label:"View Bookings", icon:"bi-calendar-check", desc:"New owner requests • LA"},
                {id:"jobs", label:"Active Jobs", icon:"bi-tools", desc:"In progress • Update status"},
                {id:"payments", label:"Log Payment", icon:"bi-credit-card", desc:"Income • For bookkeeping P/L"},
                {id:"expenses", label:"Log Expense", icon:"bi-receipt", desc:"Immutable • No delete • Audit"},
                {id:"bookkeeping", label:"Bookkeeping P/L", icon:"bi-journal-text", desc:"Lazy load on scroll • Filter"},
                {id:"customers", label:"Customers", icon:"bi-people", desc:"Completed / booked / progress"},
                {id:"reviews", label:"Reviews Lazy", icon:"bi-star", desc:"Read-only • 4 per scroll • No reply"},
                {id:"team", label:"Team & Specialty", icon:"bi-people-fill", desc:"Members + specialties"},
                {id:"workshop-help", label:"Help Center", icon:"bi-life-preserver", desc:"How it works • BAR • tips • LA growth"},
                {id:"subscription", label:"Subscription", icon:"bi-gem", desc:`${sub ? `${sub.planName} • ${daysLeft}d left • Renews ${sub.renewalDate}` : 'Plan + receipts • Subscribe'}`},
                {id:"settings", label:"Settings", icon:"bi-gear", desc:"Profile + BAR + specialties"},
              ].map(a=>(
                <div key={a.id} className="col-md-6">
                  <button onClick={()=>onNav(a.id)} style={{width:"100%", height:"64px", borderRadius:"12px", border: a.id==="workshop-help" ? "1.5px solid #3B82F6" : "1.5px solid #E2E8F0", background: a.id==="workshop-help" ? "#EFF6FF" : "#F8FAFC", display:"flex", alignItems:"center", gap:"12px", padding:"0 14px", textAlign:"left"}}>
                    <span style={{width:"42px", height:"42px", borderRadius:"10px", background: a.id==="workshop-help" ? "#3B82F6" : "#0A192F", color:"#fff", display:"grid", placeItems:"center"}}><i className={`bi ${a.icon}`}></i></span>
                    <span style={{flex:1, minWidth:0}}><span style={{display:"block", fontWeight:800, fontSize:"14px", color:"#0A192F"}}>{a.label}</span><span style={{display:"block", fontSize:"11px", color:"#6B7A90"}}>{a.desc}</span></span>
                    <i className="bi bi-chevron-right" style={{color:"#6B7A90"}}></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div style={{background:"#fff", border:"1.5px solid #0A192F", borderRadius:"18px", padding:"18px", height:"100%"}}>
            <div style={{fontWeight:900, fontSize:"15px", color:"#0A192F"}}>Workshop Profile • {workshopName} • {sub ? `${sub.planName} • ${daysLeft}d left` : ''}</div>
            <div style={{marginTop:"12px", fontSize:"13px", color:"#0A192F", lineHeight:1.7}}>
              <div><b>Workshop:</b> {workshopName}</div>
              <div><b>BAR:</b> {workshop?.verified ? "Verified" : "Pending Verification"}</div>
              <div><b>Address:</b> {workshopAddress}</div>
              <div><b>Phone:</b> {workshop?.phone || "—"}</div>
              <div><b>Email:</b> {workshopEmail}</div>
              {sub && <div style={{marginTop:"10px", background: daysLeft<=2 ? '#FEF2F2' : '#F0FDF4', border:`1px solid ${daysLeft<=2 ? '#FECACA' : '#BBF7D0'}`, borderRadius:"10px", padding:"10px", fontSize:"12px"}}><b>Subscription:</b> {sub.planName} • {sub.status} • {daysLeft} days left • Renews {sub.renewalDate} PST • ${sub.price} • {sub.period} • Auto-renew {sub.autoRenew ? 'ON' : 'OFF'}</div>}
              <div style={{marginTop:"10px", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:"10px", padding:"10px", fontSize:"12px", color:"#1E40AF"}}><i className="bi bi-life-preserver me-1"></i><b>Help Center:</b> Now in sidebar. Click Help Center to see full workshop guide.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}