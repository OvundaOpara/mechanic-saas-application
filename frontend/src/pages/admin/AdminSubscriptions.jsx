import { useState, useMemo, useEffect, useRef } from "react";

const API = "http://127.0.0.1:5000/api";
const FALLBACK_LOGO = "../img/usericon.png";

function getLogo(url){
  if(!url || String(url).includes("unsplash")) return FALLBACK_LOGO;
  return url;
}
function handleImgError(e){
  if(e.currentTarget.src.indexOf("usericon.png") === -1){
    e.currentTarget.onerror = null;
    e.currentTarget.src = "/img/usericon.png";
  }
}

export default function AdminSubscriptions(){
  const plans = [
    { plan:"Monthly", amount:40 },
    { plan:"Quarterly", amount:100 },
    { plan:"Annual", amount:300 },
    { plan:"Trial", amount:0 },
  ];
  const statuses = ["Active","Expired","Trial","Pending Renewal","Cancelled"];

  const [subs, setSubs] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    setLoading(true);
    Promise.all([
      fetch(API + "/subscriptions?limit=200").then(r=>r.json()).catch(()=>[]),
      fetch(API + "/subscriptions/receipts?limit=200").then(r=>r.json()).catch(()=>[]),
      fetch(API + "/workshops?limit=200").then(r=>r.json()).catch(()=>[]),
    ]).then(([subsData, receiptsData, workshopsData])=>{
      const subsArr = Array.isArray(subsData) ? subsData : (subsData.subscriptions || subsData.data || []);
      const receiptsArr = Array.isArray(receiptsData) ? receiptsData : (receiptsData.receipts || receiptsData.data || []);
      const wsArr = Array.isArray(workshopsData) ? workshopsData : (workshopsData.workshops || workshopsData.data || []);
      setWorkshops(wsArr);

      const mappedSubs = subsArr.map((x)=>{
        var end = x.end_date || x.endDate || "";
        var daysLeft = end ? Math.ceil((new Date(end) - new Date())/(1000*60*60*24)) : 0;
        return {
          id: "SUB-" + x.id,
          rawId: x.id,
          workshop: x.workshop_name || x.workshop || ("Workshop #" + x.workshop_id),
          owner: x.owner_name || x.owner || "",
          email: x.email || "",
          phone: x.phone || "",
          bar: x.bar_license || x.bar || "",
          addr: x.address || "112 S Market St Ste 1008 Inglewood CA 90301",
          logo: getLogo(x.logo_url || x.logo),
          plan: x.plan || "Trial",
          amount: Number(x.amount || 0),
          status: x.status || "Trial",
          startDate: String(x.start_date || x.startDate || "").split("T")[0],
          endDate: String(x.end_date || x.endDate || "").split("T")[0],
          daysLeft: daysLeft,
          autoRenew: x.auto_renew !== false && x.auto_renew !== 0,
          receiptId: x.receipt_id || x.receiptId || ("RCPT-SUB-" + x.id),
          lastPayment: String(x.start_date || "").split("T")[0],
          nextBilling: x.status === "Active" ? String(x.end_date || "").split("T")[0] : "-",
          method: x.payment_method || (Number(x.amount)===0 ? "Free Trial" : "Card"),
          trialDays: x.plan === "Trial" ? 14 : 0,
        };
      });
      mappedSubs.sort((a,b)=> new Date(b.startDate) - new Date(a.startDate));
      setSubs(mappedSubs);

      const mappedReceipts = receiptsArr.map((x)=>{
        return {
          id: x.receipt_number || x.receipt_id || ("RCPT-SUB-" + x.id),
          rawId: x.id,
          txId: x.transaction_id || x.txId || ("TX-" + x.id),
          subId: "SUB-" + (x.subscription_id || x.subId || x.id),
          workshop: x.workshop_name || x.workshop || ("Workshop #" + x.workshop_id),
          owner: x.owner_name || x.owner || "",
          logo: getLogo(x.logo_url || x.logo),
          bar: x.bar_license || x.bar || "",
          plan: x.plan || "Trial",
          amount: Number(x.amount || 0),
          date: String(x.receipt_date || x.date || "").split("T")[0],
          method: x.payment_method || "Free Trial",
          status: x.status || (Number(x.amount)===0 ? "Free" : "Paid"),
          period: x.period || (x.plan==="Monthly" ? "1 month" : x.plan==="Quarterly" ? "3 months" : x.plan==="Annual" ? "12 months" : "14 days trial"),
          autoGen: true,
          address: x.address || "112 S Market St Ste 1008 Inglewood CA 90301",
          email: x.email || "",
          nextBilling: String(x.next_billing_date || x.nextBilling || "").split("T")[0] || "-",
        };
      });
      mappedReceipts.sort((a,b)=> new Date(b.date) - new Date(a.date));
      setReceipts(mappedReceipts);
      setLoading(false);
    });
  },[]);

  const [activeTab,setActiveTab]=useState("subs");
  const [q,setQ]=useState("");
  const [workshopF,setWorkshopF]=useState("All");
  const [statusF,setStatusF]=useState("All");
  const [planF,setPlanF]=useState("All");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [visibleCount,setVisibleCount]=useState(10);
  const [selected,setSelected]=useState(null);
  const [showDetail,setShowDetail]=useState(false);
  const [receiptDetail,setReceiptDetail]=useState(null);
  const [showReceipt,setShowReceipt]=useState(false);
  const loaderRef=useRef(null);

  const filteredSubs = useMemo(()=>{
    return subs.filter(s=>{
      var matchQ = (s.workshop+" "+s.owner+" "+s.id+" "+s.bar).toLowerCase().indexOf(q.toLowerCase())>-1;
      var matchW = workshopF==="All" || s.workshop===workshopF;
      var matchS = statusF==="All" || s.status===statusF;
      var matchP = planF==="All" || s.plan===planF;
      var matchFrom = !dateFrom || s.startDate >= dateFrom;
      var matchTo = !dateTo || s.startDate <= dateTo;
      return matchQ && matchW && matchS && matchP && matchFrom && matchTo;
    });
  },[subs,q,workshopF,statusF,planF,dateFrom,dateTo]);

  const filteredReceipts = useMemo(()=>{
    return receipts.filter(r=>{
      var matchQ = (r.workshop+" "+r.id+" "+r.subId+" "+r.txId).toLowerCase().indexOf(q.toLowerCase())>-1;
      var matchW = workshopF==="All" || r.workshop===workshopF;
      var matchP = planF==="All" || r.plan===planF;
      var matchFrom = !dateFrom || r.date >= dateFrom;
      var matchTo = !dateTo || r.date <= dateTo;
      return matchQ && matchW && matchP && matchFrom && matchTo;
    });
  },[receipts,q,workshopF,planF,dateFrom,dateTo]);

  const currentFiltered = activeTab==="subs" ? filteredSubs : filteredReceipts;
  const visibleRows = useMemo(()=> currentFiltered.slice(0, visibleCount),[currentFiltered, visibleCount]);

  useEffect(()=>{ setVisibleCount(10); },[q,workshopF,statusF,planF,dateFrom,dateTo,activeTab]);
  useEffect(()=>{
    var obs=new IntersectionObserver((e)=>{ if(e[0].isIntersecting && visibleCount < currentFiltered.length) setVisibleCount(c=>c+8); },{threshold:0.1});
    if(loaderRef.current) obs.observe(loaderRef.current);
    return ()=> obs.disconnect();
  },[currentFiltered.length, visibleCount]);

  const activeCount = subs.filter(s=>s.status==="Active").length;
  const expiredCount = subs.filter(s=>s.status==="Expired").length;
  const trialCount = subs.filter(s=>s.status==="Trial").length;
  const pendingCount = subs.filter(s=>s.status==="Pending Renewal").length;
  const mrr = subs.filter(s=>s.status==="Active").reduce((sum,s)=> sum + (s.plan==="Monthly"?40: s.plan==="Quarterly"?33.33: s.plan==="Annual"?25:0),0);

  function openSub(s){ setSelected(s); setShowDetail(true); }
  function openReceipt(r){ setReceiptDetail(r); setShowReceipt(true); }

  const workshopNames = useMemo(()=>{
    if(workshops.length) return workshops.map(w=> w.name);
    var s={}; subs.forEach(x=> s[x.workshop]=1); return Object.keys(s);
  },[workshops, subs]);

  return (
    <div style={{display:"grid", gap:"16px", fontSize:"15px"}}>
      <style>{`
        .owner-card{ background:#fff; border:1.5px solid #E2E8F0; border-radius:18px; padding:18px; }
        .owner-table th{ font-size:12px; font-weight:800; color:#475569; text-transform:uppercase; background:#F8FAFC; padding:14px 12px; }
        .owner-table td{ padding:14px 12px; vertical-align:middle; font-size:15px; }
        .modal-overlay{ position:fixed; inset:0; background:rgba(10,25,47,0.65); backdrop-filter:blur(6px); z-index:90; display:grid; place-items:center; padding:16px; }
        .modal-box{ width:100%; background:#fff; border-radius:22px; border:1.5px solid #E2E8F0; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.2); animation:pop 0.22s ease; }
        @keyframes pop{ from{transform:scale(0.96) translateY(8px); opacity:0} to{transform:scale(1) translateY(0); opacity:1} }
        .tab-btn{ height:40px; padding:0 18px; border-radius:12px; border:1.5px solid #E2E8F0; font-weight:800; font-size:13px; background:#fff; }
        .tab-btn.active{ background:#0A192F; color:#fff; border-color:#0A192F; }
      `}</style>

      <div className="row g-3" style={{margin:0, width:"100%"}}>
        <div className="col-6 col-lg-3"><div style={{background:"#0A192F", borderRadius:"18px", padding:"18px", color:"#fff"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>ACTIVE SUBSCRIBED</div><div style={{fontSize:"32px", fontWeight:900}}>{loading ? "..." : activeCount}</div><div style={{fontSize:"12px", color:"#22C55E"}}>• Live • Auto-renew • DB</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#FEF2F2", borderColor:"#FECACA"}}><div style={{fontSize:"11px", fontWeight:800, color:"#991B1B"}}>EXPIRED</div><div style={{fontSize:"32px", fontWeight:900, color:"#991B1B"}}>{expiredCount}</div><div style={{fontSize:"12px", color:"#DC2626"}}>Need renewal • BAR</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#EFF6FF", borderColor:"#DBEAFE"}}><div style={{fontSize:"11px", fontWeight:800, color:"#1E40AF"}}>FREE TRIAL</div><div style={{fontSize:"32px", fontWeight:900, color:"#1E40AF"}}>{trialCount}</div><div style={{fontSize:"12px", color:"#3B82F6"}}>14 days • $0</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#DCFCE7", borderColor:"#BBF7D0"}}><div style={{fontSize:"11px", fontWeight:800, color:"#166534"}}>MRR • EST</div><div style={{fontSize:"28px", fontWeight:900, color:"#166534"}}>${mrr.toFixed(2)}</div><div style={{fontSize:"11px", color:"#16A34A"}}>{pendingCount} pending renewal</div></div></div>
      </div>

      <div className="owner-card" style={{padding:"20px"}}>
        <div style={{display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:"12px", marginBottom:"16px"}}>
          <div style={{display:"flex", gap:"8px", alignItems:"center"}}>
            <button className={`tab-btn ${activeTab==="subs"?"active":""}`} onClick={()=>setActiveTab("subs")}><i className="bi bi-gem me-1"></i> Subscriptions • {filteredSubs.length}</button>
            <button className={`tab-btn ${activeTab==="receipts"?"active":""}`} onClick={()=>setActiveTab("receipts")}><i className="bi bi-receipt me-1"></i> Auto Receipts • {filteredReceipts.length}</button>
          </div>
          <div style={{display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center"}}>
            <select value={workshopF} onChange={e=>setWorkshopF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px", minWidth:"190px"}}><option value="All">All Workshops</option>{workshopNames.map(n=><option key={n} value={n}>{n}</option>)}</select>
            {activeTab==="subs" && <select value={statusF} onChange={e=>setStatusF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px"}}><option value="All">All Status</option>{statuses.map(s=><option key={s} value={s}>{s}</option>)}</select>}
            <select value={planF} onChange={e=>setPlanF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px"}}><option value="All">All Plans</option><option value="Monthly">Monthly $40</option><option value="Quarterly">Quarterly $100</option><option value="Annual">Annual $300</option><option value="Trial">Trial Free</option></select>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 10px", fontSize:"13px"}} />
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 10px", fontSize:"13px"}} />
            <div style={{position:"relative"}}><i className="bi bi-search" style={{position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", color:"#94A3B8"}}></i><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search workshop, BAR..." style={{height:"44px", width:"200px", borderRadius:"12px", border:"1.5px solid #E2E8F0", background:"#F8FAFC", padding:"0 14px 0 40px", fontSize:"14px", fontWeight:600}} /></div>
          </div>
        </div>

        {loading && <div style={{padding:20, textAlign:"center", color:"#94A3B8", fontWeight:700}}>Loading subscriptions from DB...</div>}
        {!loading && visibleRows.length===0 && <div style={{padding:20, textAlign:"center", color:"#94A3B8"}}>No {activeTab==="subs"?"subscriptions":"receipts"} yet. Register a workshop to create a Trial subscription.</div>}

        {activeTab==="subs" ? (
          <div style={{overflowX:"auto", borderRadius:"14px", border:"1.5px solid #E2E8F0"}}>
            <table className="table owner-table" style={{margin:0}}>
              <thead><tr><th>Sub ID</th><th>Workshop</th><th>Plan</th><th>Status</th><th>Start → End</th><th>Amount</th><th>Auto-Renew</th><th style={{textAlign:"right"}}>View</th></tr></thead>
              <tbody>
                {visibleRows.map(s=>(
                  <tr key={s.id}>
                    <td style={{fontWeight:900, fontSize:"13px"}}>{s.id}<div style={{fontSize:"11px", color:"#94A3B8"}}>{s.receiptId}</div></td>
                    <td><div style={{display:"flex", gap:"10px", alignItems:"center"}}><img src={s.logo} alt="" onError={handleImgError} style={{width:"38px", height:"38px", borderRadius:"10px", objectFit:"cover", border:"1.5px solid #E2E8F0", background:"#F1F5F9"}} /><div><div style={{fontWeight:800, fontSize:"13px", color:"#0A192F"}}>{s.workshop}</div><div style={{fontSize:"11px", color:"#64748B"}}>{s.owner} • {s.bar}</div></div></div></td>
                    <td><span style={{background: s.plan==="Trial" ? "#EFF6FF" : s.plan==="Monthly" ? "#DBEAFE" : s.plan==="Quarterly" ? "#E0E7FF" : "#FEF3C7", color: s.plan==="Trial" ? "#1E40AF" : s.plan==="Monthly" ? "#1E40AF" : s.plan==="Quarterly" ? "#4338CA" : "#92400E", border:"1px solid #E2E8F0", padding:"5px 12px", borderRadius:"20px", fontSize:"12px", fontWeight:800}}>{s.plan} • {s.plan==="Monthly"?"$40": s.plan==="Quarterly"?"$100": s.plan==="Annual"?"$300":"Free"}</span></td>
                    <td><span style={{padding:"5px 12px", borderRadius:"20px", fontSize:"11px", fontWeight:800, background: s.status==="Active"?"#DCFCE7": s.status==="Expired"?"#FEF2F2": s.status==="Trial"?"#EFF6FF": s.status==="Pending Renewal"?"#FEF3C7":"#F1F5F9", color: s.status==="Active"?"#166534": s.status==="Expired"?"#991B1B": s.status==="Trial"?"#1E40AF": s.status==="Pending Renewal"?"#92400E":"#475569", border:"1px solid #E2E8F0"}}>{s.status}{s.status!=="Expired" && s.daysLeft>=0 ? ` • ${s.daysLeft}d left` : ""}</span></td>
                    <td style={{fontSize:"12px", fontWeight:700}}>{s.startDate} → {s.endDate}<div style={{fontSize:"11px", color:"#94A3B8"}}>{s.nextBilling!=="-" ? "Next: "+s.nextBilling : "No auto"}</div></td>
                    <td style={{fontWeight:900, color:s.amount===0?"#64748B":"#166534"}}>{s.amount===0 ? "Free" : "$"+s.amount}</td>
                    <td><span style={{fontSize:"12px", fontWeight:700, color:s.autoRenew?"#16A34A":"#94A3B8"}}>{s.autoRenew ? "Yes • "+s.method : s.method}</span></td>
                    <td><div style={{display:"flex", justifyContent:"flex-end"}}><button onClick={()=>openSub(s)} style={{height:"36px", padding:"0 14px", borderRadius:"10px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"13px"}}>View</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{overflowX:"auto", borderRadius:"14px", border:"1.5px solid #E2E8F0"}}>
            <table className="table owner-table" style={{margin:0}}>
              <thead><tr><th>Receipt</th><th>Date</th><th>Workshop</th><th>Sub ID</th><th>Plan</th><th>Amount</th><th>Method</th><th style={{textAlign:"right"}}>Receipt</th></tr></thead>
              <tbody>
                {visibleRows.map(r=>(
                  <tr key={r.id}>
                    <td><div style={{fontWeight:900, fontSize:"13px"}}>{r.id}</div><div style={{fontSize:"11px", color:"#94A3B8"}}>{r.txId} • Auto-gen</div></td>
                    <td style={{fontWeight:700, fontSize:"13px"}}>{r.date}<div style={{fontSize:"11px", color:"#94A3B8"}}>{r.period}</div></td>
                    <td><div style={{display:"flex", gap:"8px", alignItems:"center"}}><img src={r.logo} alt="" onError={handleImgError} style={{width:"34px", height:"34px", borderRadius:"8px", objectFit:"cover", background:"#F1F5F9"}} /><span style={{fontWeight:800, fontSize:"13px"}}>{r.workshop}</span></div></td>
                    <td style={{fontSize:"12px", fontWeight:700}}>{r.subId}</td>
                    <td><span style={{background:"#F1F5F9", border:"1px solid #E2E8F0", padding:"4px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:800}}>{r.plan} • {r.plan==="Monthly"?"$40": r.plan==="Quarterly"?"$100": r.plan==="Annual"?"$300":"Free"}</span></td>
                    <td style={{fontWeight:900, color:r.amount===0?"#64748B":"#166534"}}>{r.amount===0?"Free":"$"+r.amount}</td>
                    <td style={{fontSize:"12px"}}>{r.method}<div style={{fontSize:"11px", color:"#16A34A"}}>{r.status} • Auto-gen</div></td>
                    <td><div style={{display:"flex", justifyContent:"flex-end"}}><button onClick={()=>openReceipt(r)} style={{height:"36px", padding:"0 14px", borderRadius:"10px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"13px"}}>View Receipt</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div ref={loaderRef} style={{padding:"18px", textAlign:"center"}}>
          {visibleCount < currentFiltered.length ? (
            <div style={{display:"inline-flex", gap:"10px", alignItems:"center", background:"#F8FAFC", border:"1.5px solid #E2E8F0", padding:"10px 18px", borderRadius:"20px", fontWeight:700, fontSize:"13px", color:"#64748B"}}>
              <span className="spinner-border spinner-border-sm" style={{width:"16px", height:"16px"}}></span> Loading {Math.min(8, currentFiltered.length - visibleCount)} more... • {visibleRows.length}/{currentFiltered.length}
            </div>
          ) : (
            <div style={{fontSize:"13px", fontWeight:700, color:"#94A3B8"}}>All {currentFiltered.length} {activeTab==="subs"?"subscriptions":"receipts"} loaded • {activeCount} active • {expiredCount} expired • {trialCount} trial • 112 S Market St Inglewood CA 90301 PST</div>
          )}
        </div>
      </div>

      {showDetail && selected && (
        <div className="modal-overlay" onClick={()=>setShowDetail(false)}>
          <div className="modal-box" style={{maxWidth:"660px"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:selected.status==="Active"?"#0A192F":selected.status==="Expired"?"#7F1D1D":"#1E40AF", padding:"18px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", color:"#fff"}}>
              <div><div style={{fontWeight:900, fontSize:"16px"}}>{selected.id} • {selected.workshop} • {selected.plan} • {selected.status}</div><div style={{fontSize:"12px", color:"rgba(255,255,255,0.7)"}}>{selected.startDate} → {selected.endDate} • {selected.daysLeft>=0?selected.daysLeft+"d left":"Expired"} • {selected.receiptId}</div></div>
              <button onClick={()=>setShowDetail(false)} style={{width:"38px", height:"38px", borderRadius:"12px", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.18)", color:"#fff"}}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={{padding:"22px", display:"grid", gap:"14px"}}>
              <div style={{display:"flex", gap:"12px", alignItems:"center", background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"12px"}}>
                <img src={selected.logo} alt="" onError={handleImgError} style={{width:"56px", height:"56px", borderRadius:"14px", objectFit:"cover", background:"#F1F5F9"}} />
                <div><div style={{fontWeight:900}}>{selected.workshop}</div><div style={{fontSize:"13px", color:"#64748B"}}>{selected.owner} • {selected.email} • {selected.phone}</div><div style={{fontSize:"12px", color:"#64748B"}}>{selected.addr} • {selected.bar}</div></div>
              </div>
              <div className="row g-3" style={{margin:0, width:"100%"}}>
                <div className="col-6"><div style={{background:"#EFF6FF", border:"1.5px solid #DBEAFE", borderRadius:"12px", padding:"12px"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>PLAN & AMOUNT</div><div style={{fontWeight:900}}>{selected.plan} • {selected.amount===0?"Free 14d":"$"+selected.amount}</div><div style={{fontSize:"11px", color:"#64748B"}}>{selected.method}</div></div></div>
                <div className="col-6"><div style={{background:selected.status==="Active"?"#DCFCE7":"#FEF2F2", border:"1.5px solid #E2E8F0", borderRadius:"12px", padding:"12px"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>STATUS</div><div style={{fontWeight:900, color:selected.status==="Active"?"#166534":"#991B1B"}}>{selected.status} {selected.daysLeft>=0?`• ${selected.daysLeft}d`:""}</div><div style={{fontSize:"11px", color:"#64748B"}}>Auto-renew: {selected.autoRenew?"Yes":"No"} • Next: {selected.nextBilling}</div></div></div>
                <div className="col-12"><div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"12px", padding:"12px"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>AUTO-GENERATED RECEIPT</div><div style={{fontWeight:700, fontSize:"13px"}}>{selected.receiptId} • Last payment {selected.lastPayment} • {selected.method}</div><div style={{fontSize:"12px", color:"#64748B"}}>Zero commission • BAR log • Immutable audit • PST • Inglewood</div></div></div>
              </div>
              <button onClick={()=>setShowDetail(false)} style={{height:"44px", borderRadius:"12px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800}}>Close • {selected.id}</button>
            </div>
          </div>
        </div>
      )}

      {showReceipt && receiptDetail && (
        <div className="modal-overlay" onClick={()=>setShowReceipt(false)}>
          <div className="modal-box" style={{maxWidth:"680px"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:"#0A192F", padding:"0", color:"#fff"}}>
              <div style={{padding:"20px 24px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                <div><div style={{fontWeight:900, fontSize:"18px"}}>AutoVille • Subscription Receipt</div><div style={{fontSize:"12px", color:"#94A3B8"}}>{receiptDetail.id} • {receiptDetail.txId} • Auto-generated</div></div>
                <button onClick={()=>setShowReceipt(false)} style={{width:"38px", height:"38px", borderRadius:"12px", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.18)", color:"#fff"}}><i className="bi bi-x-lg"></i></button>
              </div>
              <div style={{background:"#fff", color:"#0A192F", padding:"20px 24px", display:"grid", gap:"14px"}}>
                <div style={{display:"flex", justifyContent:"space-between", borderBottom:"1.5px dashed #E2E8F0", paddingBottom:"12px"}}>
                  <div><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>BILLED TO</div><div style={{fontWeight:900}}>{receiptDetail.workshop}</div><div style={{fontSize:"12px", color:"#64748B"}}>{receiptDetail.address}</div><div style={{fontSize:"12px", color:"#64748B"}}>{receiptDetail.email} • {receiptDetail.bar}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>RECEIPT DATE</div><div style={{fontWeight:800}}>{receiptDetail.date}</div><div style={{fontSize:"12px", color:"#64748B"}}>{receiptDetail.period}</div><div style={{fontSize:"11px", fontWeight:800, color:"#16A34A", background:"#DCFCE7", display:"inline-block", padding:"3px 10px", borderRadius:"20px", marginTop:"4px"}}>{receiptDetail.status} • Auto-gen</div></div>
                </div>
                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px"}}>
                  <div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"12px", padding:"12px"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>SUBSCRIPTION</div><div style={{fontWeight:800}}>{receiptDetail.subId} • {receiptDetail.plan}</div><div style={{fontSize:"12px", color:"#64748B"}}>{receiptDetail.plan==="Monthly"?"$40/mo": receiptDetail.plan==="Quarterly"?"$100/3mo": receiptDetail.plan==="Annual"?"$300/yr":"Free 14d"}</div></div>
                  <div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"12px", padding:"12px"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>PAYMENT METHOD</div><div style={{fontWeight:800}}>{receiptDetail.method}</div><div style={{fontSize:"11px", color:"#64748B"}}>Tx: {receiptDetail.txId} • Next: {receiptDetail.nextBilling}</div></div>
                </div>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", background:"#0A192F", color:"#fff", borderRadius:"12px", padding:"14px 16px"}}>
                  <div style={{fontWeight:800}}>Total Paid</div><div style={{fontSize:"22px", fontWeight:900}}>{receiptDetail.amount===0 ? "Free" : "$"+receiptDetail.amount}</div>
                </div>
                <div style={{fontSize:"11px", color:"#94A3B8", textAlign:"center"}}>Auto-generated receipt • Zero commission • BAR audit log • 112 S Market St Ste 1008 Inglewood CA 90301 • PST • AutoVille Inc</div>
                <button onClick={()=>setShowReceipt(false)} style={{height:"44px", borderRadius:"12px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800}}>Close • {receiptDetail.id}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}