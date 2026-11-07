import { useState, useMemo, useEffect, useRef } from "react";

export default function AdminIncomes(){
  const plans = ["Monthly","Quarterly","Annual"];

  const [initial, setInitial] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    fetch("http://127.0.0.1:5000/api/admin/incomes?limit=200&offset=0")
      .then(r=>r.json())
      .then(data=>{
        const arr = Array.isArray(data) ? data : [];
        const logos = {
          "Elite Garage Inglewood":"https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=100&q=80",
          "Sunset Auto Care":"https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&w=100&q=80",
          "Culver City Motors":"https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?auto=format&fit=crop&w=100&q=80",
          "Torrance Auto Pro":"https://images.unsplash.com/photo-1551524559-8af4e6624178?auto=format&fit=crop&w=100&q=80",
          "Inglewood Quick Lube":"https://images.unsplash.com/photo-1613214149922-f1809c99b414?auto=format&fit=crop&w=100&q=80",
          "Beverly Hills Auto Spa":"https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?auto=format&fit=crop&w=100&q=80",
        };
        const mapped = arr.map((x)=>{
          const shop = x.workshop_name || "Elite Garage Inglewood";
          const plan = x.plan || "Monthly";
          const rawDate = x.date || x.created_at || new Date().toISOString();
          const dateStr = String(rawDate).split("T")[0];
          return {
            id: "INC-"+x.id,
            workshop: shop,
            plan: plan,
            amount: Number(x.amount || 0),
            date: dateStr,
            method: x.payment_method || "Card • 4242",
            status: x.status || "Paid",
            period: x.period || (plan==="Monthly" ? "1 month • "+dateStr : plan==="Quarterly" ? "3 months" : "12 months • Annual"),
            receipt: x.receipt_id || ("RCPT-SUB-"+x.id),
            logo: x.logo_url || logos[shop] || logos["Elite Garage Inglewood"],
            owner: x.owner || x.owner_name || " Carlos Rivera",
            phone: x.phone || "+1-310-555-0142",
            address: x.address || "112 S Market St, Inglewood, CA 90301",
            bar: x.bar || x.bar_license || "ARD 284719",
          };
        });
        mapped.sort((a,b)=> new Date(b.date) - new Date(a.date));
        setInitial(mapped);
        setLoading(false);
      })
      .catch(()=> setLoading(false));
  },[]);

  const workshopsList = useMemo(()=>{
    const s = {}; initial.forEach(r=> s[r.workshop]=1);
    return Object.keys(s);
  },[initial]);

  const [q,setQ]=useState("");
  const [workshopF,setWorkshopF]=useState("All");
  const [planF,setPlanF]=useState("All");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [visibleCount,setVisibleCount]=useState(10);
  const [selected,setSelected]=useState(null);
  const [showDetail,setShowDetail]=useState(false);
  const loaderRef = useRef(null);

  const filtered = useMemo(()=>{
    return initial.filter(r=>{
      var matchQ = (r.workshop+" "+r.id+" "+r.plan+" "+r.owner+" "+r.receipt).toLowerCase().indexOf(q.toLowerCase())>-1;
      var matchW = workshopF==="All" || r.workshop===workshopF;
      var matchP = planF==="All" || r.plan===planF;
      var matchFrom = !dateFrom || r.date >= dateFrom;
      var matchTo = !dateTo || r.date <= dateTo;
      return matchQ && matchW && matchP && matchFrom && matchTo;
    });
  },[initial,q,workshopF,planF,dateFrom,dateTo]);

  const visibleRows = useMemo(()=> filtered.slice(0, visibleCount), [filtered, visibleCount]);

  useEffect(()=>{ setVisibleCount(10); },[q,workshopF,planF,dateFrom,dateTo]);

  useEffect(()=>{
    var obs = new IntersectionObserver((entries)=>{
      if(entries[0].isIntersecting && visibleCount < filtered.length){
        setVisibleCount(c=> c + 8);
      }
    },{threshold:0.1});
    if(loaderRef.current) obs.observe(loaderRef.current);
    return ()=> obs.disconnect();
  },[filtered.length, visibleCount]);

  const total = initial.reduce((s,r)=>s+r.amount,0);
  const totalFiltered = filtered.reduce((s,r)=>s+r.amount,0);
  const monthly = initial.filter(r=>r.plan==="Monthly").length;
  const quarterly = initial.filter(r=>r.plan==="Quarterly").length;
  const annual = initial.filter(r=>r.plan==="Annual").length;

  function openDetail(r){ setSelected(r); setShowDetail(true); }

  return (
    <div style={{display:"grid", gap:"16px", fontSize:"15px"}}>
      <style>{`
        .owner-card{ background:#fff; border:1.5px solid #E2E8F0; border-radius:18px; padding:18px; }
        .owner-table th{ font-size:12px; font-weight:800; color:#475569; text-transform:uppercase; background:#F8FAFC; padding:14px 12px; }
        .owner-table td{ padding:14px 12px; vertical-align:middle; font-size:15px; }
        .modal-overlay{ position:fixed; inset:0; background:rgba(10,25,47,0.65); backdrop-filter:blur(6px); z-index:90; display:grid; place-items:center; padding:16px; }
        .modal-box{ width:100%; background:#fff; border-radius:22px; border:1.5px solid #E2E8F0; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.2); animation:pop 0.22s ease; }
        @keyframes pop{ from{transform:scale(0.96) translateY(8px); opacity:0} to{transform:scale(1) translateY(0); opacity:1} }
      `}</style>

      <div className="row g-3" style={{margin:0, width:"100%"}}>
        <div className="col-6 col-lg-3"><div style={{background:"#0A192F", borderRadius:"18px", padding:"18px", color:"#fff"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>TOTAL INCOME (ALL)</div><div style={{fontSize:"30px", fontWeight:900}}>${loading ? "..." : total.toLocaleString()}</div><div style={{fontSize:"12px", color:"#CBD5E1"}}>{initial.length} subs • Zero commission • Real DB</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#EFF6FF", borderColor:"#DBEAFE"}}><div style={{fontSize:"11px", fontWeight:800, color:"#1E40AF"}}>FILTERED INCOME</div><div style={{fontSize:"28px", fontWeight:900, color:"#1E40AF"}}>${totalFiltered.toLocaleString()}</div><div style={{fontSize:"12px", color:"#3B82F6"}}>{filtered.length} records</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card"><div style={{fontSize:"11px", fontWeight:800, color:"#64748B"}}>PLANS • M / Q / A</div><div style={{fontSize:"18px", fontWeight:900, color:"#0A192F"}}>{monthly} • {quarterly} • {annual}</div><div style={{fontSize:"12px", color:"#64748B"}}>$40 • $100 • $300</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#DCFCE7", borderColor:"#BBF7D0"}}><div style={{fontSize:"11px", fontWeight:800, color:"#166534"}}>LA • PST • BAR</div><div style={{fontSize:"16px", fontWeight:900, color:"#166534"}}>112 S Market St</div><div style={{fontSize:"11px", color:"#16A34A"}}>Inglewood CA 90301</div></div></div>
      </div>

      <div className="owner-card" style={{padding:"20px"}}>
        <div style={{display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:"12px", marginBottom:"16px"}}>
          <div><div style={{fontWeight:900, fontSize:"18px", color:"#0A192F"}}><i className="bi bi-graph-up-arrow me-2"></i>Incomes • Subscriptions • Lazy-Load</div><div style={{fontSize:"13px", color:"#64748B", fontWeight:600, marginTop:"3px"}}>{filtered.length} filtered • Scroll to load more • 15px font • Zero commission</div></div>
          <div style={{display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center"}}>
            <select value={workshopF} onChange={e=>setWorkshopF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px", minWidth:"180px"}}><option value="All">All Workshops</option>{workshopsList.map(w=><option key={w} value={w}>{w}</option>)}</select>
            <select value={planF} onChange={e=>setPlanF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px"}}><option value="All">All Plans</option>{plans.map(p=><option key={p} value={p}>{p}</option>)}</select>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 10px", fontSize:"13px"}} />
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 10px", fontSize:"13px"}} />
            <div style={{position:"relative"}}><i className="bi bi-search" style={{position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", color:"#94A3B8"}}></i><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search workshop, owner, ID..." style={{height:"44px", width:"240px", borderRadius:"12px", border:"1.5px solid #E2E8F0", background:"#F8FAFC", padding:"0 14px 0 40px", fontSize:"14px", fontWeight:600}} /></div>
          </div>
        </div>

        <div style={{overflowX:"auto", borderRadius:"14px", border:"1.5px solid #E2E8F0"}}>
          <table className="table owner-table" style={{margin:0}}>
            <thead><tr><th>ID</th><th>Date</th><th>Workshop</th><th>Plan</th><th>Amount</th><th>Method</th><th>Status</th><th style={{textAlign:"right"}}>View</th></tr></thead>
            <tbody>
              {visibleRows.map(r=>(
                <tr key={r.id}>
                  <td style={{fontWeight:900, fontSize:"13px"}}>{r.id}</td>
                  <td><div style={{fontWeight:700, fontSize:"14px"}}>{r.date}</div><div style={{fontSize:"11px", color:"#64748B"}}>{r.period.split("•")[0]}</div></td>
                  <td><div style={{display:"flex", gap:"10px", alignItems:"center"}}><img src={r.logo} alt="" style={{width:"38px", height:"38px", borderRadius:"10px", objectFit:"cover", border:"1.5px solid #E2E8F0"}} /><div><div style={{fontWeight:800, fontSize:"14px", color:"#0A192F"}}>{r.workshop}</div><div style={{fontSize:"12px", color:"#64748B"}}>{r.owner} • {r.bar}</div></div></div></td>
                  <td><span style={{background: r.plan==="Monthly"?"#DBEAFE": r.plan==="Quarterly"?"#E0E7FF":"#FEF3C7", color: r.plan==="Monthly"?"#1E40AF": r.plan==="Quarterly"?"#4338CA":"#92400E", border:"1px solid #E2E8F0", padding:"5px 12px", borderRadius:"20px", fontSize:"12px", fontWeight:800}}>{r.plan} • {r.plan==="Monthly"?"$40": r.plan==="Quarterly"?"$100":"$300"}</span></td>
                  <td style={{fontWeight:900, color:"#166534", fontSize:"15px"}}>${r.amount.toLocaleString()}</td>
                  <td style={{fontSize:"12px", fontWeight:700}}>{r.method}<div style={{fontSize:"11px", color:"#94A3B8"}}>{r.receipt}</div></td>
                  <td><span style={{padding:"5px 12px", borderRadius:"20px", fontSize:"11px", fontWeight:800, background:r.status==="Paid"?"#DCFCE7":"#FEF3C7", color:r.status==="Paid"?"#166534":"#92400E", border:"1px solid #E2E8F0"}}>{r.status}</span></td>
                  <td><div style={{display:"flex", justifyContent:"flex-end"}}><button onClick={()=>openDetail(r)} style={{height:"36px", padding:"0 14px", borderRadius:"10px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"13px"}}>View</button></div></td>
                </tr>
              ))}
              {visibleRows.length===0 && !loading && <tr><td colSpan={8} style={{padding:20, textAlign:"center", color:"#94A3B8"}}>No incomes yet. Register a workshop + paid subscription to generate income.</td></tr>}
            </tbody>
          </table>
        </div>

        <div ref={loaderRef} style={{padding:"18px", textAlign:"center"}}>
          {visibleCount < filtered.length ? (
            <div style={{display:"inline-flex", gap:"10px", alignItems:"center", background:"#F8FAFC", border:"1.5px solid #E2E8F0", padding:"10px 18px", borderRadius:"20px", fontWeight:700, fontSize:"13px", color:"#64748B"}}>
              <span className="spinner-border spinner-border-sm" style={{width:"16px", height:"16px"}}></span> Loading {Math.min(8, filtered.length - visibleCount)} more... • {visibleRows.length}/{filtered.length} • ${totalFiltered.toLocaleString()}
            </div>
          ) : (
            <div style={{fontSize:"13px", fontWeight:700, color:"#94A3B8"}}>All {filtered.length} incomes loaded • ${totalFiltered.toLocaleString()} filtered • 112 S Market St Inglewood CA 90301 • PST</div>
          )}
        </div>
      </div>

      {showDetail && selected && (
        <div className="modal-overlay" onClick={()=>setShowDetail(false)}>
          <div className="modal-box" style={{maxWidth:"620px"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:"#0A192F", padding:"18px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", color:"#fff"}}>
              <div><div style={{fontWeight:900, fontSize:"16px"}}>{selected.id} • {selected.plan} • ${selected.amount.toLocaleString()}</div><div style={{fontSize:"12px", color:"#94A3B8"}}>{selected.date} • {selected.period} • {selected.receipt}</div></div>
              <button onClick={()=>setShowDetail(false)} style={{width:"38px", height:"38px", borderRadius:"12px", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.18)", color:"#fff"}}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={{padding:"22px", display:"grid", gap:"16px"}}>
              <div style={{display:"flex", gap:"14px", alignItems:"center", background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"14px"}}>
                <img src={selected.logo} alt="" style={{width:"56px", height:"56px", borderRadius:"14px", objectFit:"cover"}} />
                <div><div style={{fontWeight:900, fontSize:"16px", color:"#0A192F"}}>{selected.workshop}</div><div style={{fontSize:"13px", color:"#64748B"}}>{selected.owner} • {selected.phone} • {selected.bar}</div><div style={{fontSize:"12px", color:"#64748B"}}>{selected.address}</div></div>
              </div>
              <div className="row g-3" style={{margin:0, width:"100%"}}>
                <div className="col-6"><div style={{background:"#EFF6FF", border:"1.5px solid #DBEAFE", borderRadius:"12px", padding:"12px"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>PLAN</div><div style={{fontWeight:800}}>{selected.plan} • ${selected.amount.toLocaleString()}</div></div></div>
                <div className="col-6"><div style={{background:"#DCFCE7", border:"1.5px solid #BBF7D0", borderRadius:"12px", padding:"12px"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>STATUS</div><div style={{fontWeight:800, color:"#166534"}}>{selected.status} • {selected.method}</div></div></div>
                <div className="col-12"><div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"12px", padding:"12px"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>PERIOD & RECEIPT</div><div style={{fontWeight:700, fontSize:"13px"}}>{selected.period}</div><div style={{fontSize:"12px", color:"#64748B"}}>{selected.receipt} • Zero commission • BAR log</div></div></div>
              </div>
              <button onClick={()=>setShowDetail(false)} style={{height:"44px", borderRadius:"12px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"14px"}}>Close • {selected.id}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}