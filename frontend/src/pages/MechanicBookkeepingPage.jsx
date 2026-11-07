import { useState, useMemo, useRef, useEffect, useCallback } from "react";

const API = "http://127.0.0.1:5000/api";
function getStoredUser(){ try{ return JSON.parse(localStorage.getItem("autoville_user")||"{}"); }catch{ return {}; } }
function mapPayStatus(raw){
  const s = String(raw||"").toLowerCase();
  if(["paid","completed","success","succeeded"].includes(s)) return "Paid";
  if(["pending","awaiting","unpaid"].includes(s)) return "Pending";
  if(["refunded","refund","cancelled","canceled"].includes(s)) return "Refunded";
  return s ? s.charAt(0).toUpperCase()+s.slice(1) : "Pending";
}
function normPayment(p){
  return {
    dbId: p.id, id: `#PAY-${p.id}`,
    date: String(p.payment_date || p.date || p.created_at || "").slice(0,10),
    service: p.service_type || p.service || p.description || "General Repair",
    amount: Number(p.amount ?? p.total ?? 0),
    method: p.payment_method || p.method || "Card",
    status: mapPayStatus(p.status),
    customer: p.customer_name || p.owner_name || p.customer || "Customer",
    booking: p.booking_id ? `#AV-${p.booking_id}` : (p.booking || p.bookingId || "-"),
  };
}
function normExpense(e){
  return {
    dbId: e.id, id: `#EXP-${e.id}`,
    date: String(e.expense_date || e.date || e.created_at || "").slice(0,10),
    category: e.category || "Other",
    desc: e.description || e.desc || "",
    amount: Number(e.amount ?? 0),
    vendor: e.vendor || "General",
    booking: e.booking_id ? `#AV-${e.booking_id}` : (e.booking || e.bookingId || "-"),
  };
}

export default function MechanicBookkeepingPage({ payments: extPayments, expenses: extExpenses, workshopId: propWorkshopId, workshop }) {
  const storedUser = getStoredUser();
  const workshopId = propWorkshopId || workshop?.id || storedUser.id || storedUser.workshop_id || storedUser.workshopId;
  const workshopName = workshop?.business_name || workshop?.name || storedUser.business_name || "Workshop";

  const [localPayments, setLocalPayments] = useState([]);
  const [localExpenses, setLocalExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const payments = workshopId ? localPayments : (extPayments || []);
  const expenses = workshopId ? localExpenses : (extExpenses || []);
  // If parent already passes normalized payments/expenses, normalize defensively
  const normPayments = useMemo(()=> payments.map(p=> p.service && p.amount!==undefined && p.status ? p : normPayment(p)), [payments]);
  const normExpenses = useMemo(()=> expenses.map(e=> e.category && e.desc!==undefined ? e : normExpense(e)), [expenses]);

  const [period, setPeriod] = useState("All");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const fetchBookkeeping = useCallback(async ()=>{
    if(!workshopId){ setLoading(false); return; }
    setLoading(true); setError("");
    try{
      // Fetch both - same sources as Payments + Expenses pages, so P/L always matches them
      const [incRes, expRes] = await Promise.all([
        fetch(`${API}/workshops/${workshopId}/incomes?limit=500`),
        fetch(`${API}/workshops/${workshopId}/expenses?limit=500`),
      ]);
      let incData = await incRes.json().catch(()=>[]);
      if(!incRes.ok){
        const fb = await fetch(`${API}/incomes?workshop_id=${workshopId}&limit=500`);
        incData = await fb.json().catch(()=>[]);
        if(!fb.ok) throw new Error(incData.error || "Failed to load incomes");
      }
      let expData = await expRes.json().catch(()=>[]);
      if(!expRes.ok){
        const fb = await fetch(`${API}/expenses?workshop_id=${workshopId}&limit=500`);
        expData = await fb.json().catch(()=>[]);
        if(!fb.ok) throw new Error(expData.error || "Failed to load expenses");
      }
      const incList = Array.isArray(incData) ? incData : (incData.incomes || incData.payments || incData.data || []);
      const expList = Array.isArray(expData) ? expData : (expData.expenses || expData.data || []);
      setLocalPayments(incList.map(normPayment));
      setLocalExpenses(expList.map(normExpense));
    }catch(e){ setError(e.message || "Could not load bookkeeping. Is Flask running on :5000?"); }
    setLoading(false);
  }, [workshopId]);

  useEffect(()=>{ fetchBookkeeping(); }, [fetchBookkeeping]);

  const filtered = useMemo(()=>{
    const inRange = (d)=>{
      if(!d) return false;
      const date = new Date(d);
      const now = new Date();
      if(period==="Today") return d===now.toISOString().slice(0,10);
      if(period==="This Week") return date >= new Date(now.getTime()-7*86400000);
      if(period==="This Month") return date.getMonth()===now.getMonth() && date.getFullYear()===now.getFullYear();
      if(period==="Custom" && customFrom && customTo){ return d>=customFrom && d<=customTo; }
      return true;
    };
    const fp = normPayments.filter(p=> inRange(p.date));
    const fe = normExpenses.filter(e=> inRange(e.date));
    return {fp, fe};
  },[normPayments, normExpenses, period, customFrom, customTo]);

  const revenue = filtered.fp.filter(p=>p.status==="Paid").reduce((s,p)=>s+p.amount,0);
  const pending = filtered.fp.filter(p=>p.status==="Pending").reduce((s,p)=>s+p.amount,0);
  const totalExp = filtered.fe.reduce((s,e)=>s+e.amount,0);
  const net = revenue - totalExp;
  const margin = revenue ? ((net/revenue)*100).toFixed(1) : 0;

  const byService = useMemo(()=>{
    const m={}; filtered.fp.forEach(p=>{ if(p.status!=="Paid") return; m[p.service]=(m[p.service]||0)+p.amount; }); return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  },[filtered.fp]);
  const byCategory = useMemo(()=>{
    const m={}; filtered.fe.forEach(e=>{ m[e.category]=(m[e.category]||0)+e.amount; }); return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  },[filtered.fe]);
  const monthly = useMemo(()=>{
    const map={}; const allDates=[...filtered.fp.map(p=>p.date), ...filtered.fe.map(e=>e.date)]; const months=[...new Set(allDates.map(d=>d.slice(0,7)))].sort();
    months.forEach(mm=>{ map[mm]={rev:0, exp:0}; });
    filtered.fp.forEach(p=>{ if(p.status!=="Paid") return; const mm=p.date.slice(0,7); if(!map[mm]) map[mm]={rev:0, exp:0}; map[mm].rev+=p.amount; });
    filtered.fe.forEach(e=>{ const mm=e.date.slice(0,7); if(!map[mm]) map[mm]={rev:0, exp:0}; map[mm].exp+=e.amount; });
    return Object.entries(map).sort().map(([m,v])=>({month:m, ...v, net:v.rev - v.exp}));
  },[filtered]);

  const fullLedger = useMemo(()=>{
    const rows=[
      ...filtered.fp.map(p=>({date:p.date, type:"INCOME", id:p.id, desc:`${p.service} • ${p.customer} • ${p.booking}`, amount:p.amount, method:p.method, status:p.status})),
      ...filtered.fe.map(e=>({date:e.date, type:"EXPENSE", id:e.id, desc:`${e.category} • ${e.desc} • ${e.vendor}`, amount:-e.amount, method:"Cost", status:"Locked"})),
    ];
    return rows.sort((a,b)=> new Date(b.date)-new Date(a.date));
  },[filtered]);

  const [txnType, setTxnType] = useState("All");
  const [visible, setVisible] = useState(10);
  const ledgerRef = useRef(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const filteredLedger = useMemo(()=>{
    if(txnType==="All") return fullLedger;
    if(txnType==="INCOME") return fullLedger.filter(r=>r.type==="INCOME");
    return fullLedger.filter(r=>r.type==="EXPENSE");
  },[fullLedger, txnType]);

  const displayedLedger = useMemo(()=> filteredLedger.slice(0, visible), [filteredLedger, visible]);

  useEffect(()=>{ setVisible(10); if(ledgerRef.current) ledgerRef.current.scrollTop=0; },[txnType, period, customFrom, customTo]);

  const handleScroll = useCallback(()=>{
    const el = ledgerRef.current;
    if(!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    if(nearBottom && visible < filteredLedger.length && !isLoadingMore){
      setIsLoadingMore(true);
      setTimeout(()=>{ setVisible(v=> Math.min(v+10, filteredLedger.length)); setIsLoadingMore(false); }, 350);
    }
  },[visible, filteredLedger.length, isLoadingMore]);

  useEffect(()=>{
    const el = ledgerRef.current;
    if(!el) return;
    el.addEventListener("scroll", handleScroll);
    return ()=> el.removeEventListener("scroll", handleScroll);
  },[handleScroll]);

  const maxChart = Math.max(1, ...monthly.map(m=> Math.max(m.rev, m.exp)));

  if(loading) return <div style={{padding:"40px", textAlign:"center", color:"#64748B"}}>Loading bookkeeping from backend...</div>;

  return (
    <>
    <style>{`
      .bkp-wrap{ width:100%; max-width:100%; overflow:hidden; }
      .bkp-stat{ background:#fff; border:1.5px solid #0A192F; border-radius:18px; padding:18px 18px 16px; height:100%; }
      .bkp-card{ background:#fff; border:1.5px solid #E2E8F0; border-radius:18px; overflow:hidden; }
      .bkp-toolbar{ background:#fff; border:1.5px solid #E2E8F0; border-radius:16px; padding:16px; display:flex; gap:12px; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom:16px; }
      .bkp-bar{ height:16px; border-radius:10px; }
      .ledger-scroll{ max-height:560px; overflow:auto; scrollbar-width:thin; scrollbar-color:#CBD5E1 #F8FAFC; }
      .ledger-scroll::-webkit-scrollbar{ width:6px; height:6px; }
      .ledger-scroll::-webkit-scrollbar-thumb{ background:#CBD5E1; border-radius:10px; }
      .txn-pill{ height:42px; border-radius:22px; padding:0 18px; font-weight:800; font-size:14px; border:1.5px solid #E2E8F0; background:#fff; color:#0A192F; cursor:pointer; transition:0.2s; }
      .txn-pill.active{ background:#0A192F; color:#fff; border-color:#0A192F; }
      .txn-pill.income.active{ background:#166534; border-color:#166534; }
      .txn-pill.expense.active{ background:#991B1B; border-color:#991B1B; }
      @media(max-width: 768px){ .bkp-toolbar{ flex-direction:column; align-items:stretch; } .ledger-scroll{ max-height:520px; } }
    `}</style>

    <div className="bkp-wrap">
      <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', marginBottom:'14px'}}>
        <div><h2 style={{fontWeight:900, fontSize:'30px', color:'#0A192F', margin:'0 0 8px', lineHeight:1.15}}>Bookkeeping • P/L Statement</h2><p style={{color:'#6B7A90', fontSize:'16px', margin:0, fontWeight:500}}>Profit / Loss • Revenue vs Cost • BAR ARD 284719 • Inglewood, CA • USD • PST • {workshopName}</p></div>
        <div style={{display:'flex', gap:'8px', alignSelf:'flex-start', flexWrap:'wrap'}}>
          <button onClick={fetchBookkeeping} style={{height:'46px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#fff', fontWeight:800, fontSize:'13px', padding:'0 16px'}}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
          <button onClick={()=>window.print()} style={{height:'46px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#fff', fontWeight:800, fontSize:'13px', padding:'0 16px'}}><i className="bi bi-printer me-1"></i> Print P/L</button>
          <span style={{height:'46px', borderRadius:'12px', background:'#0A192F', color:'#fff', fontWeight:800, fontSize:'14px', padding:'0 16px', display:'grid', placeItems:'center'}}>${net>=0?'+':''}${net} • {margin}%</span>
        </div>
      </div>

      {error && <div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", color:"#991B1B", padding:"12px 14px", borderRadius:"12px", marginBottom:"12px", fontSize:"13px", fontWeight:700}}>{error}</div>}

      <div style={{background:'#F0FDF4', border:'1.5px solid #BBF7D0', borderRadius:'14px', padding:'14px 16px', marginBottom:'16px', display:'flex', gap:'12px', alignItems:'flex-start'}}>
        <i className="bi bi-shield-check" style={{color:'#166534', fontSize:'20px', marginTop:'1px'}}></i>
        <div style={{fontSize:'14px', color:'#14532D', fontWeight:600, lineHeight:1.55}}><b>Audit Compliant:</b> Revenue from Payments (Paid only) minus Expenses (immutable, audit-locked). Expenses cannot be deleted; to cancel an expenditure, record similar income in Payments page. This P/L is BAR & IRS compliant.</div>
      </div>

      <div className="bkp-toolbar">
        <div style={{display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center'}}>
          <span style={{fontSize:'13px', fontWeight:900, color:'#6B7A90'}}>PERIOD:</span>
          {["All","Today","This Week","This Month","Custom"].map(p=>(
            <button key={p} onClick={()=>setPeriod(p)} style={{height:'44px', borderRadius:'22px', padding:'0 18px', fontWeight:800, fontSize:'14px', border:`1.5px solid ${period===p ? '#0A192F' : '#E2E8F0'}`, background: period===p ? '#0A192F' : '#fff', color: period===p ? '#fff' : '#0A192F', cursor:'pointer'}}>{p}</button>
          ))}
        </div>
        {period==="Custom" && (
          <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
            <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} style={{height:'44px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:600, fontSize:'14px', padding:'0 12px'}} />
            <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} style={{height:'44px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:600, fontSize:'14px', padding:'0 12px'}} />
          </div>
        )}
      </div>

      <div className="row g-3 mb-3" style={{margin:0, width:'100%'}}>
        <div className="col-6 col-lg-3"><div className="bkp-stat"><div style={{fontSize:'13px', fontWeight:800, color:'#6B7A90'}}>REVENUE • PAID • {period.toUpperCase()}</div><div style={{fontWeight:900, fontSize:'30px', marginTop:'8px', color:'#166534', lineHeight:1.1}}>${revenue}</div><div style={{fontSize:'13px', color:'#16A34A', fontWeight:700, marginTop:'6px'}}>{filtered.fp.filter(p=>p.status==="Paid").length} paid invoices • Pending ${pending}</div></div></div>
        <div className="col-6 col-lg-3"><div className="bkp-stat"><div style={{fontSize:'13px', fontWeight:800, color:'#6B7A90'}}>EXPENSES • IMMUTABLE</div><div style={{fontWeight:900, fontSize:'30px', marginTop:'8px', color:'#991B1B', lineHeight:1.1}}>${totalExp}</div><div style={{fontSize:'13px', color:'#EF4444', fontWeight:700, marginTop:'6px'}}>{filtered.fe.length} locked records • LA</div></div></div>
        <div className="col-6 col-lg-3"><div className="bkp-stat" style={{borderColor: net>=0 ? '#22C55E' : '#EF4444', background: net>=0 ? '#F0FDF4' : '#FEF2F2'}}><div style={{fontSize:'13px', fontWeight:800, color:'#6B7A90'}}>NET PROFIT / LOSS</div><div style={{fontWeight:900, fontSize:'30px', marginTop:'8px', color: net>=0 ? '#166534' : '#991B1B', lineHeight:1.1}}>${net}</div><div style={{fontSize:'13px', fontWeight:700, color: net>=0 ? '#166534' : '#991B1B', marginTop:'6px'}}>{net>=0 ? 'Profit' : 'Loss'} • {period} • CA</div></div></div>
        <div className="col-6 col-lg-3"><div className="bkp-stat" style={{background:'#0A192F', borderColor:'#0A192F'}}><div style={{fontSize:'13px', fontWeight:800, color:'#94A3B8'}}>MARGIN • FORMULA</div><div style={{fontWeight:900, fontSize:'30px', marginTop:'8px', color:'#fff', lineHeight:1.1}}>{margin}%</div><div style={{fontSize:'13px', color:'#94A3B8', marginTop:'6px', fontWeight:500}}>(Revenue - Expenses)/Revenue • {filtered.fp.length + filtered.fe.length} txns</div></div></div>
      </div>

      <div className="row g-3" style={{margin:0, width:'100%'}}>
        <div className="col-lg-8">
          <div className="bkp-card p-3 p-md-4">
            <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'10px', marginBottom:'16px'}}>
              <h5 style={{fontWeight:900, margin:0, fontSize:'18px', color:'#0A192F'}}><i className="bi bi-graph-up-arrow me-2"></i>Profit / Loss Statement • {period}</h5>
              <span style={{fontSize:'12px', fontWeight:700, background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'7px 12px', borderRadius:'20px', color:'#475569'}}>Ayinde Tech • 112 S Market St, Ste 1008, Inglewood, CA 90301</span>
            </div>
            <div style={{display:'grid', gap:'12px'}}>
              <div style={{display:'flex', justifyContent:'space-between', padding:'16px 18px', background:'#F0FDF4', border:'1.5px solid #BBF7D0', borderRadius:'14px', gap:'12px'}}><div><div style={{fontWeight:800, fontSize:'15px', color:'#14532D'}}>Total Revenue • Paid Invoices • AutoVille</div><div style={{fontSize:'13px', color:'#6B7A90', marginTop:'3px'}}>{filtered.fp.filter(p=>p.status==="Paid").length} invoices • BAR ARD 284719 • Pending ${pending} not included</div></div><div style={{fontWeight:900, fontSize:'20px', color:'#166534', flexShrink:0}}>${revenue}</div></div>
              <div style={{display:'flex', justifyContent:'space-between', padding:'16px 18px', background:'#FEF2F2', border:'1.5px solid #FCA5A5', borderRadius:'14px', gap:'12px'}}><div><div style={{fontWeight:800, fontSize:'15px', color:'#7F1D1D'}}>Total Expenses • Immutable Audit Locked • Cannot Delete</div><div style={{fontSize:'13px', color:'#6B7A90', marginTop:'3px'}}>{filtered.fe.length} records • Parts, Labor, Rent, Utilities • Inglewood suppliers • Adjust via Payments income</div></div><div style={{fontWeight:900, fontSize:'20px', color:'#991B1B', flexShrink:0}}>${totalExp}</div></div>
              <div style={{display:'flex', justifyContent:'space-between', padding:'18px', background:'#0A192F', borderRadius:'14px', color:'#fff', gap:'12px'}}><div><div style={{fontWeight:900, fontSize:'16px'}}>Net Profit / Loss • {period} • P/L</div><div style={{fontSize:'13px', color:'#94A3B8', marginTop:'3px'}}>Formula: Revenue - Expenses • Margin: {margin}% • CA BAR Compliant</div></div><div style={{fontWeight:900, fontSize:'22px', color: net>=0 ? '#22C55E' : '#FCA5A5', flexShrink:0}}>${net}</div></div>
            </div>

            <div style={{marginTop:'22px'}}>
              <div style={{fontSize:'13px', fontWeight:900, color:'#6B7A90', marginBottom:'14px'}}>MONTHLY TREND • REVENUE vs EXPENSES vs NET</div>
              {monthly.length===0 ? <div style={{padding:'22px', textAlign:'center', color:'#6B7A90', fontSize:'14px', border:'1px dashed #E2E8F0', borderRadius:'12px', fontWeight:600}}>No data for selected period — log a payment or expense first</div> :
              <div style={{display:'grid', gap:'14px'}}>
                {monthly.map(m=>{
                  const revW = (m.rev/maxChart)*100; const expW = (m.exp/maxChart)*100;
                  return (
                    <div key={m.month} style={{display:'grid', gridTemplateColumns:'100px 1fr', gap:'12px', alignItems:'center'}}>
                      <div style={{fontSize:'14px', fontWeight:800, color:'#0A192F'}}>{m.month}<div style={{fontSize:'12px', color: m.net>=0 ? '#166534' : '#991B1B', fontWeight:700, marginTop:'2px'}}>${m.net} net</div></div>
                      <div style={{display:'grid', gap:'6px'}}>
                        <div style={{display:'flex', gap:'10px', alignItems:'center'}}><div style={{width:'44px', fontSize:'12px', fontWeight:700, color:'#6B7A90'}}>REV</div><div style={{flex:1, background:'#F1F5F9', borderRadius:'10px', height:'16px', overflow:'hidden'}}><div className="bkp-bar" style={{width:`${revW}%`, background:'#22C55E'}}></div></div><div style={{fontSize:'13px', fontWeight:800, width:'60px'}}>${m.rev}</div></div>
                        <div style={{display:'flex', gap:'10px', alignItems:'center'}}><div style={{width:'44px', fontSize:'12px', fontWeight:700, color:'#6B7A90'}}>EXP</div><div style={{flex:1, background:'#F1F5F9', borderRadius:'10px', height:'16px', overflow:'hidden'}}><div className="bkp-bar" style={{width:`${expW}%`, background:'#EF4444'}}></div></div><div style={{fontSize:'13px', fontWeight:800, width:'60px'}}>${m.exp}</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              }
            </div>

            <div style={{marginTop:'20px', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'12px', padding:'14px 16px', fontSize:'13px', color:'#475569', lineHeight:1.6, fontWeight:500}}>
              <b style={{color:'#0A192F'}}>Bookkeeping Standard:</b> P/L = Paid Revenue - Immutable Expenses. Pending excluded until Paid. To correct an expense, record offsetting income in Payments page referencing expense audit ID.
            </div>
          </div>

          <div className="bkp-card mt-3">
            <div style={{padding:'18px 18px 12px', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', alignItems:'center', borderBottom:'1.5px solid #F1F5F9'}}>
              <div>
                <div style={{fontSize:'15px', fontWeight:900, color:'#0A192F'}}><i className="bi bi-journal-text me-2"></i>Combined Ledger • Lazy Load • Audit Trail</div>
                <div style={{fontSize:'13px', color:'#6B7A90', fontWeight:500, marginTop:'3px'}}>Scroll down to load more • Immutable expenses • Adjust via Payments income</div>
              </div>
              <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
                <button className={`txn-pill ${txnType==="All"?"active":""}`} onClick={()=>setTxnType("All")}>All • {fullLedger.length}</button>
                <button className={`txn-pill income ${txnType==="INCOME"?"active":""}`} onClick={()=>setTxnType("INCOME")}><i className="bi bi-arrow-up-circle me-1"></i>Income • {fullLedger.filter(r=>r.type==="INCOME").length}</button>
                <button className={`txn-pill expense ${txnType==="EXPENSE"?"active":""}`} onClick={()=>setTxnType("EXPENSE")}><i className="bi bi-arrow-down-circle me-1"></i>Expenditure • {fullLedger.filter(r=>r.type==="EXPENSE").length}</button>
              </div>
            </div>

            <div ref={ledgerRef} className="ledger-scroll">
              <div className="table-responsive">
                <table className="table table-hover mb-0" style={{fontSize:'14px', marginBottom:0}}>
                  <thead style={{position:'sticky', top:0, background:'#F8FAFC', zIndex:1}}><tr style={{fontSize:'12px', color:'#6B7A90', fontWeight:800}}><th style={{padding:'12px 16px', background:'#F8FAFC'}}>Date</th><th style={{background:'#F8FAFC'}}>Type</th><th style={{background:'#F8FAFC'}}>ID • Description</th><th style={{textAlign:'right', background:'#F8FAFC', paddingRight:'16px'}}>Amount</th></tr></thead>
                  <tbody>
                    {displayedLedger.length===0 ? <tr><td colSpan={4} style={{textAlign:'center', padding:'30px', color:'#6B7A90', fontSize:'14px', fontWeight:600}}>No {txnType.toLowerCase()} transactions for {period}</td></tr> :
                    displayedLedger.map((r,i)=>(
                      <tr key={r.id+i}><td style={{fontSize:'13px', fontWeight:600, padding:'12px 16px'}}>{r.date}</td><td><span style={{fontSize:'12px', fontWeight:800, padding:'5px 12px', borderRadius:'20px', background: r.type==="INCOME" ? '#DCFCE7' : '#FEE2E2', color: r.type==="INCOME" ? '#166534' : '#991B1B', display:'inline-block'}}>{r.type}</span></td><td style={{maxWidth:'340px'}}><b style={{fontSize:'13px', color:'#0A192F'}}>{r.id}</b> <span style={{fontSize:'13px', color:'#475569'}}>{r.desc}</span><div style={{fontSize:'12px', color:'#6B7A90', marginTop:'2px'}}>{r.status} • {r.method} • {r.type==="EXPENSE" ? "Audit Locked • Adjust via Payments" : "AutoVille"}</div></td><td style={{textAlign:'right', fontWeight:900, color: r.amount>=0 ? '#166534' : '#991B1B', fontSize:'14px', paddingRight:'16px'}}>{r.amount>=0 ? '+' : ''}${r.amount}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {visible < filteredLedger.length && (
                <div style={{padding:'14px', textAlign:'center', background:'#F8FAFC', borderTop:'1px solid #E2E8F0'}}>
                  {isLoadingMore ?
                    <span style={{fontSize:'13px', fontWeight:700, color:'#6B7A90'}}><span className="spinner-border spinner-border-sm me-2" role="status"></span>Loading more transactions... Scrolling lazy load</span> :
                    <span style={{fontSize:'13px', fontWeight:600, color:'#6B7A90'}}>Scroll down for more • Showing {displayedLedger.length} of {filteredLedger.length} • <button onClick={()=>setVisible(v=>Math.min(v+10, filteredLedger.length))} style={{border:'none', background:'transparent', color:'#0A192F', fontWeight:800, textDecoration:'underline', cursor:'pointer'}}>Load 10 more</button></span>
                  }
                </div>
              )}
              {visible >= filteredLedger.length && filteredLedger.length>0 && (
                <div style={{padding:'12px', textAlign:'center', background:'#F0FDF4', borderTop:'1px solid #BBF7D0', fontSize:'13px', fontWeight:700, color:'#166534'}}>
                  <i className="bi bi-check-circle-fill me-1"></i> All {filteredLedger.length} {txnType.toLowerCase()} transactions loaded • End of {period.toLowerCase()} ledger
                </div>
              )}
            </div>

            <div style={{padding:'12px 18px', background:'#0A192F', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'8px'}}>
              <span style={{fontSize:'13px', color:'#94A3B8', fontWeight:600}}><i className="bi bi-info-circle me-1"></i> Lazy load: 10 per scroll • Filter: {txnType} • Period: {period} • Showing {displayedLedger.length}/{filteredLedger.length}</span>
              <span style={{fontSize:'13px', color:'#fff', fontWeight:800}}>Net: ${net} • {margin}% margin • BAR ARD 284719</span>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="bkp-card p-3 p-md-4">
            <div style={{fontSize:'13px', fontWeight:900, color:'#6B7A90', marginBottom:'14px'}}><i className="bi bi-pie-chart me-1"></i>REVENUE BY SERVICE • {period}</div>
            {byService.length===0 ? <div style={{fontSize:'14px', color:'#6B7A90', fontWeight:600}}>No paid revenue</div> :
              byService.map(([svc, amt])=>(
                <div key={svc} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', border:'1px solid #E2E8F0', borderRadius:'12px', marginBottom:'10px', background:'#F8FAFC'}}>
                  <div style={{fontSize:'14px', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'170px', color:'#0A192F'}}>{svc}</div><div style={{fontWeight:800, fontSize:'14px', color:'#166534'}}>${amt}</div>
                </div>
              ))
            }
          </div>

          <div className="bkp-card p-3 p-md-4 mt-3">
            <div style={{fontSize:'13px', fontWeight:900, color:'#6B7A90', marginBottom:'14px'}}><i className="bi bi-receipt-cutoff me-1"></i>EXPENSES BY CATEGORY • IMMUTABLE</div>
            {byCategory.length===0 && <div style={{fontSize:'14px', color:'#6B7A90', fontWeight:600}}>No expenses</div>}
            {byCategory.map(([cat, amt])=>{
              const pct = totalExp ? (amt/totalExp*100).toFixed(0) : 0;
              return (
                <div key={cat} style={{marginBottom:'14px'}}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'14px', fontWeight:700, color:'#0A192F'}}><span>{cat}</span><span>${amt} • {pct}%</span></div>
                  <div style={{height:'10px', background:'#F1F5F9', borderRadius:'10px', overflow:'hidden', marginTop:'6px'}}><div style={{height:'100%', width:`${pct}%`, background: cat==="Parts" ? '#3B82F6' : cat==="Labor" ? '#6366F1' : cat==="Rent" ? '#F59E0B' : '#EF4444'}}></div></div>
                </div>
              );
            })}
            <div style={{background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:'12px', padding:'12px 14px', fontSize:'13px', color:'#7F1D1D', marginTop:'12px', fontWeight:600, lineHeight:1.5}}><b>Audit:</b> Expenses cannot be deleted. To adjust, add income in Payments page equal to expense to net zero. Ledger lazy loads 10 per scroll.</div>
          </div>

          <div className="bkp-card p-3 p-md-4 mt-3" style={{background:'#0A192F', color:'#fff'}}>
            <h6 style={{fontWeight:900, color:'#fff', fontSize:'15px'}}><i className="bi bi-lightbulb me-2" style={{color:'#FBBF24'}}></i>Bookkeeping Tips • LA</h6>
            <ul style={{fontSize:'13px', color:'#94A3B8', marginTop:'12px', paddingLeft:'20px', lineHeight:1.7, fontWeight:500}}>
              <li>Ledger lazy loads as you scroll - 10 more each time</li>
              <li>Filter by Income / Expenditure pill buttons above ledger</li>
              <li>Paid revenue only counts to P/L - Pending excluded</li>
              <li>Expenses immutable - audit locked for BAR compliance</li>
              <li>To correct expense error: record income in Payments page</li>
              <li>Support Peter • +1-201-534-2657 • support@ayindetechnologies.com</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}