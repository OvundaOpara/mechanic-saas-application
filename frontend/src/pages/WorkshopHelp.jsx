import { useState, useEffect, useRef } from "react";
import MechanicHelpPage from "./MechanicHelpPage";

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
  const end = new Date(endDateStr + "T23:59:59");
  return Math.max(0, Math.ceil((end - new Date())/(1000*60*60*24)));
}

export default function WorkshopHelp({ changeView }) {
  const [showSidebar, setShowSidebar] = useState(false);
  const [user, setUser] = useState({ name:"Elite Garage", email:"elite@garage.la" });
  const [subscription, setSubscription] = useState(()=>{
    const raw = localStorage.getItem("elite_workshop_subscription");
    if(raw){ try{ const s=JSON.parse(raw); return {...s, daysRemaining: calcDaysLeft(s.endDate)}; }catch{} }
    const today=new Date(); const end=new Date(); end.setDate(today.getDate()+21); const start=new Date(); start.setDate(today.getDate()-69);
    const demo = { id:"SUB-2024-ELITE-001", planId:"quarterly", planName:"Quarterly", price:100, period:"3 months", status:"Active", startDate:start.toISOString().slice(0,10), endDate:end.toISOString().slice(0,10), renewalDate:end.toISOString().slice(0,10), daysRemaining:21, autoRenew:true };
    localStorage.setItem("elite_workshop_subscription", JSON.stringify(demo)); return demo;
  });

  useEffect(()=>{
    const raw = localStorage.getItem("autoville_user");
    if(raw){ try{ setUser(JSON.parse(raw)); }catch{} }
  },[]);

  const daysLeft = calcDaysLeft(subscription?.endDate);
  const subProgress = subscription ? Math.min(100, Math.max(5, (daysLeft / (subscription.planId==="monthly"?30: subscription.planId==="quarterly"?90:365))*100)) : 0;
  const subColor = subscription?.status==="Active" ? "#22C55E" : "#3B82F6";

  const handleNav = (id)=>{
    if(id==="workshop-help") { setShowSidebar(false); return; }
    localStorage.setItem("mech_activePage", id);
    setShowSidebar(false);
    const path = id==="dashboard" ? "/mechanic-workshop/dashboard" : `/mechanic-workshop/${id}`;
    window.history.pushState({}, "", path);
    if(changeView) changeView("mechanic-dashboard");
  };
  const handleLogout = ()=>{ localStorage.removeItem("autoville_user"); if(changeView) changeView("landing"); };

  return (
    <>
    <style>{`
      .mech-layout{ display:flex; min-height:100vh; background:#F8FAFC; width:100%; overflow-x:hidden; }
      .mech-sidebar{ width:300px; background:#0A192F; color:#fff; display:flex; flex-direction:column; position:fixed; top:0; left:0; bottom:0; z-index:30; }
      .mech-sidebar-scroll{ flex:1; overflow-y:auto; padding:12px; } .mech-sidebar-scroll::-webkit-scrollbar{ width:8px; } .mech-sidebar-scroll::-webkit-scrollbar-thumb{ background:#1E3A5F; border-radius:8px; }
      .mech-main{ flex:1; margin-left:300px; min-width:0; width:calc(100% - 300px); display:flex; flex-direction:column; }
      .mech-topbar{ height:72px; min-height:72px; background:#fff; border-bottom:1.5px solid #E2E8F0; display:flex; align-items:center; justify-content:space-between; padding:0 18px; position:sticky; top:0; z-index:20; }
      .mech-content{ padding:18px; flex:1; min-width:0; width:100%; box-sizing:border-box; overflow-x:hidden; }
      .mech-nav-item{ width:100%; height:54px; border-radius:12px; border:1px solid transparent; background:transparent; color:#94A3B8; display:flex; align-items:center; gap:12px; padding:0 14px; font-weight:700; font-size:14px; cursor:pointer; }
      .mech-nav-item:hover{ background:rgba(255,255,255,0.06); color:#fff; } .mech-nav-item.active{ background:#fff; color:#0A192F; } .mech-nav-item.help{ background:rgba(59,130,246,0.18); color:#BFDBFE; border-color:rgba(59,130,246,0.28); }
      .mech-avatar{ width:42px; height:42px; border-radius:12px; object-fit:cover; border:2px solid #0A192F; }
      .mech-badge-verified{ font-size:11px; font-weight:800; background:#DCFCE7; color:#166534; border:1px solid #BBF7D0; padding:5px 10px; border-radius:20px; display:inline-flex; gap:6px; }
      .sub-indicator{ background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.10); border-radius:14px; padding:12px; margin:10px 0; }
      .sub-indicator-track{ height:8px; background:rgba(255,255,255,0.12); border-radius:20px; overflow:hidden; margin-top:8px; }
      @media(max-width:991px){ .mech-sidebar{ transform:translateX(-100%); transition:0.3s; } .mech-sidebar.open{ transform:translateX(0); } .mech-main{ margin-left:0; width:100%; } }
    `}</style>

    <div className="mech-layout">
      <aside className={`mech-sidebar ${showSidebar ? "open" : ""}`}>
        <div style={{padding:"16px 14px 12px", borderBottom:"1.5px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", gap:"12px"}}>
          <img src="../img/logo-trans.png" alt="" onError={e=>e.currentTarget.src="img/logo-trans.png"} style={{width:"42px", height:"42px", borderRadius:"10px", background:"#fff", padding:"4px"}} />
          <div><div style={{fontWeight:900, fontSize:"16px"}}>AutoVille</div><div style={{fontSize:"12px", color:"#94A3B8"}}>Elite Garage • BAR ARD 284719</div></div>
          <button onClick={()=>setShowSidebar(false)} className="d-lg-none ms-auto" style={{width:"36px", height:"36px", borderRadius:"10px", background:"rgba(255,255,255,0.06)", color:"#fff", border:"1px solid rgba(255,255,255,0.15)"}}><i className="bi bi-x-lg"></i></button>
        </div>

        <div className="mech-sidebar-scroll">
          <div style={{fontSize:"11px", fontWeight:800, color:"#64748B", margin:"8px 6px 10px"}}>WORKSHOP MENU • MECHANIC</div>
          {MENU.map(m=>(
            <button key={m.id} onClick={()=>handleNav(m.id)} className={`mech-nav-item ${m.id==="workshop-help" ? "help active" : ""}`}>
              <i className={`bi ${m.icon}`} style={{width:"22px"}}></i>
              <span style={{flex:1, textAlign:"left"}}>{m.label}<span style={{display:"block", fontSize:"11px", fontWeight:500, opacity:0.8}}>{m.desc}</span></span>
              {m.id==="subscription" && <span style={{fontSize:"10px", fontWeight:800, background:subColor, color:"#fff", padding:"3px 7px", borderRadius:"10px"}}>{daysLeft}d</span>}
              {m.id==="workshop-help" && <span style={{fontSize:"10px", fontWeight:800, background:"#3B82F6", color:"#fff", padding:"3px 7px", borderRadius:"10px"}}>GUIDE</span>}
            </button>
          ))}

          <div className="sub-indicator">
            <div style={{display:"flex", justifyContent:"space-between"}}><span style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}><i className="bi bi-gem me-1"></i>SUBSCRIPTION • STATUS • DAYS LEFT</span><span style={{width:"8px", height:"8px", borderRadius:"50%", background:subColor, display:"inline-block", boxShadow:`0 0 8px ${subColor}`}}></span></div>
            {subscription && <>
              <div style={{marginTop:"10px", display:"flex", justifyContent:"space-between"}}><span style={{fontWeight:900, color:"#fff"}}>{subscription.planName} • ${subscription.price}</span><span style={{fontSize:"11px", fontWeight:800, background:"#DCFCE7", color:"#166534", padding:"4px 8px", borderRadius:"20px"}}>{subscription.status}</span></div>
              <div className="sub-indicator-track"><div style={{width:`${subProgress}%`, height:"100%", background: daysLeft<=7 ? '#EF4444' : '#22C55E'}}></div></div>
              <div style={{fontSize:"11px", color:"#BBF7D0", marginTop:"6px"}}><i className="bi bi-clock me-1"></i>{daysLeft} days left before renewal • Renews {subscription.renewalDate}</div>
            </>}
          </div>
        </div>

        <div style={{padding:"12px", borderTop:"1.5px solid rgba(255,255,255,0.08)"}}>
          <button onClick={handleLogout} style={{width:"100%", height:"46px", borderRadius:"12px", border:"1.5px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.06)", color:"#fff", fontWeight:800}}><i className="bi bi-box-arrow-left me-2"></i>Logout</button>
        </div>
      </aside>

      <div className="mech-main">
        <div className="mech-topbar">
          <div style={{display:"flex", gap:"12px", alignItems:"center"}}><button onClick={()=>setShowSidebar(true)} className="d-lg-none" style={{width:"44px", height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", background:"#fff"}}><i className="bi bi-list"></i></button><span style={{fontWeight:900, fontSize:"18px", color:"#0A192F"}}>Help Center</span><span className="mech-badge-verified"><i className="bi bi-patch-check-fill"></i>BAR VERIFIED • GUIDE • LA</span></div>
          <div style={{display:"flex", gap:"10px", alignItems:"center"}}><div style={{background: daysLeft<=7 ? '#FEF2F2' : '#F0FDF4', border:`1px solid ${daysLeft<=7 ? '#FECACA' : '#BBF7D0'}`, padding:"6px 12px", borderRadius:"20px", fontSize:"12px", fontWeight:800, color: daysLeft<=7 ? '#991B1B' : '#166534'}}>{subscription.planName} • {daysLeft}d left</div><img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=100&q=80" alt="" className="mech-avatar" /></div>
        </div>
        <div className="mech-content"><MechanicHelpPage /></div>
      </div>
      {showSidebar && <div onClick={()=>setShowSidebar(false)} className="d-lg-none" style={{position:"fixed", inset:0, background:"rgba(10,25,47,0.45)", zIndex:20}}></div>}
    </div>
    </>
  );
}