import { useState, useMemo, useEffect, useRef } from "react";
import Swal from "sweetalert2";

export default function AdminBookings(){
  const statuses = ["Pending","Confirmed","In Progress","Completed","Cancelled"];

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    fetch("http://127.0.0.1:5000/api/bookings?limit=200")
      .then(r=>r.json())
      .then(data=>{
        const arr = Array.isArray(data) ? data : [];
        const mapped = arr.map((b)=>{
          const carStr = b.car_make
            ? `${b.car_year || ""} ${b.car_make} ${b.car_model || ""} • ${b.plate || ""}`.trim()
            : "Car • —";
          return {
            _dbId: b.id,
            id: "BKG-"+(1000 + Number(b.id)),
            date: b.booking_date ? String(b.booking_date).split("T")[0] : "2026-11-06",
            time: b.booking_time || "09:00 AM PST",
            ownerName: b.owner_name || "Owner",
            ownerAvatar: b.owner_avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80",
            workshopName: b.workshop_name || "Elite Garage Inglewood",
            workshopLogo: b.workshop_logo || "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=100&q=80",
            car: carStr,
            service: b.service_type || "Oil Change",
            amount: "$"+Number(b.amount || 0).toLocaleString(),
            status: b.status || "Pending",
            phone: b.phone || "+1-310-555-0142",
            address: b.workshop_address || "112 S Market St, Inglewood, CA 90301",
            vin: b.vin || "—",
            notes: b.description || "N/A - Standard check",
          };
        });
        setBookings(mapped);
        setLoading(false);
      })
      .catch(()=> setLoading(false));
  },[]);

  const workshopsList = useMemo(()=>{
    const s = {}; bookings.forEach(b=> s[b.workshopName]=1);
    return Object.keys(s);
  },[bookings]);

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
    return bookings.filter(b=>{
      var matchQ = (b.id+" "+b.ownerName+" "+b.workshopName+" "+b.service+" "+b.car).toLowerCase().indexOf(q.toLowerCase())>-1;
      var matchW = workshopF==="All" || b.workshopName===workshopF;
      var matchS = statusF==="All" || b.status===statusF;
      var matchFrom = !dateFrom || b.date >= dateFrom;
      var matchTo = !dateTo || b.date <= dateTo;
      return matchQ && matchW && matchS && matchFrom && matchTo;
    });
  },[bookings,q,workshopF,statusF,dateFrom,dateTo]);

  const visible = useMemo(()=> filtered.slice(0, visibleCount), [filtered, visibleCount]);

  useEffect(()=>{ setVisibleCount(10); },[q,workshopF,statusF,dateFrom,dateTo]);

  useEffect(()=>{
    var observer = new IntersectionObserver((entries)=>{
      if(entries[0].isIntersecting && visibleCount < filtered.length){
        setVisibleCount(c=> c + 8);
      }
    },{threshold:0.1});
    if(loaderRef.current) observer.observe(loaderRef.current);
    return ()=> observer.disconnect();
  },[filtered.length, visibleCount]);

  function changeStatus(b, newStatus){
    Swal.fire({title:"Change status to "+newStatus+"?", text:b.id+" • "+b.workshopName, icon:"question", showCancelButton:true, confirmButtonColor:"#0A192F"}).then(r=>{
      if(r.isConfirmed){
        fetch(`http://127.0.0.1:5000/api/bookings/${b._dbId}/status`, {method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({status: newStatus})}).catch(()=>{});
        setBookings(prev=> prev.map(x=> x.id===b.id ? {...x, status:newStatus} : x));
        if(selected && selected.id===b.id) setSelected(s=>({...s, status:newStatus}));
        Swal.fire({icon:"success", title:"Updated to "+newStatus, timer:1200, showConfirmButton:false});
      }
    });
  }

  var stats = {
    total: bookings.length,
    pending: bookings.filter(b=>b.status==="Pending").length,
    progress: bookings.filter(b=>b.status==="In Progress").length,
    completed: bookings.filter(b=>b.status==="Completed").length,
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
        .status-pending{ background:#FEF3C7; color:#92400E; border:1px solid #FDE68A; padding:5px 12px; border-radius:20px; font-size:11px; font-weight:800; }
        .status-confirmed{ background:#DBEAFE; color:#1E40AF; border:1px solid #BFDBFE; padding:5px 12px; border-radius:20px; font-size:11px; font-weight:800; }
        .status-progress{ background:#E0E7FF; color:#4338CA; border:1px solid #C7D2FE; padding:5px 12px; border-radius:20px; font-size:11px; font-weight:800; }
        .status-completed{ background:#DCFCE7; color:#166534; border:1px solid #BBF7D0; padding:5px 12px; border-radius:20px; font-size:11px; font-weight:800; }
        .status-cancelled{ background:#FEF2F2; color:#991B1B; border:1px solid #FECACA; padding:5px 12px; border-radius:20px; font-size:11px; font-weight:800; }
      `}</style>

      <div className="row g-3" style={{margin:0, width:"100%"}}>
        <div className="col-6 col-lg-3"><div style={{background:"#0A192F", borderRadius:"18px", padding:"18px", color:"#fff"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>TOTAL BOOKINGS</div><div style={{fontSize:"32px", fontWeight:900}}>{loading ? "..." : stats.total}</div><div style={{fontSize:"12px", color:"#CBD5E1"}}>LA County • PST • Real DB</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#FEF3C7"}}><div style={{fontSize:"11px", fontWeight:800, color:"#92400E"}}>PENDING</div><div style={{fontSize:"32px", fontWeight:900, color:"#92400E"}}>{stats.pending}</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#E0E7FF"}}><div style={{fontSize:"11px", fontWeight:800, color:"#4338CA"}}>IN PROGRESS</div><div style={{fontSize:"32px", fontWeight:900, color:"#4338CA"}}>{stats.progress}</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#DCFCE7"}}><div style={{fontSize:"11px", fontWeight:800, color:"#166534"}}>COMPLETED</div><div style={{fontSize:"32px", fontWeight:900, color:"#166534"}}>{stats.completed}</div></div></div>
      </div>

      <div className="owner-card" style={{padding:"20px"}}>
        <div style={{display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:"12px", marginBottom:"16px"}}>
          <div><div style={{fontWeight:900, fontSize:"18px", color:"#0A192F"}}><i className="bi bi-calendar-check me-2"></i>Bookings • Lazy-Load</div><div style={{fontSize:"13px", color:"#64748B", fontWeight:600, marginTop:"3px"}}>{filtered.length} records • Scroll to load more • 15px font</div></div>
          <div style={{display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center"}}>
            <select value={workshopF} onChange={e=>setWorkshopF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px"}}><option value="All">All Workshops</option>{workshopsList.map(w=><option key={w} value={w}>{w}</option>)}</select>
            <select value={statusF} onChange={e=>setStatusF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px"}}><option value="All">All Status</option>{statuses.map(s=><option key={s} value={s}>{s}</option>)}</select>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 10px", fontSize:"13px"}} />
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 10px", fontSize:"13px"}} />
            <div style={{position:"relative"}}><i className="bi bi-search" style={{position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", color:"#94A3B8"}}></i><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search ID, owner, workshop, service..." style={{height:"44px", width:"260px", borderRadius:"12px", border:"1.5px solid #E2E8F0", background:"#F8FAFC", padding:"0 14px 0 40px", fontSize:"14px", fontWeight:600}} /></div>
          </div>
        </div>

        <div style={{overflowX:"auto", borderRadius:"14px", border:"1.5px solid #E2E8F0"}}>
          <table className="table owner-table" style={{margin:0}}>
            <thead><tr><th>ID</th><th>Date</th><th>Owner</th><th>Workshop</th><th>Service</th><th>Amount</th><th>Status</th><th style={{textAlign:"right"}}>Action</th></tr></thead>
            <tbody>
              {visible.map(b=>{
                var statusClass = b.status==="Pending"?"status-pending": b.status==="Confirmed"?"status-confirmed": b.status==="In Progress"?"status-progress": b.status==="Completed"?"status-completed":"status-cancelled";
                return (
                  <tr key={b.id}>
                    <td style={{fontWeight:900, fontSize:"13px"}}>{b.id}</td>
                    <td><div style={{fontWeight:700, fontSize:"14px"}}>{b.date}</div><div style={{fontSize:"12px", color:"#64748B"}}>{b.time}</div></td>
                    <td><div style={{display:"flex", gap:"10px", alignItems:"center"}}><img src={b.ownerAvatar} alt="" style={{width:"38px", height:"38px", borderRadius:"10px", objectFit:"cover"}} /><div><div style={{fontWeight:800, fontSize:"14px"}}>{b.ownerName}</div><div style={{fontSize:"12px", color:"#64748B"}}>{b.phone}</div></div></div></td>
                    <td><div style={{display:"flex", gap:"10px", alignItems:"center"}}><img src={b.workshopLogo} alt="" style={{width:"36px", height:"36px", borderRadius:"10px", objectFit:"cover", border:"1.5px solid #E2E8F0"}} /><div style={{fontWeight:700, fontSize:"14px"}}>{b.workshopName}</div></div></td>
                    <td><div style={{fontWeight:700, fontSize:"14px"}}>{b.service}</div><div style={{fontSize:"12px", color:"#94A3B8"}}>{b.car.split("•")[0]}</div></td>
                    <td style={{fontWeight:900}}>{b.amount}</td>
                    <td><span className={statusClass}>{b.status}</span></td>
                    <td><div style={{display:"flex", gap:"6px", justifyContent:"flex-end"}}><button onClick={()=>{setSelected(b); setShowDetail(true);}} style={{height:"36px", padding:"0 12px", borderRadius:"10px", border:"1.5px solid #E2E8F0", background:"#fff", fontWeight:800, fontSize:"13px"}}>View</button></div></td>
                  </tr>
                )
              })}
              {visible.length===0 && !loading && <tr><td colSpan={8} style={{padding:20, textAlign:"center", color:"#94A3B8"}}>No bookings yet. Create a booking from Owner dashboard.</td></tr>}
            </tbody>
          </table>
        </div>

        <div ref={loaderRef} style={{padding:"18px", textAlign:"center"}}>
          {visibleCount < filtered.length ? (
            <div style={{display:"inline-flex", gap:"10px", alignItems:"center", background:"#F8FAFC", border:"1.5px solid #E2E8F0", padding:"10px 18px", borderRadius:"20px", fontWeight:700, fontSize:"13px", color:"#64748B"}}>
              <span className="spinner-border spinner-border-sm" style={{width:"16px", height:"16px"}}></span> Loading {Math.min(8, filtered.length - visibleCount)} more... • {visible.length}/{filtered.length}
            </div>
          ) : (
            <div style={{fontSize:"13px", fontWeight:700, color:"#94A3B8"}}>All {filtered.length} bookings loaded • End of list • Inglewood CA 90301 • PST</div>
          )}
        </div>
      </div>

      {showDetail && selected && (
        <div className="modal-overlay" onClick={()=>setShowDetail(false)}>
          <div className="modal-box" style={{maxWidth:"680px"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:"#0A192F", padding:"18px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", color:"#fff"}}>
              <div><div style={{fontWeight:900, fontSize:"16px"}}>{selected.id} • {selected.service}</div><div style={{fontSize:"12px", color:"#94A3B8"}}>{selected.date} • {selected.time}</div></div>
              <div style={{display:"flex", gap:"8px", alignItems:"center"}}><span className={selected.status==="Pending"?"status-pending": selected.status==="Confirmed"?"status-confirmed": selected.status==="In Progress"?"status-progress": selected.status==="Completed"?"status-completed":"status-cancelled"} style={{border:"none"}}>{selected.status}</span><button onClick={()=>setShowDetail(false)} style={{width:"38px", height:"38px", borderRadius:"12px", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.18)", color:"#fff"}}><i className="bi bi-x-lg"></i></button></div>
            </div>
            <div style={{padding:"22px", display:"grid", gap:"16px", maxHeight:"75vh", overflowY:"auto"}}>
              <div className="row g-3" style={{margin:0, width:"100%"}}>
                <div className="col-6"><div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"14px", display:"flex", gap:"12px", alignItems:"center"}}><img src={selected.ownerAvatar} alt="" style={{width:"48px", height:"48px", borderRadius:"12px"}} /><div><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>OWNER</div><div style={{fontWeight:800, fontSize:"14px"}}>{selected.ownerName}</div><div style={{fontSize:"12px", color:"#64748B"}}>{selected.phone}</div></div></div></div>
                <div className="col-6"><div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"14px", display:"flex", gap:"12px", alignItems:"center"}}><img src={selected.workshopLogo} alt="" style={{width:"48px", height:"48px", borderRadius:"12px"}} /><div><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>WORKSHOP</div><div style={{fontWeight:800, fontSize:"14px"}}>{selected.workshopName}</div><div style={{fontSize:"12px", color:"#64748B"}}>{selected.address}</div></div></div></div>
                <div className="col-12"><div style={{background:"#EFF6FF", border:"1.5px solid #DBEAFE", borderRadius:"14px", padding:"14px"}}><div style={{fontSize:"11px", fontWeight:800, color:"#1E40AF"}}>VEHICLE & SERVICE</div><div style={{fontWeight:800, fontSize:"15px", marginTop:"4px"}}>{selected.car}</div><div style={{fontSize:"12px", color:"#475569", marginTop:"2px"}}>VIN: {selected.vin} • {selected.service} • {selected.amount} • Zero commission</div><div style={{fontSize:"12px", color:"#64748B", marginTop:"6px"}}>Notes: {selected.notes}</div></div></div>
              </div>

              <div>
                <div style={{fontSize:"12px", fontWeight:800, color:"#0A192F", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"8px"}}>Update Status • BAR Audit</div>
                <div style={{display:"flex", gap:"8px", flexWrap:"wrap"}}>
                  {statuses.map(st=>{
                    var isActive = selected.status===st;
                    return <button key={st} onClick={()=>changeStatus(selected, st)} style={{height:"38px", padding:"0 14px", borderRadius:"10px", border:"1.5px solid "+(isActive?"#0A192F":"#E2E8F0"), background:isActive?"#0A192F":"#fff", color:isActive?"#fff":"#0A192F", fontWeight:800, fontSize:"12px"}}>{st}</button>
                  })}
                </div>
              </div>

              <div style={{display:"flex", gap:"10px"}}>
                <button onClick={()=>setShowDetail(false)} style={{flex:1, height:"44px", borderRadius:"12px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"14px"}}>Close • {selected.id}</button>
                <button onClick={()=>{ setShowDetail(false); }} style={{height:"44px", padding:"0 18px", borderRadius:"12px", border:"1.5px solid #E2E8F0", background:"#fff", fontWeight:800, fontSize:"14px"}}>Invoice</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}