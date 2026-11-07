import { useState, useMemo, useEffect, useCallback } from "react";
import Swal from "sweetalert2";

const API = "http://127.0.0.1:5000/api";

function getStoredUser(){ try{ return JSON.parse(localStorage.getItem("autoville_user")||"{}"); }catch{ return {}; } }

function normalizeExpense(e){
  const dateStr = String(e.expense_date || e.date || e.created_at || "").slice(0,10);
  const timeStr = e.expense_time || e.time || (e.created_at ? String(e.created_at).slice(11,16) + " PST" : "");
  return {
    dbId: e.id,
    id: `#EXP-${e.id}`,
    auditId: e.audit_id || e.auditId || `AUD-${new Date().getFullYear()}-0000`,
    receiptId: e.receipt_id || e.receiptId || "",
    date: dateStr,
    time: timeStr || "12:00 PM PST",
    category: e.category || "Other",
    desc: e.description || e.desc || "",
    amount: Number(e.amount ?? 0),
    vendor: e.vendor || "General",
    method: e.payment_method || e.method || "Card",
    booking: e.booking_id ? `#AV-${e.booking_id}` : (e.booking || e.bookingId || "-"),
    bookingDbId: e.booking_id || null,
    mechanic: e.mechanic || "-",
    receipt: e.receipt || "Yes",
    bar: e.bar || "ARD 284719",
    raw: e,
  };
}

export default function MechanicExpensesPage({ expenses: extExpenses, setExpenses: extSetExpenses, changeTab, workshopId: propWorkshopId, workshop }) {
  const storedUser = getStoredUser();
  const workshopId = propWorkshopId || workshop?.id || storedUser.id || storedUser.workshop_id || storedUser.workshopId;
  const workshopName = workshop?.business_name || workshop?.name || storedUser.business_name || "Workshop";

  const [localExpenses, setLocalExpenses] = useState([]);
  const expenses = extExpenses && extExpenses.length && !workshopId ? extExpenses : localExpenses;
  const setExpenses = extSetExpenses || setLocalExpenses;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [dateF, setDateF] = useState("All");
  const [page, setPage] = useState(0);
  const perPage = 5;
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [bookingsList, setBookingsList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({category:"Parts", desc:"", amount:"", vendor:"", method:"Card", date:new Date().toISOString().slice(0,10), booking:""});

  const fetchExpenses = useCallback(async ()=>{
    if(!workshopId){ setLoading(false); return; }
    setLoading(true); setError("");
    try{
      let res = await fetch(`${API}/workshops/${workshopId}/expenses?limit=200`);
      let data = await res.json().catch(()=>[]);
      if(!res.ok){
        res = await fetch(`${API}/expenses?workshop_id=${workshopId}&limit=200`);
        data = await res.json().catch(()=>[]);
        if(!res.ok) throw new Error(data.error || "Failed to load expenses");
      }
      const list = Array.isArray(data) ? data : (data.expenses || data.data || []);
      const norm = list.map(normalizeExpense);
      setLocalExpenses(norm);
      if(extSetExpenses) extSetExpenses(norm);
    }catch(e){ setError(e.message || "Could not load expenses. Is Flask running on :5000?"); setLocalExpenses([]); }
    setLoading(false);
  }, [workshopId]);

  const fetchBookingsForForm = useCallback(async ()=>{
    if(!workshopId) return;
    try{
      const res = await fetch(`${API}/bookings?workshop_id=${workshopId}&limit=200`);
      const data = await res.json().catch(()=>[]);
      setBookingsList(Array.isArray(data) ? data : (data.bookings || []));
    }catch{}
  }, [workshopId]);

  useEffect(()=>{ fetchExpenses(); fetchBookingsForForm(); }, [fetchExpenses, fetchBookingsForForm]);

  const filtered = useMemo(()=>{
    let d=[...expenses];
    if(search){ const s=search.toLowerCase(); d=d.filter(e=> `${e.id} ${e.desc} ${e.vendor} ${e.category} ${e.booking} ${e.auditId||""}`.toLowerCase().includes(s)); }
    if(category!=="All") d=d.filter(e=>e.category===category);
    if(dateF==="Today"){ const t=new Date().toISOString().slice(0,10); d=d.filter(e=>e.date===t); }
    if(dateF==="This Week") d=d.filter(e=> e.date && new Date(e.date) >= new Date(Date.now()-7*86400000));
    d.sort((a,b)=> new Date(b.date||"1970-01-01") - new Date(a.date||"1970-01-01"));
    return d;
  },[expenses, search, category, dateF]);

  const totalPages = Math.ceil(filtered.length/perPage);
  const paged = filtered.slice(page*perPage, page*perPage+perPage);

  const stats = {
    total: expenses.reduce((s,e)=>s+e.amount,0),
    parts: expenses.filter(e=>e.category==="Parts").reduce((s,e)=>s+e.amount,0),
    labor: expenses.filter(e=>e.category==="Labor").reduce((s,e)=>s+e.amount,0),
    fixed: expenses.filter(e=>["Rent","Utilities"].includes(e.category)).reduce((s,e)=>s+e.amount,0),
  };

  const handleBookingSelect = (label)=>{
    setForm(prev=> ({...prev, booking: label}));
    const idNum = String(label||"").replace("#AV-","").trim();
    const found = bookingsList.find(b=> String(b.id)===idNum);
    if(found && !form.desc){
      setForm(prev=> ({...prev, booking: label, desc: prev.desc || `${found.service_type || found.service || ""} • ${found.car_make || ""} ${found.car_model || ""}`.trim()}));
    }
  };

  const addExpense = async ()=>{
    if(!form.desc || !form.amount){
      Swal.fire({icon:"warning", title:"Missing Fields", text:"Description & amount are required", confirmButtonColor:"#0A192F"});
      return;
    }
    if(!workshopId){
      Swal.fire({icon:"error", title:"No Workshop", text:"No workshop ID. Please login again.", confirmButtonColor:"#0A192F"});
      return;
    }
    setSaving(true);
    try{
      const bookingIdNum = String(form.booking||"").replace("#AV-","").replace("AV-","").trim();
      const payload = {
        workshop_id: workshopId,
        booking_id: /^\d+$/.test(bookingIdNum) ? Number(bookingIdNum) : null,
        booking: form.booking,
        category: form.category,
        description: form.desc, desc: form.desc,
        amount: Number(form.amount),
        vendor: form.vendor || "General",
        payment_method: form.method, method: form.method,
        expense_date: form.date, date: form.date,
        mechanic: storedUser.full_name || storedUser.name || "-",
        bar: "ARD 284719",
      };
      let res = await fetch(`${API}/workshops/${workshopId}/expenses`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
      let raw = await res.text();
      let data = {};
      try{ data = JSON.parse(raw); }catch{}
      if(!res.ok){
        // fallback
        res = await fetch(`${API}/expenses`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
        raw = await res.text();
        try{ data = JSON.parse(raw); }catch{ data = {}; }
        if(!res.ok) throw new Error(`HTTP ${res.status} - ${data.error || raw.slice(0,300) || "Failed to log expense"}`);
      }
      const created = data.expense || data.data || data;
      const ne = created && created.id ? normalizeExpense(created) : { dbId: Date.now(), id:`#EXP-${2000+expenses.length+1}`, auditId:`AUD-${new Date().getFullYear()}-${String(expenses.length+1).padStart(4,'0')}`, date: form.date, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})+" PST", category: form.category, desc: form.desc, amount: Number(form.amount), vendor: form.vendor||"General", method: form.method, booking: form.booking||"-", mechanic:"-", receipt:"Yes", bar:"ARD 284719" };
      setExpenses([ne, ...expenses]);
      setShowAdd(false);
      setForm({category:"Parts", desc:"", amount:"", vendor:"", method:"Card", date:new Date().toISOString().slice(0,10), booking:""});
      await fetchExpenses();
      Swal.fire({icon:"success", title:"Expense Logged", text:`$${form.amount} • ${form.category} • Audit Locked • ${ne.auditId}`, confirmButtonColor:"#991B1B"});
    }catch(e){
      Swal.fire({icon:"error", title:"Failed to Log Expense", text: e.message, confirmButtonColor:"#0A192F"});
    }
    setSaving(false);
  };

  const catColor=(c)=> c==="Parts"?{bg:"#DBEAFE", color:"#1E40AF"}: c==="Labor"?{bg:"#E0E7FF", color:"#3730A3"}: c==="Rent"?{bg:"#FEF3C7", color:"#92400E"}: c==="Utilities"?{bg:"#FCE7F3", color:"#9D174D"}: {bg:"#F1F5F9", color:"#475569"};

  if(loading) return <div style={{padding:"40px", textAlign:"center", color:"#64748B"}}>Loading expenses from backend...</div>;

  return (
    <>
    <style>{`
      .exp-wrap{ width:100%; max-width:100%; overflow:hidden; }
      .exp-stat{ background:#fff; border:1.5px solid #0A192F; border-radius:16px; padding:16px; height:100%; }
      .exp-toolbar{ background:#fff; border:1.5px solid #E2E8F0; border-radius:16px; padding:14px; display:flex; gap:10px; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom:14px; }
      .exp-search{ position:relative; flex:1; min-width:220px; max-width:340px; } .exp-search input{ width:100%; height:46px; border:1.5px solid #E2E8F0; border-radius:12px; padding:0 14px 0 42px; font-size:15px; font-weight:600; background:#F8FAFC; outline:none; } .exp-search i{ position:absolute; left:14px; top:50%; transform:translateY(-50%); color:#6B7A90; }
      .exp-table-wrap{ background:#fff; border:1.5px solid #E2E8F0; border-radius:16px; overflow:hidden; width:100%; }
      .exp-table{ width:100%; border-collapse:collapse; table-layout:fixed; } .exp-table th{ text-align:left; font-size:11px; font-weight:900; color:#6B7A90; padding:14px 10px; border-bottom:1.5px solid #E2E8F0; background:#F8FAFC; text-transform:uppercase; }
      .exp-table th:nth-child(1){ width:16%; } .exp-table th:nth-child(2){ width:14%; } .exp-table th:nth-child(3){ width:32%; } .exp-table th:nth-child(4){ width:12%; } .exp-table th:nth-child(5){ width:14%; } .exp-table th:nth-child(6){ width:12%; }
      .exp-table td{ padding:12px 10px; font-size:13px; font-weight:600; color:#0A192F; border-bottom:1px solid #E2E8F0; vertical-align:middle; }
      .exp-mobile{ display:none; } @media(max-width: 768px){ .exp-table-wrap.desktop{ display:none; } .exp-mobile{ display:grid; gap:12px; } .exp-toolbar{ flex-direction:column; align-items:stretch; } .exp-search{ max-width:100%; } }
      .exp-modal-backdrop{ position:fixed; inset:0; background:rgba(10,25,47,0.55); backdrop-filter:blur(6px); z-index:99; display:grid; place-items:center; padding:16px; } .exp-modal{ width:100%; max-width:640px; max-height:92vh; overflow:auto; background:#fff; border:2px solid #0A192F; border-radius:22px; box-shadow:0 30px 80px rgba(0,0,0,0.25); }
      .bk-input,.bk-select{ height:46px; border-radius:12px; border:1.5px solid #E2E8F0; background:#F8FAFC; font-weight:600; font-size:14px; padding:0 14px; width:100%; }
    `}</style>

    <div className="exp-wrap">
      <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', marginBottom:'12px'}}>
        <div><h2 style={{fontWeight:900, fontSize:'28px', color:'#0A192F', margin:'0 0 6px'}}>Expenses • Audit Locked</h2><p style={{color:'#6B7A90', fontSize:'15px', margin:0, fontWeight:500}}>Immutable cost records • BAR ARD 284719 • USD • PST • CA Audit • {workshopName}</p></div>
        <div style={{display:'flex', gap:'8px', alignSelf:'flex-start'}}>
          <button onClick={fetchExpenses} style={{height:'46px', borderRadius:'12px', background:'#fff', border:'1.5px solid #E2E8F0', fontWeight:800, fontSize:'13px', padding:'0 14px'}}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
          <button onClick={()=>setShowAdd(true)} style={{height:'46px', borderRadius:'12px', background:'#991B1B', color:'#fff', border:'none', fontWeight:800, fontSize:'13px', padding:'0 18px'}}><i className="bi bi-plus-lg me-1"></i> Log Expense</button>
        </div>
      </div>

      {error && <div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", color:"#991B1B", padding:"12px 14px", borderRadius:"12px", marginBottom:"12px", fontSize:"13px", fontWeight:700}}>{error}</div>}

      <div style={{background:'#FEF2F2', border:'1.5px solid #FCA5A5', borderRadius:'12px', padding:'10px 14px', marginBottom:'14px', display:'flex', gap:'10px', alignItems:'center'}}>
        <i className="bi bi-shield-lock-fill" style={{color:'#991B1B', fontSize:'18px'}}></i>
        <div style={{fontSize:'13px', color:'#7F1D1D', fontWeight:600}}><b>Audit Policy:</b> Expense records are immutable and cannot be deleted per California BAR & record retention. To adjust an error, go to Payments page and record a similar income to cancel out the expenditure.</div>
      </div>

      <div className="row g-3 mb-3" style={{margin:0, width:'100%'}}>
        <div className="col-6 col-lg-3"><div className="exp-stat"><div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90'}}>TOTAL EXPENSES</div><div style={{fontWeight:900, fontSize:'26px', marginTop:'6px', color:'#991B1B'}}>${stats.total}</div><div style={{fontSize:'11px', color:'#EF4444', fontWeight:700}}>{expenses.length} locked records</div></div></div>
        <div className="col-6 col-lg-3"><div className="exp-stat"><div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90'}}>PARTS</div><div style={{fontWeight:900, fontSize:'26px', marginTop:'6px'}}>${stats.parts}</div><div style={{fontSize:'11px', color:'#3B82F6'}}>  • O'Reilly</div></div></div>
        <div className="col-6 col-lg-3"><div className="exp-stat"><div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90'}}>LABOR</div><div style={{fontWeight:900, fontSize:'26px', marginTop:'6px'}}>${stats.labor}</div><div style={{fontSize:'11px', color:'#6B7A90'}}>Staff payouts</div></div></div>
        <div className="col-6 col-lg-3"><div className="exp-stat" style={{background:'#0A192F', borderColor:'#0A192F'}}><div style={{fontSize:'11px', fontWeight:800, color:'#94A3B8'}}>FILTERED</div><div style={{fontWeight:900, fontSize:'26px', marginTop:'6px', color:'#fff'}}>${filtered.reduce((s,e)=>s+e.amount,0)}</div><div style={{fontSize:'11px', color:'#FCA5A5'}}>{filtered.length} records shown</div></div></div>
      </div>

      <div className="exp-toolbar">
        <div className="exp-search"><i className="bi bi-search"></i><input placeholder="Search audit ID, vendor, booking..." value={search} onChange={e=>{setSearch(e.target.value); setPage(0);}} /></div>
        <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
          <select value={category} onChange={e=>{setCategory(e.target.value); setPage(0);}} style={{height:'46px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:800, fontSize:'12px', padding:'0 10px'}}><option value="All">All Categories</option><option>Parts</option><option>Labor</option><option>Rent</option><option>Utilities</option><option>Marketing</option><option>Other</option></select>
          <select value={dateF} onChange={e=>{setDateF(e.target.value); setPage(0);}} style={{height:'46px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:800, fontSize:'12px', padding:'0 10px'}}><option value="All">All Dates</option><option value="Today">Today</option><option value="This Week">This Week</option></select>
        </div>
      </div>

      <div className="exp-table-wrap desktop">
        <table className="exp-table">
          <thead><tr><th>Exp ID • Audit ID</th><th>Category</th><th>Description • Vendor</th><th>Method</th><th>Amount</th><th>Action</th></tr></thead>
          <tbody>
            {paged.length===0 ? <tr><td colSpan={6} style={{textAlign:'center', padding:'32px', color:'#6B7A90'}}>{expenses.length===0 ? "No expenses yet. Log your first expense — it becomes audit-locked." : "No expenses found"}</td></tr> :
            paged.map(e=>{
              const cc=catColor(e.category);
              return (
                <tr key={e.id}>
                  <td><b>{e.id}</b><div style={{fontSize:'10px', color:'#6B7A90', fontWeight:700}}>{e.auditId} • {e.date}</div></td>
                  <td><span style={{fontSize:'10px', fontWeight:800, padding:'4px 8px', borderRadius:'20px', background:cc.bg, color:cc.color}}>{e.category.toUpperCase()}</span></td>
                  <td><div style={{fontSize:'12px', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{e.desc}</div><div style={{fontSize:'11px', color:'#6B7A90', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{e.vendor} • {e.booking}</div></td>
                  <td><span style={{fontSize:'11px', fontWeight:700, background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'4px 8px', borderRadius:'20px'}}>{e.method}</span></td>
                  <td style={{fontWeight:900, color:'#991B1B'}}>${e.amount}</td>
                  <td><button onClick={()=>setSelected(e)} style={{height:'34px', borderRadius:'8px', border:'1.5px solid #0A192F', background:'#0A192F', color:'#fff', fontWeight:800, fontSize:'11px', padding:'0 10px'}}>View</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', borderTop:'1.5px solid #E2E8F0', background:'#F8FAFC'}}>
          <div style={{fontSize:'13px', fontWeight:700, color:'#6B7A90'}}>{filtered.length===0 ? "0" : `${page*perPage+1}–${Math.min((page+1)*perPage, filtered.length)}`} of {filtered.length} • Page {page+1}/{totalPages||1}</div>
          <div style={{display:'flex', gap:'8px'}}><button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))} style={{height:'36px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff', fontWeight:800, fontSize:'12px', padding:'0 12px'}}>Prev</button><button disabled={page>=totalPages-1} onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} style={{height:'36px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff', fontWeight:800, fontSize:'12px', padding:'0 12px'}}>Next</button></div>
        </div>
      </div>

      <div className="exp-mobile">
        {paged.map(e=>{
          const cc=catColor(e.category);
          return (
            <div key={e.id} style={{background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:'16px', padding:'16px'}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'6px'}}><b style={{fontSize:'13px'}}>{e.id}</b><span style={{fontSize:'10px', fontWeight:800, padding:'4px 8px', borderRadius:'20px', background:cc.bg, color:cc.color}}>{e.category}</span></div>
              <div style={{fontSize:'12px', fontWeight:800}}>{e.desc}</div>
              <div style={{fontSize:'11px', color:'#6B7A90', marginBottom:'4px'}}>{e.vendor} • {e.auditId}</div>
              <div style={{fontSize:'14px', fontWeight:900, color:'#991B1B', marginBottom:'10px'}}>${e.amount}</div>
              <button onClick={()=>setSelected(e)} style={{width:'100%', height:'44px', borderRadius:'10px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, fontSize:'13px'}}>View • Audit Locked</button>
            </div>
          );
        })}
        {paged.length===0 && <div style={{padding:"24px", textAlign:"center", color:"#6B7A90"}}>No expenses found</div>}
      </div>
    </div>

    {selected && (
      <div className="exp-modal-backdrop" onClick={()=>setSelected(null)}>
        <div className="exp-modal" onClick={e=>e.stopPropagation()}>
          <div style={{padding:'16px', borderBottom:'1.5px solid #FCA5A5', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#FEF2F2', position:'sticky', top:0, zIndex:2}}>
            <div><div style={{fontWeight:900, fontSize:'15px', color:'#991B1B'}}>{selected.id} • {selected.auditId} • Audit Locked</div><div style={{fontSize:'11px', color:'#6B7A90'}}>{selected.date} • {selected.time} • {selected.bar} • Inglewood, CA</div></div>
            <button onClick={()=>setSelected(null)} style={{width:'36px', height:'36px', borderRadius:'10px', border:'1.5px solid #FCA5A5', background:'#fff'}}><i className="bi bi-x-lg"></i></button>
          </div>
          <div style={{padding:'16px', display:'grid', gap:'14px'}}>
            <div style={{background:'#FFFBEB', border:'1.5px solid #FDE68A', borderRadius:'12px', padding:'12px', display:'flex', gap:'10px'}}>
              <i className="bi bi-shield-check" style={{color:'#92400E', fontSize:'20px'}}></i>
              <div style={{fontSize:'13px', color:'#92400E', fontWeight:600, lineHeight:1.5}}><b>Audit Immutable Record • No Deletion</b><br/>This expense cannot be deleted per California BAR record retention & IRS audit trail. Original entry must remain in bookkeeping.</div>
            </div>
            <div style={{border:'1.5px solid #0A192F', borderRadius:'14px', padding:'14px'}}>
              <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'8px'}}><div style={{fontSize:'11px', color:'#6B7A90', fontWeight:800}}>{workshopName.toUpperCase()} • COST RECORD • IMMUTABLE • {selected.auditId}</div><span style={{fontSize:'10px', fontWeight:800, padding:'4px 8px', borderRadius:'20px', background:catColor(selected.category).bg, color:catColor(selected.category).color}}>{selected.category.toUpperCase()}</span></div>
              <div style={{marginTop:'10px', fontSize:'13px', lineHeight:1.6}}><b>Audit ID:</b> {selected.auditId} • <b>Exp ID:</b> {selected.id} {selected.receiptId ? `• Receipt: ${selected.receiptId}` : ""}<br/><b>Description:</b> {selected.desc}<br/><b>Vendor:</b> {selected.vendor}<br/><b>Booking:</b> {selected.booking} • <b>Method:</b> {selected.method} • <b>BAR:</b> {selected.bar}<br/><b>Date:</b> {selected.date} {selected.time} PST</div>
              <div style={{borderTop:'1px dashed #E2E8F0', margin:'12px 0'}}></div>
              <div style={{display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:'16px'}}><span>Amount • Immutable</span><span style={{color:'#991B1B'}}>${selected.amount} USD</span></div>
            </div>
            <div style={{background:'#F0FDF4', border:'1.5px solid #BBF7D0', borderRadius:'12px', padding:'12px', display:'flex', gap:'10px'}}>
              <i className="bi bi-arrow-left-right" style={{color:'#166534', fontSize:'20px'}}></i>
              <div style={{fontSize:'13px', color:'#166534', fontWeight:600, lineHeight:1.5}}><b>How to adjust this expense:</b><br/>You cannot delete this record. To cancel out this expenditure, go to <b>Payments page</b> and record a similar income of <b>${selected.amount}</b> referencing {selected.id} / {selected.auditId}. This keeps audit trail intact while netting P/L to zero.</div>
            </div>
            <div style={{fontSize:'11px', color:'#6B7A90', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'12px', padding:'10px'}}><i className="bi bi-info-circle me-1"></i>Ayinde Technologies • 112 S Market St, Ste 1008, Inglewood, CA 90301 • BAR ARD 284719 • For audit compliance, keep original + offsetting income in Payments.</div>
            <button onClick={()=>setSelected(null)} style={{height:'48px', borderRadius:'12px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, fontSize:'14px'}}>Close • Audit Locked Record</button>
            <div style={{textAlign:'center'}}><span style={{fontSize:'11px', fontWeight:800, color:'#991B1B', background:'#FEF2F2', border:'1px solid #FCA5A5', padding:'6px 12px', borderRadius:'20px'}}><i className="bi bi-lock-fill me-1"></i>Deletion Disabled • Use Payments to Offset</span></div>
          </div>
        </div>
      </div>
    )}

    {showAdd && (
      <div className="exp-modal-backdrop" onClick={()=>setShowAdd(false)}>
        <div className="exp-modal" style={{maxWidth:'520px'}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:'16px', background:'#FEF2F2', borderBottom:'1.5px solid #FCA5A5', display:'flex', justifyContent:'space-between', alignItems:'center'}}><div style={{fontWeight:900, color:'#991B1B'}}><i className="bi bi-receipt-cutoff me-2"></i>Log Expense • Immutable After Save</div><button onClick={()=>setShowAdd(false)} style={{width:'36px', height:'36px', borderRadius:'10px', border:'1.5px solid #FCA5A5', background:'#fff'}}><i className="bi bi-x-lg"></i></button></div>
          <div style={{padding:'16px', display:'grid', gap:'12px'}}>
            <div style={{background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:'10px', padding:'8px 10px', fontSize:'11px', color:'#92400E', fontWeight:700}}><i className="bi bi-exclamation-triangle me-1"></i>Once saved, this record cannot be deleted. To correct later, record similar income in Payments page.</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}><input type="date" className="bk-input" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} /><select className="bk-select" value={form.category} onChange={e=>setForm({...form, category:e.target.value})}><option>Parts</option><option>Labor</option><option>Rent</option><option>Utilities</option><option>Marketing</option><option>Other</option></select></div>
            <input className="bk-input" placeholder="Description - Brembo rotors for Camry • OEM" value={form.desc} onChange={e=>setForm({...form, desc:e.target.value})} />
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}><input type="number" className="bk-input" placeholder="Amount 210" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} /><select className="bk-select" value={form.method} onChange={e=>setForm({...form, method:e.target.value})}><option>Card</option><option>Cash</option><option>Zelle</option><option>Transfer</option></select></div>
            <input className="bk-input" placeholder="Vendor AutoZone Inglewood" value={form.vendor} onChange={e=>setForm({...form, vendor:e.target.value})} />
            {bookingsList.length ? (
              <select className="bk-select" value={form.booking} onChange={e=>handleBookingSelect(e.target.value)}><option value="">Linked Booking (optional)</option>{bookingsList.map(b=> <option key={b.id} value={`#AV-${b.id}`}>#AV-{b.id} • {b.owner_name || b.customer_name || ""} • {b.service_type || ""}</option>)}</select>
            ) : (
              <input className="bk-input" placeholder="Linked Booking #AV-1024 (optional)" value={form.booking} onChange={e=>setForm({...form, booking:e.target.value})} />
            )}
            <button onClick={addExpense} disabled={saving} style={{height:'48px', borderRadius:'12px', background:'#991B1B', color:'#fff', border:'none', fontWeight:800, opacity: saving?0.6:1}}>{saving ? "Saving..." : <><i className="bi bi-lock-fill me-1"></i> Save • Audit Locked Forever</>}</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}