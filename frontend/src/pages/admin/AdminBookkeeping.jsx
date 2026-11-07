import { useState, useMemo, useEffect, useRef } from "react";

export default function AdminBookkeeping(){
  const [initial, setInitial] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    fetch("http://127.0.0.1:5000/api/admin/bookkeeping?limit=200&offset=0")
      .then(r=>r.json())
      .then(data=>{
        const arr = Array.isArray(data) ? data : [];
        const mapped = arr.map((x, i)=>{
          const dateStr = String(x.date || new Date().toISOString()).split("T")[0];
          const isInc = x.type === "Income";
          return {
            id: (isInc ? "INC-" : "EXP-") + x.id + "-" + i,
            rawId: x.id,
            type: x.type || "Income",
            category: x.category || (isInc ? "Monthly" : "Other"),
            description: x.description || (isInc ? "Subscription income" : "Platform expense"),
            workshop: x.workshop_name || "Platform",
            amount: Number(x.amount || 0),
            date: dateStr,
            receipt: x.receipt_id || "—",
            method: x.method || "Card",
            status: x.status || "Paid",
          };
        });
        mapped.sort((a,b)=> new Date(b.date) - new Date(a.date));
        setInitial(mapped);
        setLoading(false);
      })
      .catch(()=> setLoading(false));
  },[]);

  const [q,setQ]=useState("");
  const [typeF,setTypeF]=useState("All");
  const [catF,setCatF]=useState("All");
  const [workshopF,setWorkshopF]=useState("All");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [visibleCount,setVisibleCount]=useState(10);
  const [selected,setSelected]=useState(null);
  const [showDetail,setShowDetail]=useState(false);
  const loaderRef = useRef(null);

  const categories = useMemo(()=>{
    const s={}; initial.forEach(r=> s[r.category]=1); return Object.keys(s);
  },[initial]);

  const workshopsList = useMemo(()=>{
    const s={}; initial.forEach(r=> s[r.workshop]=1); return Object.keys(s);
  },[initial]);

  const filtered = useMemo(()=>{
    return initial.filter(r=>{
      var matchQ = (r.description+" "+r.workshop+" "+r.category+" "+r.receipt+" "+r.id).toLowerCase().indexOf(q.toLowerCase())>-1;
      var matchT = typeF==="All" || r.type===typeF;
      var matchC = catF==="All" || r.category===catF;
      var matchW = workshopF==="All" || r.workshop===workshopF;
      var matchFrom = !dateFrom || r.date >= dateFrom;
      var matchTo = !dateTo || r.date <= dateTo;
      return matchQ && matchT && matchC && matchW && matchFrom && matchTo;
    });
  },[initial,q,typeF,catF,workshopF,dateFrom,dateTo]);

  const visibleRows = useMemo(()=> filtered.slice(0, visibleCount), [filtered, visibleCount]);
  useEffect(()=>{ setVisibleCount(10); },[q,typeF,catF,workshopF,dateFrom,dateTo]);

  useEffect(()=>{
    var obs = new IntersectionObserver((entries)=>{
      if(entries[0].isIntersecting && visibleCount < filtered.length) setVisibleCount(c=> c + 8);
    },{threshold:0.1});
    if(loaderRef.current) obs.observe(loaderRef.current);
    return ()=> obs.disconnect();
  },[filtered.length, visibleCount]);

  const totalInc = filtered.filter(r=>r.type==="Income").reduce((s,r)=>s+r.amount,0);
  const totalExp = filtered.filter(r=>r.type==="Expenditure").reduce((s,r)=>s+r.amount,0);
  const profit = totalInc - totalExp;
  const totalIncAll = initial.filter(r=>r.type==="Income").reduce((s,r)=>s+r.amount,0);
  const totalExpAll = initial.filter(r=>r.type==="Expenditure").reduce((s,r)=>s+r.amount,0);
  const profitAll = totalIncAll - totalExpAll;
  const maxBar = Math.max(totalIncAll, totalExpAll, 1);

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
        <div className="col-6 col-lg-3"><div style={{background:"#0A192F", borderRadius:"18px", padding:"18px", color:"#fff"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>NET PROFIT (ALL) • ZERO COMMISSION</div><div style={{fontSize:"30px", fontWeight:900, color: profitAll>=0 ? "#4ADE80" : "#FCA5A5"}}>${loading ? "..." : profitAll.toLocaleString()}</div><div style={{fontSize:"12px", color:"#CBD5E1"}}>{initial.length} ledger rows • Incomes - Expenditures</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#DCFCE7", borderColor:"#BBF7D0"}}><div style={{fontSize:"11px", fontWeight:800, color:"#166534"}}>TOTAL INCOME (FILTERED)</div><div style={{fontSize:"28px", fontWeight:900, color:"#166534"}}>${totalInc.toLocaleString()}</div><div style={{fontSize:"12px", color:"#16A34A"}}>Subscriptions only • ${totalIncAll.toLocaleString()} all-time</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#FEF2F2", borderColor:"#FECACA"}}><div style={{fontSize:"11px", fontWeight:800, color:"#991B1B"}}>TOTAL EXPENDITURE (FILTERED)</div><div style={{fontSize:"28px", fontWeight:900, color:"#991B1B"}}>${totalExp.toLocaleString()}</div><div style={{fontSize:"12px", color:"#DC2626"}}>Platform costs • ${totalExpAll.toLocaleString()} all-time</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card"><div style={{fontSize:"11px", fontWeight:800, color:"#64748B"}}>P / L • LA • PST</div><div style={{fontSize:"16px", fontWeight:900, color:"#0A192F"}}>Profit ${profit.toLocaleString()}</div><div style={{fontSize:"12px", color:"#64748B"}}>112 S Market St Inglewood CA 90301</div></div></div>
      </div>

      {/* P/L VISUAL - DIV bars, no SVG */}
      <div className="owner-card" style={{padding:"20px"}}>
        <div style={{fontWeight:900, fontSize:"16px", color:"#0A192F", marginBottom:"12px"}}><i className="bi bi-bar-chart-line me-2"></i>Profit & Loss • Visual</div>
        <div style={{display:"grid", gap:"10px"}}>
          <div><div style={{display:"flex", justifyContent:"space-between", fontSize:"13px", fontWeight:800}}><span style={{color:"#166534"}}>Income</span><span>${totalIncAll.toLocaleString()}</span></div><div style={{height:"14px", background:"#F1F5F9", borderRadius:"20px", overflow:"hidden", marginTop:"4px"}}><div style={{width: Math.round(totalIncAll/maxBar*100)+"%", height:"100%", background:"#16A34A", borderRadius:"20px"}}></div></div></div>
          <div><div style={{display:"flex", justifyContent:"space-between", fontSize:"13px", fontWeight:800}}><span style={{color:"#991B1B"}}>Expenditure</span><span>${totalExpAll.toLocaleString()}</span></div><div style={{height:"14px", background:"#F1F5F9", borderRadius:"20px", overflow:"hidden", marginTop:"4px"}}><div style={{width: Math.round(totalExpAll/maxBar*100)+"%", height:"100%", background:"#DC2626", borderRadius:"20px"}}></div></div></div>
          <div><div style={{display:"flex", justifyContent:"space-between", fontSize:"13px", fontWeight:800}}><span style={{color:"#0A192F"}}>Net Profit</span><span style={{color: profitAll>=0 ? "#166534" : "#991B1B"}}>${profitAll.toLocaleString()}</span></div><div style={{height:"14px", background:"#F1F5F9", borderRadius:"20px", overflow:"hidden", marginTop:"4px"}}><div style={{width: Math.round(Math.abs(profitAll)/maxBar*100)+"%", height:"100%", background: profitAll>=0 ? "#0A192F" : "#F59E0B", borderRadius:"20px"}}></div></div></div>
        </div>
      </div>

      <div className="owner-card" style={{padding:"20px"}}>
        <div style={{display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:"12px", marginBottom:"16px"}}>
          <div><div style={{fontWeight:900, fontSize:"18px", color:"#0A192F"}}><i className="bi bi-journal-text me-2"></i>Bookkeeping • Ledger • Lazy-Load</div><div style={{fontSize:"13px", color:"#64748B", fontWeight:600, marginTop:"3px"}}>{filtered.length} filtered • Scroll to load more • Audit-locked</div></div>
          <div style={{display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center"}}>
            <select value={typeF} onChange={e=>setTypeF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px"}}><option value="All">All Types</option><option value="Income">Income</option><option value="Expenditure">Expenditure</option></select>
            <select value={catF} onChange={e=>setCatF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px", minWidth:"150px"}}><option value="All">All Categories</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select>
            <select value={workshopF} onChange={e=>setWorkshopF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px", minWidth:"170px"}}><option value="All">All Workshops</option>{workshopsList.map(w=><option key={w} value={w}>{w}</option>)}</select>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 10px", fontSize:"13px"}} />
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 10px", fontSize:"13px"}} />
            <div style={{position:"relative"}}><i className="bi bi-search" style={{position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", color:"#94A3B8"}}></i><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search description, workshop..." style={{height:"44px", width:"220px", borderRadius:"12px", border:"1.5px solid #E2E8F0", background:"#F8FAFC", padding:"0 14px 0 40px", fontSize:"14px", fontWeight:600}} /></div>
          </div>
        </div>

        <div style={{overflowX:"auto", borderRadius:"14px", border:"1.5px solid #E2E8F0"}}>
          <table className="table owner-table" style={{margin:0}}>
            <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description / Workshop</th><th>Method</th><th style={{textAlign:"right"}}>Amount</th><th style={{textAlign:"right"}}>View</th></tr></thead>
            <tbody>
              {visibleRows.map(r=>(
                <tr key={r.id}>
                  <td style={{fontWeight:700, fontSize:"14px"}}>{r.date}<div style={{fontSize:"11px", color:"#64748B"}}>{r.receipt}</div></td>
                  <td><span style={{padding:"5px 12px", borderRadius:"20px", fontSize:"11px", fontWeight:800, background: r.type==="Income"?"#DCFCE7":"#FEE2E2", color: r.type==="Income"?"#166534":"#991B1B", border:"1px solid #E2E8F0"}}>{r.type}</span></td>
                  <td style={{fontWeight:700, fontSize:"13px"}}>{r.category}</td>
                  <td><div style={{fontWeight:800, fontSize:"14px", color:"#0A192F"}}>{r.description}</div><div style={{fontSize:"12px", color:"#64748B"}}>{r.workshop} • {r.status}</div></td>
                  <td style={{fontSize:"12px", fontWeight:700}}>{r.method}</td>
                  <td style={{textAlign:"right", fontWeight:900, color: r.type==="Income" ? "#166534" : "#991B1B", fontSize:"15px"}}>{r.type==="Income" ? "+" : "-"}${r.amount.toLocaleString()}</td>
                  <td><div style={{display:"flex", justifyContent:"flex-end"}}><button onClick={()=>openDetail(r)} style={{height:"36px", padding:"0 14px", borderRadius:"10px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"13px"}}>View</button></div></td>
                </tr>
              ))}
              {visibleRows.length===0 && !loading && <tr><td colSpan={7} style={{padding:20, textAlign:"center", color:"#94A3B8"}}>No ledger entries yet. Add an income or expenditure first.</td></tr>}
            </tbody>
          </table>
        </div>

        <div ref={loaderRef} style={{padding:"18px", textAlign:"center"}}>
          {visibleCount < filtered.length ? (
            <div style={{display:"inline-flex", gap:"10px", alignItems:"center", background:"#F8FAFC", border:"1.5px solid #E2E8F0", padding:"10px 18px", borderRadius:"20px", fontWeight:700, fontSize:"13px", color:"#64748B"}}>
              <span className="spinner-border spinner-border-sm" style={{width:"16px", height:"16px"}}></span> Loading {Math.min(8, filtered.length - visibleCount)} more... • {visibleRows.length}/{filtered.length}
            </div>
          ) : (
            <div style={{fontSize:"13px", fontWeight:700, color:"#94A3B8"}}>All {filtered.length} ledger rows loaded • Income ${totalInc.toLocaleString()} • Expenditure ${totalExp.toLocaleString()} • Profit ${profit.toLocaleString()} • 112 S Market St Inglewood CA 90301 • PST</div>
          )}
        </div>
      </div>

      {showDetail && selected && (
        <div className="modal-overlay" onClick={()=>setShowDetail(false)}>
          <div className="modal-box" style={{maxWidth:"560px"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:"#0A192F", padding:"18px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", color:"#fff"}}>
              <div><div style={{fontWeight:900, fontSize:"16px"}}>{selected.id} • {selected.type} • {selected.type==="Income" ? "+" : "-"}${selected.amount.toLocaleString()}</div><div style={{fontSize:"12px", color:"#94A3B8"}}>{selected.date} • {selected.receipt} • Audit-locked</div></div>
              <button onClick={()=>setShowDetail(false)} style={{width:"38px", height:"38px", borderRadius:"12px", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.18)", color:"#fff"}}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={{padding:"22px", display:"grid", gap:"12px"}}>
              <div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"14px"}}><div style={{fontWeight:900, fontSize:"15px", color:"#0A192F"}}>{selected.description}</div><div style={{fontSize:"13px", color:"#64748B"}}>{selected.workshop} • {selected.category} • {selected.method} • {selected.status}</div></div>
              <button onClick={()=>setShowDetail(false)} style={{height:"44px", borderRadius:"12px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"14px"}}>Close • {selected.id}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}