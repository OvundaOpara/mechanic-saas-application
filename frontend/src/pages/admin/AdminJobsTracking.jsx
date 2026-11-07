import { useState, useMemo, useEffect, useRef } from "react";
import Swal from "sweetalert2";

export default function AdminJobsTracking(){
  const statuses = ["Diagnosing","Waiting Parts","In Progress","Quality Check","Completed","On Hold"];

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // REAL DATA - replaces for(i<44) fake
  useEffect(()=>{
    fetch("http://127.0.0.1:5000/api/bookings/jobs?limit=200")
      .then(r=>r.json())
      .then(data=>{
        const arr = Array.isArray(data) ? data : [];
        const mapped = arr.map((j)=>{
          // backend creates job as "Diagnostics" -> map to UI "Diagnosing"
          let status = j.status || "Diagnosing";
          if(status === "Diagnostics") status = "Diagnosing";
          if(status === "Diagnosis") status = "Diagnosing";
          const progress = Number(j.progress ?? 0);
          const dateStr = j.booking_date ? String(j.booking_date).split("T")[0] : "2026-11-06";
          const carStr = j.car_make ? `${j.car_year || ""} ${j.car_make} ${j.car_model || ""} • ${j.plate || ""}`.trim() : "Car • —";
          // timeline is derived from progress - backend only stores status/progress/remarks
          const timeline = [
            { step:"Booking Confirmed", time: dateStr+" 08:00 AM", done:true, note:"Owner dropped vehicle • Inglewood" },
            { step:"Diagnosing", time: dateStr+" 09:15 AM", done: progress>=20, note:"OBD scan • Lift inspection" },
            { step:"Waiting Parts", time: dateStr+" 11:00 AM", done: progress>=35, note:"Parts ordered • BAR approved" },
            { step:"In Progress", time: dateStr+" 01:30 PM", done: progress>=65, note:"Mechanic working • Bay 2" },
            { step:"Quality Check", time: dateStr+" 03:45 PM", done: progress>=85, note:"Road test • Torque check" },
            { step:"Completed", time: progress===100 ? dateStr+" 04:30 PM" : "Pending", done: progress===100, note: progress===100 ? "Invoice sent • Owner notified" : (j.remarks || "Awaiting final check") },
          ];
          return {
            _dbId: j.id,
            id: "JOB-"+(2000 + Number(j.id)),
            bookingId: "BKG-"+(1000 + Number(j.booking_id || j.id)),
            date: dateStr,
            time: j.booking_time || "08:30 AM PST",
            ownerName: j.owner_name || "Owner",
            ownerAvatar: j.owner_avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80",
            workshopName: j.workshop_name || "Elite Garage Inglewood",
            workshopLogo: j.workshop_logo || "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=100&q=80",
            mechanicName: " 【entity-Carlos Rivera¦canonical_name=Carlos Rivera】",
            mechanicAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80",
            car: carStr,
            service: j.service_type || "Diagnostics",
            amount: "$"+Number(j.amount || 0).toLocaleString(),
            status,
            progress,
            eta: status==="Completed" ? "Delivered "+dateStr : "In progress • "+progress+"%",
            timeline,
            remarks: j.remarks || ""
          };
        });
        setJobs(mapped);
        setLoading(false);
      })
      .catch(()=> setLoading(false));
  },[]);

  const workshopsList = useMemo(()=>{
    const s = {}; jobs.forEach(j=> s[j.workshopName]=1);
    return Object.keys(s);
  },[jobs]);

  const [q, setQ] = useState("");
  const [workshopF, setWorkshopF] = useState("All");
  const [statusF, setStatusF] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const loaderRef = useRef(null);

  const filtered = useMemo(()=>{
    return jobs.filter(j=>{
      var matchQ = (j.id+" "+j.bookingId+" "+j.ownerName+" "+j.workshopName+" "+j.mechanicName+" "+j.service+" "+j.car).toLowerCase().indexOf(q.toLowerCase())>-1;
      var matchW = workshopF==="All" || j.workshopName===workshopF;
      var matchS = statusF==="All" || j.status===statusF;
      var matchFrom = !dateFrom || j.date >= dateFrom;
      var matchTo = !dateTo || j.date <= dateTo;
      return matchQ && matchW && matchS && matchFrom && matchTo;
    });
  },[jobs,q,workshopF,statusF,dateFrom,dateTo]);

  const visible = useMemo(()=> filtered.slice(0, visibleCount), [filtered, visibleCount]);

  useEffect(()=>{ setVisibleCount(10); },[q,workshopF,statusF,dateFrom,dateTo]);

  useEffect(()=>{
    var obs = new IntersectionObserver((entries)=>{
      if(entries[0].isIntersecting && visibleCount < filtered.length){
        setVisibleCount(c=> c + 8);
      }
    },{threshold:0.1});
    if(loaderRef.current) obs.observe(loaderRef.current);
    return ()=> obs.disconnect();
  },[filtered.length, visibleCount]);

  function updateStatus(job, newStatus){
    Swal.fire({title:"Move to "+newStatus+"?", text:job.id+" • "+job.workshopName, icon:"question", showCancelButton:true, confirmButtonColor:"#0A192F"}).then(r=>{
      if(r.isConfirmed){
        var prog = newStatus==="Diagnosing"?20: newStatus==="Waiting Parts"?35: newStatus==="In Progress"?65: newStatus==="Quality Check"?85: newStatus==="Completed"?100:15;
        // backend PUT /api/bookings/jobs expects {id, status, progress, remarks} in body
        fetch("http://127.0.0.1:5000/api/bookings/jobs", {method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({id: job._dbId, status: newStatus, progress: prog, remarks: job.remarks || ""})}).catch(()=>{});
        const upd = (x)=> ({...x, status:newStatus, progress:prog, eta: newStatus==="Completed" ? "Delivered "+x.date : "In progress • "+prog+"%"});
        setJobs(prev=> prev.map(x=> x.id===job.id ? upd(x) : x));
        if(selected && selected.id===job.id) setSelected(s=>upd(s));
        Swal.fire({icon:"success", title:newStatus, timer:1200, showConfirmButton:false});
      }
    });
  }

  var stats = {
    total: jobs.length,
    diagnosing: jobs.filter(j=>j.status==="Diagnosing").length,
    inprog: jobs.filter(j=>j.status==="In Progress").length,
    completed: jobs.filter(j=>j.status==="Completed").length,
  };

  return (
    <div style={{display:"grid", gap:"16px", fontSize:"15px"}}>
      <style>{`
        .owner-card{ background:#fff; border:1.5px solid #E2E8F0; border-radius:18px; padding:18px; }
        .owner-table th{ font-size:12px; font-weight:800; color:#475569; text-transform:uppercase; background:#F8FAFC; padding:14px 12px; }
        .owner-table td{ padding:14px 12px; vertical-align:middle; font-size:15px; }
        .modal-overlay{ position:fixed; inset:0; background:rgba(10,25,47,0.65); backdrop-filter:blur(6px); z-index:90; display:grid; place-items:center; padding:16px; }
        .modal-box{ width:100%; background:#fff; border-radius:22px; border:1.5px solid #E2E8F0; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.2); animation:pop 0.22s ease; }
        @keyframes pop{ from{transform:scale(0.96) translateY(8px); opacity:0} to{transform:scale(1) translateY(0); opacity:1} }
        .progress-track{ height:8px; background:#F1F5F9; border-radius:20px; overflow:hidden; }
        .progress-fill{ height:100%; border-radius:20px; transition:0.4s; }
      `}</style>

      <div className="row g-3" style={{margin:0, width:"100%"}}>
        <div className="col-6 col-lg-3"><div style={{background:"#0A192F", borderRadius:"18px", padding:"18px", color:"#fff"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>TOTAL JOBS</div><div style={{fontSize:"32px", fontWeight:900}}>{loading ? "..." : stats.total}</div><div style={{fontSize:"12px", color:"#CBD5E1"}}>Live • PST • Real DB</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#FEF3C7"}}><div style={{fontSize:"11px", fontWeight:800, color:"#92400E"}}>DIAGNOSING</div><div style={{fontSize:"32px", fontWeight:900, color:"#92400E"}}>{stats.diagnosing}</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#E0E7FF"}}><div style={{fontSize:"11px", fontWeight:800, color:"#4338CA"}}>IN PROGRESS</div><div style={{fontSize:"32px", fontWeight:900, color:"#4338CA"}}>{stats.inprog}</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#DCFCE7"}}><div style={{fontSize:"11px", fontWeight:800, color:"#166534"}}>COMPLETED</div><div style={{fontSize:"32px", fontWeight:900, color:"#166534"}}>{stats.completed}</div></div></div>
      </div>

      <div className="owner-card" style={{padding:"20px"}}>
        <div style={{display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:"12px", marginBottom:"16px"}}>
          <div><div style={{fontWeight:900, fontSize:"18px", color:"#0A192F"}}><i className="bi bi-geo-alt-fill me-2"></i>Jobs & Tracking • Lazy-Load</div><div style={{fontSize:"13px", color:"#64748B", fontWeight:600, marginTop:"3px"}}>{filtered.length} jobs • Scroll for more • BAR live tracking</div></div>
          <div style={{display:"flex", gap:"8px", flexWrap:"wrap"}}>
            <select value={workshopF} onChange={e=>setWorkshopF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px"}}><option value="All">All Workshops</option>{workshopsList.map(w=><option key={w} value={w}>{w}</option>)}</select>
            <select value={statusF} onChange={e=>setStatusF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px"}}><option value="All">All Status</option>{statuses.map(s=><option key={s} value={s}>{s}</option>)}</select>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 10px", fontSize:"13px"}} />
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 10px", fontSize:"13px"}} />
            <div style={{position:"relative"}}><i className="bi bi-search" style={{position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", color:"#94A3B8"}}></i><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search job, owner, mechanic..." style={{height:"44px", width:"260px", borderRadius:"12px", border:"1.5px solid #E2E8F0", background:"#F8FAFC", padding:"0 14px 0 40px", fontSize:"14px", fontWeight:600}} /></div>
          </div>
        </div>

        <div style={{overflowX:"auto", borderRadius:"14px", border:"1.5px solid #E2E8F0"}}>
          <table className="table owner-table" style={{margin:0}}>
            <thead><tr><th>Job ID</th><th>Date</th><th>Owner / Car</th><th>Workshop / Mechanic</th><th>Service</th><th>Progress</th><th>Status</th><th style={{textAlign:"right"}}>Track</th></tr></thead>
            <tbody>
              {visible.map(j=>{
                var color = j.status==="Completed"?"#22C55E": j.status==="In Progress"?"#3B82F6": j.status==="Quality Check"?"#8B5CF6": j.status==="Waiting Parts"?"#F59E0B": j.status==="On Hold"?"#EF4444":"#94A3B8";
                return (
                  <tr key={j.id}>
                    <td><div style={{fontWeight:900, fontSize:"13px"}}>{j.id}</div><div style={{fontSize:"11px", color:"#94A3B8"}}>{j.bookingId}</div></td>
                    <td><div style={{fontWeight:700, fontSize:"14px"}}>{j.date}</div><div style={{fontSize:"12px", color:"#64748B"}}>{j.time}</div></td>
                    <td><div style={{display:"flex", gap:"10px", alignItems:"center"}}><img src={j.ownerAvatar} alt="" style={{width:"38px", height:"38px", borderRadius:"10px"}} /><div><div style={{fontWeight:800, fontSize:"14px"}}>{j.ownerName}</div><div style={{fontSize:"12px", color:"#64748B"}}>{j.car.split("•")[0]}</div></div></div></td>
                    <td><div style={{display:"flex", gap:"10px", alignItems:"center"}}><img src={j.workshopLogo} alt="" style={{width:"32px", height:"32px", borderRadius:"10px", border:"1.5px solid #E2E8F0"}} /><div><div style={{fontWeight:700, fontSize:"13px"}}>{j.workshopName}</div><div style={{display:"flex", gap:"6px", alignItems:"center"}}><img src={j.mechanicAvatar} alt="" style={{width:"18px", height:"18px", borderRadius:"50%"}} /><span style={{fontSize:"12px", color:"#64748B"}}>{j.mechanicName}</span></div></div></div></td>
                    <td><div style={{fontWeight:700, fontSize:"14px"}}>{j.service}</div><div style={{fontSize:"12px", color:"#94A3B8"}}>{j.amount} • {j.eta.split("•")[0]}</div></td>
                    <td><div style={{width:"110px"}}><div className="progress-track"><div className="progress-fill" style={{width:j.progress+"%", background:color}}></div></div><div style={{fontSize:"11px", fontWeight:800, marginTop:"4px", color:color}}>{j.progress}% • {j.eta.split("•")[1] || j.eta}</div></div></td>
                    <td><span style={{padding:"5px 12px", borderRadius:"20px", fontSize:"11px", fontWeight:800, background:color+"20", color:color, border:"1px solid "+color+"30"}}>{j.status}</span></td>
                    <td><div style={{display:"flex", justifyContent:"flex-end"}}><button onClick={()=>{setSelected(j); setShowDetail(true);}} style={{height:"36px", padding:"0 14px", borderRadius:"10px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"13px"}}><i className="bi bi-geo-alt me-1"></i>Track</button></div></td>
                  </tr>
                )
              })}
              {visible.length===0 && !loading && <tr><td colSpan={8} style={{padding:20, textAlign:"center", color:"#94A3B8"}}>No jobs yet. Create a booking — a job auto-creates as Diagnosing 0%.</td></tr>}
            </tbody>
          </table>
        </div>

        <div ref={loaderRef} style={{padding:"18px", textAlign:"center"}}>
          {visibleCount < filtered.length ? (
            <div style={{display:"inline-flex", gap:"10px", alignItems:"center", background:"#F8FAFC", border:"1.5px solid #E2E8F0", padding:"10px 18px", borderRadius:"20px", fontWeight:700, fontSize:"13px", color:"#64748B"}}>
              <span className="spinner-border spinner-border-sm" style={{width:"16px", height:"16px"}}></span> Loading {Math.min(8, filtered.length - visibleCount)} more... • {visible.length}/{filtered.length}
            </div>
          ) : (
            <div style={{fontSize:"13px", fontWeight:700, color:"#94A3B8"}}>All {filtered.length} jobs loaded • Live tracking • 112 S Market St Inglewood CA</div>
          )}
        </div>
      </div>

      {showDetail && selected && (
        <div className="modal-overlay" onClick={()=>setShowDetail(false)}>
          <div className="modal-box" style={{maxWidth:"760px"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:"#0A192F", padding:"18px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", color:"#fff"}}>
              <div><div style={{fontWeight:900, fontSize:"16px"}}>{selected.id} • {selected.service} • {selected.amount}</div><div style={{fontSize:"12px", color:"#94A3B8"}}>{selected.bookingId} • {selected.date} • {selected.eta}</div></div>
              <div style={{display:"flex", gap:"8px", alignItems:"center"}}><span style={{padding:"5px 12px", borderRadius:"20px", fontSize:"11px", fontWeight:800, background:"#22C55E", color:"#fff"}}>{selected.status} • {selected.progress}%</span><button onClick={()=>setShowDetail(false)} style={{width:"38px", height:"38px", borderRadius:"12px", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.18)", color:"#fff"}}><i className="bi bi-x-lg"></i></button></div>
            </div>
            <div style={{padding:"22px", display:"grid", gap:"18px", maxHeight:"80vh", overflowY:"auto"}}>
              <div className="row g-3" style={{margin:0, width:"100%"}}>
                <div className="col-4"><div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"14px", display:"flex", gap:"10px", alignItems:"center"}}><img src={selected.ownerAvatar} alt="" style={{width:"44px", height:"44px", borderRadius:"12px"}} /><div><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>OWNER</div><div style={{fontWeight:800, fontSize:"14px"}}>{selected.ownerName}</div></div></div></div>
                <div className="col-4"><div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"14px", display:"flex", gap:"10px", alignItems:"center"}}><img src={selected.workshopLogo} alt="" style={{width:"44px", height:"44px", borderRadius:"12px"}} /><div><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>WORKSHOP</div><div style={{fontWeight:800, fontSize:"13px"}}>{selected.workshopName}</div></div></div></div>
                <div className="col-4"><div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"14px", display:"flex", gap:"10px", alignItems:"center"}}><img src={selected.mechanicAvatar} alt="" style={{width:"44px", height:"44px", borderRadius:"12px"}} /><div><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>MECHANIC</div><div style={{fontWeight:800, fontSize:"13px"}}>{selected.mechanicName}</div><div style={{fontSize:"11px", color:"#16A34A"}}>On duty • Bay 2</div></div></div></div>
              </div>

              <div>
                <div style={{fontWeight:900, fontSize:"14px", marginBottom:"10px"}}>Live Tracking Timeline • PST • BAR</div>
                <div style={{position:"relative", paddingLeft:"28px", display:"grid", gap:"14px"}}>
                  <div style={{position:"absolute", left:"11px", top:"8px", bottom:"8px", width:"2px", background:"#E2E8F0"}}></div>
                  {selected.timeline.map((t,i)=>{
                    var col = t.done ? "#22C55E" : "#E2E8F0";
                    var bg = t.done ? "#22C55E" : "#fff";
                    return (
                      <div key={i} style={{position:"relative", display:"flex", gap:"12px"}}>
                        <div style={{position:"absolute", left:"-28px", width:"24px", height:"24px", borderRadius:"50%", background:bg, border:"2px solid "+col, display:"grid", placeItems:"center", color:t.done?"#fff":"#94A3B8", fontSize:"12px"}}><i className={"bi "+(t.done?"bi-check-lg":"bi-circle")}></i></div>
                        <div style={{flex:1, background:t.done?"#F8FAFC":"#fff", border:"1.5px solid "+(t.done?"#E2E8F0":"#F1F5F9"), borderRadius:"12px", padding:"12px 14px"}}>
                          <div style={{display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:"6px"}}><span style={{fontWeight:800, fontSize:"14px", color:t.done?"#0A192F":"#94A3B8"}}>{t.step}</span><span style={{fontSize:"11px", fontWeight:700, color:"#64748B"}}>{t.time}</span></div>
                          <div style={{fontSize:"12px", color:"#475569", marginTop:"4px", fontWeight:600}}>{t.note}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <div style={{fontSize:"12px", fontWeight:800, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"8px"}}>Update Status • Admin Override</div>
                <div style={{display:"flex", gap:"8px", flexWrap:"wrap"}}>
                  {statuses.map(st=>{
                    var isActive = selected.status===st;
                    return <button key={st} onClick={()=>updateStatus(selected, st)} style={{height:"38px", padding:"0 14px", borderRadius:"10px", border:"1.5px solid "+(isActive?"#0A192F":"#E2E8F0"), background:isActive?"#0A192F":"#fff", color:isActive?"#fff":"#0A192F", fontWeight:800, fontSize:"12px"}}>{st}</button>
                  })}
                </div>
              </div>

              <div style={{display:"flex", gap:"10px"}}>
                <button onClick={()=>setShowDetail(false)} style={{flex:1, height:"44px", borderRadius:"12px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"14px"}}>Close Tracking • {selected.id}</button>
                <button style={{height:"44px", padding:"0 18px", borderRadius:"12px", border:"1.5px solid #E2E8F0", background:"#fff", fontWeight:800, fontSize:"14px"}}>Call Mechanic</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}