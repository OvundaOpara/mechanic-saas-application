import { useState, useMemo, useEffect, useRef } from "react";

export default function AdminLogs(){
  const [initial, setInitial] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    fetch("http://127.0.0.1:5000/api/activity-logs?limit=200&offset=0")
      .then(r=>r.json())
      .then(data=>{
        const arr = Array.isArray(data) ? data : [];
        const mapped = arr.map((l)=>{
          const raw = l.timestamp || l.created_at || new Date().toISOString();
          const d = new Date(raw);
          const dateStr = isNaN(d) ? String(raw).split("T")[0] : d.toISOString().split("T")[0];
          const timeStr = isNaN(d) ? "" : d.toTimeString().split(" ")[0] + " PST";
          return {
            id: "LOG-"+l.id,
            type: l.activity_type || "Login",
            workshop: l.workshop_name || (l.workshop_id ? `Workshop #${l.workshop_id}` : "Platform • AutoVille"),
            workshopId: l.workshop_id || null,
            actor: l.actor || "Ayinde Admin",
            date: dateStr,
            time: timeStr,
            timestamp: d,
            ip: l.ip_address || "127.0.0.1",
            location: l.location || "112 S Market St Inglewood CA 90301 • PST",
            status: l.status || "Success",
            desc: l.description || "",
            details: (l.description||"") + " • Audit immutable • BAR log • Zero commission",
            device: l.device || "Chrome • Windows • Desktop",
            sessionId: "SES-"+(l.session_id || l.id),
          };
        });
        setInitial(mapped);
        setLoading(false);
      })
      .catch(()=> setLoading(false));
  },[]);

  // Derived from REAL data - no hardcoded seed, no entity tags
  const activityTypes = useMemo(()=>{ const s={}; initial.forEach(r=> s[r.type]=1); return Object.keys(s); },[initial]);
  const workshopsList = useMemo(()=>{ const s={}; initial.forEach(r=> s[r.workshop]=1); return Object.keys(s); },[initial]);
  const actorsList = useMemo(()=>{ const s={}; initial.forEach(r=> s[r.actor]=1); return Object.keys(s); },[initial]);

  const [q,setQ]=useState("");
  const [typeF,setTypeF]=useState("All");
  const [workshopF,setWorkshopF]=useState("All");
  const [actorF,setActorF]=useState("All");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [visibleCount,setVisibleCount]=useState(12);
  const [selected,setSelected]=useState(null);
  const [showDetail,setShowDetail]=useState(false);
  const loaderRef=useRef(null);

  const filtered = useMemo(()=>{
    return initial.filter(r=>{
      var matchQ = (r.type+" "+r.workshop+" "+r.actor+" "+r.id+" "+r.desc+" "+r.ip).toLowerCase().indexOf(q.toLowerCase())>-1;
      var matchT = typeF==="All" || r.type===typeF;
      var matchW = workshopF==="All" || r.workshop===workshopF;
      var matchA = actorF==="All" || r.actor===actorF;
      var matchFrom = !dateFrom || r.date >= dateFrom;
      var matchTo = !dateTo || r.date <= dateTo;
      return matchQ && matchT && matchW && matchA && matchFrom && matchTo;
    });
  },[initial,q,typeF,workshopF,actorF,dateFrom,dateTo]);

  const visibleRows = useMemo(()=> filtered.slice(0, visibleCount),[filtered, visibleCount]);

  useEffect(()=>{ setVisibleCount(12); },[q,typeF,workshopF,actorF,dateFrom,dateTo]);
  useEffect(()=>{
    var obs=new IntersectionObserver((e)=>{ if(e[0].isIntersecting && visibleCount < filtered.length) setVisibleCount(c=>c+10); },{threshold:0.1});
    if(loaderRef.current) obs.observe(loaderRef.current);
    return ()=> obs.disconnect();
  },[filtered.length, visibleCount]);

  const total = initial.length;
  const logins = initial.filter(r=>r.type==="Login").length;
  const logouts = initial.filter(r=>r.type==="Logout").length;
  const security = initial.filter(r=>r.type==="Security Alert").length;
  const todayLogs = initial.filter(r=>r.date===new Date().toISOString().split("T")[0]).length;

  function openDetail(r){ setSelected(r); setShowDetail(true); }

  return (
    <div style={{display:"grid", gap:"16px", fontSize:"15px"}}>
      <style>{`
        .owner-card{ background:#fff; border:1.5px solid #E2E8F0; border-radius:18px; padding:18px; }
        .owner-table th{ font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; background:#F8FAFC; padding:12px 10px; }
        .owner-table td{ padding:12px 10px; vertical-align:middle; font-size:14px; }
        .modal-overlay{ position:fixed; inset:0; background:rgba(10,25,47,0.65); backdrop-filter:blur(6px); z-index:90; display:grid; place-items:center; padding:16px; }
        .modal-box{ width:100%; background:#fff; border-radius:22px; border:1.5px solid #E2E8F0; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.2); animation:pop 0.22s ease; }
        @keyframes pop{ from{transform:scale(0.96) translateY(8px); opacity:0} to{transform:scale(1) translateY(0); opacity:1} }
      `}</style>

      <div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", borderRadius:"14px", padding:"14px", display:"flex", gap:"10px", alignItems:"center"}}>
        <i className="bi bi-shield-lock" style={{fontSize:"20px", color:"#DC2626"}}></i>
        <div><div style={{fontWeight:900, fontSize:"13px", color:"#991B1B"}}>Immutable Audit Log • No Delete • BAR Compliance • PST</div><div style={{fontSize:"12px", color:"#7F1D1D"}}>All system activities captured: login/logout time & date, bookings, workshop approvals, subscriptions, payments, reviews, settings, security. 112 S Market St Ste 1008 Inglewood CA 90301</div></div>
      </div>

      <div className="row g-3" style={{margin:0, width:"100%"}}>
        <div className="col-6 col-lg-3"><div style={{background:"#0A192F", borderRadius:"18px", padding:"18px", color:"#fff"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>TOTAL LOGS</div><div style={{fontSize:"32px", fontWeight:900}}>{loading ? "..." : total}</div><div style={{fontSize:"12px", color:"#CBD5E1"}}>Immutable • Audit Locked • Real DB</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#DCFCE7", borderColor:"#BBF7D0"}}><div style={{fontSize:"11px", fontWeight:800, color:"#166534"}}>LOGINS / LOGOUTS</div><div style={{fontSize:"22px", fontWeight:900, color:"#166534"}}>{logins} / {logouts}</div><div style={{fontSize:"11px", color:"#16A34A"}}>Console • /console/login • PST</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#FEF2F2", borderColor:"#FECACA"}}><div style={{fontSize:"11px", fontWeight:800, color:"#991B1B"}}>SECURITY ALERTS</div><div style={{fontSize:"32px", fontWeight:900, color:"#991B1B"}}>{security}</div><div style={{fontSize:"12px", color:"#DC2626"}}>Failed attempts • IP flagged</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card"><div style={{fontSize:"11px", fontWeight:800, color:"#64748B"}}>TODAY • {new Date().toISOString().split("T")[0]}</div><div style={{fontSize:"32px", fontWeight:900}}>{todayLogs}</div><div style={{fontSize:"12px", color:"#64748B"}}>PST • Inglewood CA 90301</div></div></div>
      </div>

      <div className="owner-card" style={{padding:"20px"}}>
        <div style={{display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:"12px", marginBottom:"16px"}}>
          <div><div style={{fontWeight:900, fontSize:"18px", color:"#0A192F"}}><i className="bi bi-journal-text me-2"></i>Activity Logs • Vital • Lazy-Load</div><div style={{fontSize:"13px", color:"#64748B", fontWeight:600, marginTop:"3px"}}>{filtered.length} filtered • Login/logout time & date • IP • Device • Immutable</div></div>
          <div style={{display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center"}}>
            <select value={typeF} onChange={e=>setTypeF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"13px", minWidth:"170px"}}><option value="All">All Activities</option>{activityTypes.map(t=><option key={t} value={t}>{t}</option>)}</select>
            <select value={workshopF} onChange={e=>setWorkshopF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"13px", minWidth:"190px"}}><option value="All">All Workshops</option>{workshopsList.map(w=><option key={w} value={w}>{w}</option>)}</select>
            <select value={actorF} onChange={e=>setActorF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"13px", minWidth:"180px"}}><option value="All">All Actors</option>{actorsList.map(a=><option key={a} value={a}>{a}</option>)}</select>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 10px", fontSize:"13px"}} />
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 10px", fontSize:"13px"}} />
            <div style={{position:"relative"}}><i className="bi bi-search" style={{position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", color:"#94A3B8"}}></i><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search IP, ID, desc..." style={{height:"44px", width:"200px", borderRadius:"12px", border:"1.5px solid #E2E8F0", background:"#F8FAFC", padding:"0 14px 0 40px", fontSize:"13px", fontWeight:600}} /></div>
          </div>
        </div>

        <div style={{overflowX:"auto", borderRadius:"14px", border:"1.5px solid #E2E8F0"}}>
          <table className="table owner-table" style={{margin:0}}>
            <thead><tr><th>Time • Date</th><th>Actor</th><th>Activity</th><th>Workshop / Target</th><th>IP • Device</th><th>Status</th><th style={{textAlign:"right"}}>View</th></tr></thead>
            <tbody>
              {visibleRows.map(r=>(
                <tr key={r.id}>
                  <td><div style={{fontWeight:800, fontSize:"13px"}}>{r.time}</div><div style={{fontSize:"11px", color:"#64748B", fontWeight:700}}>{r.date} • {r.id}</div></td>
                  <td><div style={{fontWeight:700, fontSize:"12px"}}>{r.actor}</div><div style={{fontSize:"10px", color:"#94A3B8"}}>{r.sessionId}</div></td>
                  <td><span style={{padding:"5px 12px", borderRadius:"20px", fontSize:"11px", fontWeight:800, background: r.type==="Login"?"#DCFCE7": r.type==="Logout"?"#F1F5F9": r.type==="Security Alert"?"#FEF2F2": r.type.indexOf("Workshop")>-1?"#DBEAFE": r.type.indexOf("Payment")>-1||r.type.indexOf("Subscription")>-1?"#FEF3C7": r.type.indexOf("Review")>-1||r.type.indexOf("Complaint")>-1?"#EFF6FF":"#F1F5F9", color: r.type==="Security Alert"?"#991B1B": r.type==="Login"?"#166534":"#0A192F", border:"1px solid #E2E8F0"}}>{r.type}</span></td>
                  <td style={{fontSize:"12px", fontWeight:700, maxWidth:"180px"}}><div style={{whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{r.workshop}</div><div style={{fontSize:"10px", color:"#94A3B8"}}>{r.location.split("•")[0]}</div></td>
                  <td style={{fontSize:"11px"}}><div style={{fontWeight:700}}>{r.ip}</div><div style={{color:"#94A3B8"}}>{r.device}</div></td>
                  <td><span style={{padding:"4px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:800, background: r.status==="Success"?"#DCFCE7": r.status==="Flagged"?"#FEF2F2": r.status==="Rejected"?"#FEF2F2":"#FEF3C7", color: r.status==="Success"?"#166534": r.status==="Flagged"||r.status==="Rejected"?"#991B1B":"#92400E", border:"1px solid #E2E8F0"}}>{r.status}</span></td>
                  <td><div style={{display:"flex", justifyContent:"flex-end"}}><button onClick={()=>openDetail(r)} style={{height:"34px", padding:"0 12px", borderRadius:"10px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"12px"}}>View</button></div></td>
                </tr>
              ))}
              {visibleRows.length===0 && !loading && <tr><td colSpan={7} style={{padding:20, textAlign:"center", color:"#94A3B8"}}>No logs yet. Login as admin to generate one.</td></tr>}
            </tbody>
          </table>
        </div>

        <div ref={loaderRef} style={{padding:"18px", textAlign:"center"}}>
          {visibleCount < filtered.length ? (
            <div style={{display:"inline-flex", gap:"10px", alignItems:"center", background:"#F8FAFC", border:"1.5px solid #E2E8F0", padding:"10px 18px", borderRadius:"20px", fontWeight:700, fontSize:"13px", color:"#64748B"}}>
              <span className="spinner-border spinner-border-sm" style={{width:"16px", height:"16px"}}></span> Loading {Math.min(10, filtered.length - visibleCount)} more... • {visibleRows.length}/{filtered.length} • Immutable
            </div>
          ) : (
            <div style={{fontSize:"13px", fontWeight:700, color:"#94A3B8"}}>All {filtered.length} logs loaded • Login/logout time & date captured • IP & device logged • 112 S Market St Inglewood CA 90301 PST • BAR audit</div>
          )}
        </div>
      </div>

      {showDetail && selected && (
        <div className="modal-overlay" onClick={()=>setShowDetail(false)}>
          <div className="modal-box" style={{maxWidth:"680px"}} onClick={e=>e.stopPropagation()}>
            <div style={{background: selected.type==="Security Alert" ? "#7F1D1D" : "#0A192F", padding:"18px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", color:"#fff"}}>
              <div><div style={{fontWeight:900, fontSize:"16px"}}>{selected.id} • {selected.type} • {selected.status}</div><div style={{fontSize:"12px", color:"rgba(255,255,255,0.7)"}}>{selected.date} • {selected.time} • {selected.sessionId} • {selected.ip}</div></div>
              <button onClick={()=>setShowDetail(false)} style={{width:"38px", height:"38px", borderRadius:"12px", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.18)", color:"#fff"}}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={{padding:"22px", display:"grid", gap:"14px"}}>
              <div className="row g-3" style={{margin:0, width:"100%"}}>
                <div className="col-6"><div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"12px", padding:"12px"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>ACTOR</div><div style={{fontWeight:800, fontSize:"14px"}}>{selected.actor}</div><div style={{fontSize:"11px", color:"#64748B"}}>{selected.device}</div></div></div>
                <div className="col-6"><div style={{background:selected.status==="Success"?"#DCFCE7":"#FEF2F2", border:"1.5px solid #E2E8F0", borderRadius:"12px", padding:"12px"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>TIME & DATE • IP</div><div style={{fontWeight:800}}>{selected.date} • {selected.time}</div><div style={{fontSize:"11px", color:"#64748B"}}>{selected.ip} • {selected.location}</div></div></div>
                <div className="col-12"><div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"12px", padding:"12px"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>WORKSHOP / TARGET</div><div style={{fontWeight:700}}>{selected.workshop}</div><div style={{fontSize:"12px", color:"#64748B", marginTop:"4px"}}>{selected.desc}</div></div></div>
                <div className="col-12"><div style={{background:"#EFF6FF", border:"1.5px solid #DBEAFE", borderRadius:"12px", padding:"12px"}}><div style={{fontSize:"11px", fontWeight:800, color:"#1E40AF"}}>FULL DETAILS • IMMUTABLE</div><div style={{fontSize:"12px", fontWeight:600, lineHeight:"1.6"}}>{selected.details}</div><div style={{fontSize:"11px", color:"#94A3B8", marginTop:"6px"}}>Session {selected.sessionId} • {selected.ip} • {selected.device} • BAR log • Zero commission • Audit locked • 112 S Market St Ste 1008 Inglewood CA 90301 PST</div></div></div>
              </div>
              <button onClick={()=>setShowDetail(false)} style={{height:"44px", borderRadius:"12px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800}}>Close • {selected.id} • {selected.type}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}