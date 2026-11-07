import { useState, useMemo, useEffect, useRef } from "react";

export default function AdminExpenditures(){
  const categories = ["Rent","Software","Marketing","Salaries","Utilities","Maintenance","Office","Legal","Other"];

  const [initial, setInitial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workshops, setWorkshops] = useState([]);

  const load = ()=>{
    setLoading(true);
    fetch("http://127.0.0.1:5000/api/admin/expenditures?limit=200&offset=0")
      .then(r=>r.json())
      .then(data=>{
        const arr = Array.isArray(data) ? data : [];
        const mapped = arr.map((x)=>{
          const dateStr = String(x.date || x.created_at || new Date().toISOString()).split("T")[0];
          return {
            id: "EXP-"+x.id,
            rawId: x.id,
            category: x.category || "Other",
            description: x.description || "Platform expense",
            amount: Number(x.amount || 0),
            vendor: x.vendor || "Ayinde Technologies",
            receipt: x.receipt_id || ("RCPT-EXP-"+x.id),
            method: x.method || "Card",
            date: dateStr,
            approvedBy: x.approved_by || "Ayinde Admin",
            workshop: x.workshop_name || "Platform • Ayinde Technologies",
            workshopId: x.workshop_id || null,
          };
        });
        mapped.sort((a,b)=> new Date(b.date) - new Date(a.date));
        setInitial(mapped);
        setLoading(false);
      })
      .catch(()=> setLoading(false));

    // for Add form + Workshop filter
    fetch("http://127.0.0.1:5000/api/workshops?limit=200")
      .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setWorkshops(d); })
      .catch(()=>{});
  };

  useEffect(()=>{ load(); },[]);

  const workshopsList = useMemo(()=>{
    const s = {}; initial.forEach(r=> s[r.workshop]=1);
    return Object.keys(s);
  },[initial]);

  const [q,setQ]=useState("");
  const [workshopF,setWorkshopF]=useState("All");
  const [catF,setCatF]=useState("All");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [visibleCount,setVisibleCount]=useState(10);
  const [selected,setSelected]=useState(null);
  const [showDetail,setShowDetail]=useState(false);
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({category:"Rent", description:"", amount:"", vendor:"", method:"Card", date:new Date().toISOString().split("T")[0], workshop_id:""});
  const [saving,setSaving]=useState(false);
  const loaderRef = useRef(null);

  const filtered = useMemo(()=>{
    return initial.filter(r=>{
      var matchQ = (r.description+" "+r.vendor+" "+r.id+" "+r.category+" "+r.receipt+" "+r.workshop).toLowerCase().indexOf(q.toLowerCase())>-1;
      var matchW = workshopF==="All" || r.workshop===workshopF;
      var matchC = catF==="All" || r.category===catF;
      var matchFrom = !dateFrom || r.date >= dateFrom;
      var matchTo = !dateTo || r.date <= dateTo;
      return matchQ && matchW && matchC && matchFrom && matchTo;
    });
  },[initial,q,workshopF,catF,dateFrom,dateTo]);

  const visibleRows = useMemo(()=> filtered.slice(0, visibleCount), [filtered, visibleCount]);
  useEffect(()=>{ setVisibleCount(10); },[q,workshopF,catF,dateFrom,dateTo]);

  useEffect(()=>{
    var obs = new IntersectionObserver((entries)=>{
      if(entries[0].isIntersecting && visibleCount < filtered.length) setVisibleCount(c=> c + 8);
    },{threshold:0.1});
    if(loaderRef.current) obs.observe(loaderRef.current);
    return ()=> obs.disconnect();
  },[filtered.length, visibleCount]);

  const total = initial.reduce((s,r)=>s+r.amount,0);
  const totalFiltered = filtered.reduce((s,r)=>s+r.amount,0);
  const topCat = useMemo(()=>{
    const m={}; filtered.forEach(r=> m[r.category]=(m[r.category]||0)+r.amount);
    const k = Object.keys(m).sort((a,b)=> m[b]-m[a])[0];
    return k ? k+" • $"+m[k].toLocaleString() : "—";
  },[filtered]);

  function openDetail(r){ setSelected(r); setShowDetail(true); }

  async function handleAdd(e){
    e.preventDefault();
    if(!form.description || !form.amount) return alert("Description + Amount required");
    setSaving(true);
    const res = await fetch("http://127.0.0.1:5000/api/admin/expenditures",{
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
        vendor: form.vendor || "Ayinde Technologies",
        method: form.method,
        date: form.date,
        approved_by: "Ayinde Admin",
        workshop_id: form.workshop_id ? Number(form.workshop_id) : null,
      })
    });
    setSaving(false);
    if(res.ok){ setShowAdd(false); setForm({category:"Rent", description:"", amount:"", vendor:"", method:"Card", date:new Date().toISOString().split("T")[0], workshop_id:""}); load(); }
    else alert("Failed to save expenditure");
  }

  return (
    <div style={{display:"grid", gap:"16px", fontSize:"15px"}}>
      <style>{`
        .owner-card{ background:#fff; border:1.5px solid #E2E8F0; border-radius:18px; padding:18px; }
        .owner-table th{ font-size:12px; font-weight:800; color:#475569; text-transform:uppercase; background:#F8FAFC; padding:14px 12px; }
        .owner-table td{ padding:14px 12px; vertical-align:middle; font-size:15px; }
        .modal-overlay{ position:fixed; inset:0; background:rgba(10,25,47,0.65); backdrop-filter:blur(6px); z-index:90; display:grid; place-items:center; padding:16px; }
        .modal-box{ width:100%; background:#fff; border-radius:22px; border:1.5px solid #E2E8F0; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.2); animation:pop 0.22s ease; }
        @keyframes pop{ from{transform:scale(0.96) translateY(8px); opacity:0} to{transform:scale(1) translateY(0); opacity:1} }
        .inp{ height:44px; border-radius:12px; border:1.5px solid #E2E8F0; padding:0 12px; font-weight:600; font-size:14px; width:100%; }
      `}</style>

      <div className="row g-3" style={{margin:0, width:"100%"}}>
        <div className="col-6 col-lg-3"><div style={{background:"#0A192F", borderRadius:"18px", padding:"18px", color:"#fff"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>TOTAL EXPENDITURES (ALL)</div><div style={{fontSize:"30px", fontWeight:900}}>${loading ? "..." : total.toLocaleString()}</div><div style={{fontSize:"12px", color:"#CBD5E1"}}>{initial.length} records • Audit-locked • No delete</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#FEF2F2", borderColor:"#FECACA"}}><div style={{fontSize:"11px", fontWeight:800, color:"#991B1B"}}>FILTERED EXPENDITURES</div><div style={{fontSize:"28px", fontWeight:900, color:"#991B1B"}}>${totalFiltered.toLocaleString()}</div><div style={{fontSize:"12px", color:"#DC2626"}}>{filtered.length} records</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card"><div style={{fontSize:"11px", fontWeight:800, color:"#64748B"}}>TOP CATEGORY (FILTERED)</div><div style={{fontSize:"16px", fontWeight:900, color:"#0A192F"}}>{topCat}</div><div style={{fontSize:"12px", color:"#64748B"}}>{categories.length} categories</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#DCFCE7", borderColor:"#BBF7D0"}}><div style={{fontSize:"11px", fontWeight:800, color:"#166534"}}>LA • PST • BAR</div><div style={{fontSize:"16px", fontWeight:900, color:"#166534"}}>112 S Market St</div><div style={{fontSize:"11px", color:"#16A34A"}}>Inglewood CA 90301</div></div></div>
      </div>

      <div className="owner-card" style={{padding:"20px"}}>
        <div style={{display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:"12px", marginBottom:"16px"}}>
          <div><div style={{fontWeight:900, fontSize:"18px", color:"#0A192F"}}><i className="bi bi-graph-down-arrow me-2"></i>Expenditures • Platform • Lazy-Load</div><div style={{fontSize:"13px", color:"#64748B", fontWeight:600, marginTop:"3px"}}>{filtered.length} filtered • Scroll to load more • Audit-locked — to correct, add offsetting income in Incomes</div></div>
          <div style={{display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center"}}>
            <button onClick={()=>setShowAdd(true)} style={{height:"44px", padding:"0 16px", borderRadius:"12px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"14px"}}>+ Add Expenditure</button>
            <select value={workshopF} onChange={e=>setWorkshopF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px", minWidth:"170px"}}><option value="All">All Workshops / Platform</option>{workshopsList.map(w=><option key={w} value={w}>{w}</option>)}</select>
            <select value={catF} onChange={e=>setCatF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px"}}><option value="All">All Categories</option>{categories.map(p=><option key={p} value={p}>{p}</option>)}</select>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 10px", fontSize:"13px"}} />
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 10px", fontSize:"13px"}} />
            <div style={{position:"relative"}}><i className="bi bi-search" style={{position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", color:"#94A3B8"}}></i><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search description, vendor..." style={{height:"44px", width:"220px", borderRadius:"12px", border:"1.5px solid #E2E8F0", background:"#F8FAFC", padding:"0 14px 0 40px", fontSize:"14px", fontWeight:600}} /></div>
          </div>
        </div>

        <div style={{overflowX:"auto", borderRadius:"14px", border:"1.5px solid #E2E8F0"}}>
          <table className="table owner-table" style={{margin:0}}>
            <thead><tr><th>ID</th><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Vendor / Method</th><th>Workshop</th><th style={{textAlign:"right"}}>View</th></tr></thead>
            <tbody>
              {visibleRows.map(r=>(
                <tr key={r.id}>
                  <td style={{fontWeight:900, fontSize:"13px"}}>{r.id}</td>
                  <td style={{fontWeight:700, fontSize:"14px"}}>{r.date}</td>
                  <td><div style={{fontWeight:800, fontSize:"14px", color:"#0A192F"}}>{r.description}</div><div style={{fontSize:"12px", color:"#64748B"}}>{r.receipt} • {r.approvedBy}</div></td>
                  <td><span style={{background:"#FEF3C7", color:"#92400E", border:"1px solid #E2E8F0", padding:"5px 12px", borderRadius:"20px", fontSize:"12px", fontWeight:800}}>{r.category}</span></td>
                  <td style={{fontWeight:900, color:"#991B1B", fontSize:"15px"}}>${r.amount.toLocaleString()}</td>
                  <td style={{fontSize:"12px", fontWeight:700}}>{r.vendor}<div style={{fontSize:"11px", color:"#94A3B8"}}>{r.method}</div></td>
                  <td style={{fontSize:"13px", fontWeight:700}}>{r.workshop}</td>
                  <td><div style={{display:"flex", justifyContent:"flex-end"}}><button onClick={()=>openDetail(r)} style={{height:"36px", padding:"0 14px", borderRadius:"10px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"13px"}}>View</button></div></td>
                </tr>
              ))}
              {visibleRows.length===0 && !loading && <tr><td colSpan={8} style={{padding:20, textAlign:"center", color:"#94A3B8"}}>No expenditures yet. Add one to track platform costs.</td></tr>}
            </tbody>
          </table>
        </div>

        <div ref={loaderRef} style={{padding:"18px", textAlign:"center"}}>
          {visibleCount < filtered.length ? (
            <div style={{display:"inline-flex", gap:"10px", alignItems:"center", background:"#F8FAFC", border:"1.5px solid #E2E8F0", padding:"10px 18px", borderRadius:"20px", fontWeight:700, fontSize:"13px", color:"#64748B"}}>
              <span className="spinner-border spinner-border-sm" style={{width:"16px", height:"16px"}}></span> Loading {Math.min(8, filtered.length - visibleCount)} more... • {visibleRows.length}/{filtered.length} • ${totalFiltered.toLocaleString()}
            </div>
          ) : (
            <div style={{fontSize:"13px", fontWeight:700, color:"#94A3B8"}}>All {filtered.length} expenditures loaded • ${totalFiltered.toLocaleString()} filtered • 112 S Market St Inglewood CA 90301 • PST</div>
          )}
        </div>
      </div>

      {showDetail && selected && (
        <div className="modal-overlay" onClick={()=>setShowDetail(false)}>
          <div className="modal-box" style={{maxWidth:"620px"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:"#0A192F", padding:"18px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", color:"#fff"}}>
              <div><div style={{fontWeight:900, fontSize:"16px"}}>{selected.id} • {selected.category} • ${selected.amount.toLocaleString()}</div><div style={{fontSize:"12px", color:"#94A3B8"}}>{selected.date} • {selected.receipt} • Audit-locked</div></div>
              <button onClick={()=>setShowDetail(false)} style={{width:"38px", height:"38px", borderRadius:"12px", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.18)", color:"#fff"}}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={{padding:"22px", display:"grid", gap:"16px"}}>
              <div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"14px"}}><div style={{fontWeight:900, fontSize:"16px", color:"#0A192F"}}>{selected.description}</div><div style={{fontSize:"13px", color:"#64748B"}}>{selected.vendor} • {selected.method} • {selected.workshop}</div><div style={{fontSize:"12px", color:"#64748B"}}>Approved by {selected.approvedBy} • No delete — audit-locked</div></div>
              <button onClick={()=>setShowDetail(false)} style={{height:"44px", borderRadius:"12px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"14px"}}>Close • {selected.id}</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={()=>setShowAdd(false)}>
          <div className="modal-box" style={{maxWidth:"560px"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:"#0A192F", padding:"18px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", color:"#fff"}}>
              <div style={{fontWeight:900, fontSize:"16px"}}>Add Expenditure • Audit-locked</div>
              <button onClick={()=>setShowAdd(false)} style={{width:"38px", height:"38px", borderRadius:"12px", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.18)", color:"#fff"}}><i className="bi bi-x-lg"></i></button>
            </div>
            <form onSubmit={handleAdd} style={{padding:"22px", display:"grid", gap:"12px"}}>
              <select className="inp" value={form.category} onChange={e=>setForm({...form, category:e.target.value})}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select>
              <input className="inp" placeholder="Description — e.g. Office rent Jan" value={form.description} onChange={e=>setForm({...form, description:e.target.value})} />
              <div className="row g-2" style={{margin:0, width:"100%"}}>
                <div className="col-6"><input className="inp" type="number" placeholder="Amount $" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} /></div>
                <div className="col-6"><input className="inp" placeholder="Vendor" value={form.vendor} onChange={e=>setForm({...form, vendor:e.target.value})} /></div>
              </div>
              <div className="row g-2" style={{margin:0, width:"100%"}}>
                <div className="col-6"><select className="inp" value={form.method} onChange={e=>setForm({...form, method:e.target.value})}><option>Card</option><option>Cash</option><option>Bank Transfer</option><option>Check</option></select></div>
                <div className="col-6"><input className="inp" type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} /></div>
              </div>
              <select className="inp" value={form.workshop_id} onChange={e=>setForm({...form, workshop_id:e.target.value})}><option value="">Platform — Ayinde Technologies (no workshop)</option>{workshops.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
              <button disabled={saving} style={{height:"46px", borderRadius:"12px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800}}>{saving ? "Saving..." : "Save Expenditure • Audit-locked"}</button>
              <div style={{fontSize:"12px", color:"#64748B", textAlign:"center"}}>No delete after save. To correct, add offsetting income in Incomes.</div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}