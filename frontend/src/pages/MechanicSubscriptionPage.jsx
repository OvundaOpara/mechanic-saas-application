import { useState, useEffect, useMemo } from "react";

const API = "http://127.0.0.1:5000/api";

const PLANS = [
  { id:"free_trial", name:"1 Week Free Trial", price:0, period:"7 days", per:"/ week", badge:"Trial", popular:false, features:["All workshop features","Up to 5 bookings","BAR invoice","Live tracking","AutoVille verified badge"], cta:"Start Free Trial" },
  { id:"monthly", name:"Monthly", price:40, period:"1 month", per:"/ month", badge:"Flexible", popular:false, features:["Unlimited bookings","Team & specialty","Bookkeeping P/L audit","Expenses immutable","Reviews read-only lazy","Priority support Peter"], cta:"Subscribe $40/mo" },
  { id:"quarterly", name:"Quarterly", price:100, period:"3 months", per:"/ 3 months", badge:"Most Popular", popular:true, features:["Everything in Monthly","Save $20 vs monthly","AutoVille featured listing","Advanced analytics","Custom specializations","BAR compliance kit"], cta:"Subscribe $100 / 3mo", save:"Save $20" },
  { id:"annual", name:"Annual", price:300, period:"12 months", per:"/ year", badge:"Best Value", popular:false, features:["Everything in Quarterly","Save $180 vs monthly","Dedicated account manager","API access","White-label invoices","Inglewood partner badge"], cta:"Subscribe $300 / year", save:"Save $180" },
];

function calcDaysLeft(endDateStr){
  if(!endDateStr) return 0;
  const end = new Date(String(endDateStr).slice(0,10) + "T23:59:59");
  const now = new Date();
  return Math.max(0, Math.ceil((end - now) / (1000*60*60*24)));
}
function getStoredUser(){ try{ return JSON.parse(localStorage.getItem("autoville_user")||"{}"); }catch{ return {}; } }
function planIdFromDb(plan){
  const p = String(plan||"").toLowerCase();
  if(p.includes("trial") || p==="free_trial") return "free_trial";
  if(p.includes("quarter")) return "quarterly";
  if(p.includes("annual") || p.includes("year")) return "annual";
  return "monthly";
}
function normalizeSubscription(s, workshop){
  if(!s) return null;
  const pid = planIdFromDb(s.plan || s.planName);
  const planDef = PLANS.find(p=>p.id===pid) || PLANS[1];
  const statusRaw = String(s.status||"").toLowerCase();
  const status = statusRaw==="trial" || statusRaw==="trialing" ? "Trialing" : statusRaw==="active" ? "Active" : statusRaw==="canceled" || statusRaw==="cancelled" ? "Canceled" : statusRaw==="past due" ? "Past Due" : statusRaw==="expired" ? "Expired" : "Active";
  return {
    id: s.id, planId: pid, planName: planDef.name,
    price: Number(s.amount ?? s.price ?? planDef.price), period: planDef.period, status,
    startDate: String(s.start_date || s.startDate || "").slice(0,10),
    endDate: String(s.end_date || s.endDate || s.renewalDate || "").slice(0,10),
    renewalDate: String(s.end_date || s.endDate || s.renewalDate || "").slice(0,10),
    daysRemaining: calcDaysLeft(s.end_date || s.endDate),
    autoRenew: s.auto_renew ?? s.autoRenew ?? true,
    paymentMethod: s.payment_method || s.paymentMethod || (pid==="free_trial" ? "Free Trial" : "Visa •••• 4242"),
    billingEmail: s.billing_email || s.billingEmail || workshop?.email || getStoredUser().email || "",
    trial: pid==="free_trial",
  };
}
function normalizeReceipt(r){
  return {
    id: r.invoice_id || r.invoiceId || `#INV-${r.id}`,
    dbId: r.id, date: String(r.date || r.created_at || r.receipt_date || "").slice(0,10),
    plan: r.plan || "", amount: Number(r.amount ?? 0), status: r.status || "Paid",
    method: r.method || r.payment_method || r.paymentMethod || "",
    period: r.period || "", subId: r.subscription_id ? `SUB-${r.subscription_id}` : (r.subId || ""),
    receiptNo: r.receipt_no || r.receiptNo || r.receipt_number || `RCPT-${r.id}`,
    tax: r.tax || "$0 CA", total: Number(r.total ?? r.amount ?? 0),
    transactionId: r.transaction_id || r.transactionId || "",
    billingEmail: r.billing_email || r.billingEmail || "",
  };
}
// ---------- PDF BUILDER - no library, real PDF file ----------
function escPdf(s){ return String(s ?? "").replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)"); }
function buildReceiptPdfBlob(receipt, workshopName, workshopEmail){
  const lines = [
    "AutoVille - Ayinde Technologies",
    "112 S Market St, Ste 1008, Inglewood, CA 90301",
    "support@ayindetechnologies.com | Peter +1-201-534-2657 | BAR ARD 284719",
    "",
    `RECEIPT - ${receipt.receiptNo}`,
    `Invoice: ${receipt.id} | Date: ${receipt.date} PST`,
    `Subscription: ${receipt.subId}`,
    "",
    `Workshop: ${workshopName}`,
    `Billing Email: ${workshopEmail || receipt.billingEmail || "-"}`,
    `Plan: ${receipt.plan}`,
    `Period: ${receipt.period || "-"}`,
    `Payment Method: ${receipt.method || "-"}`,
    `Transaction ID: ${receipt.transactionId || "-"}`,
    `Status: ${receipt.status}`,
    "",
    `Amount: $${Number(receipt.amount||0).toFixed(2)}`,
    `Tax: ${receipt.tax}`,
    `TOTAL PAID: $${Number(receipt.total||receipt.amount||0).toFixed(2)} USD`,
    "",
    "California Notice: Digital service. No CA sales tax on SaaS per CDTFA.",
    "Auto-Renewal Law: Renews automatically unless canceled 24h before renewal.",
    "JAMS arbitration with 30-day opt-out per Terms. BAR compliant. Audit stored.",
  ];
  let content = "BT /F1 13 Tf 50 770 Td\n";
  lines.forEach((line, i)=>{
    const y = 770 - i * 18;
    const size = i===0 ? 16 : i===4 ? 14 : 11;
    content += `BT /F1 ${size} Tf 50 ${y} Td (${escPdf(line)}) Tj ET\n`;
  });
  // Footer line
  content += `BT /F1 9 Tf 50 40 Td (${escPdf("Thank you for using AutoVille - Ayinde Technologies")}) Tj ET\n`;
  const objects = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((obj, idx)=>{
    offsets.push(pdf.length);
    pdf += `${idx+1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  offsets.forEach(off=>{ pdf += `${String(off).padStart(10,"0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return new Blob([pdf], { type:"application/pdf" });
}
function downloadReceiptPdf(receipt, workshopName, workshopEmail){
  const blob = buildReceiptPdfBlob(receipt, workshopName, workshopEmail);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${receipt.receiptNo || "receipt"}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
}

export default function MechanicSubscriptionPage({ workshopId: propWorkshopId, workshop, subscription: parentSub, onRefresh }){
  const storedUser = getStoredUser();
  const workshopId = propWorkshopId || workshop?.id || storedUser.id || storedUser.workshop_id;
  const workshopEmail = workshop?.email || storedUser.email || parentSub?.billingEmail || "";
  const workshopName = workshop?.business_name || workshop?.name || storedUser.business_name || storedUser.name || "Workshop";

  const [subscription, setSubscription] = useState(()=> parentSub ? normalizeSubscription(parentSub, workshop) : null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [receipt, setReceipt] = useState(null);

  // Payment modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [payMethod, setPayMethod] = useState("stripe"); // stripe | paypal
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [paypalEmail, setPaypalEmail] = useState(workshopEmail);
  const [payProcessing, setPayProcessing] = useState(false);
  const [payError, setPayError] = useState("");

  async function fetchAll(){
    if(!workshopId){ setLoading(false); return; }
    setLoading(true); setError("");
    try{
      const [sRes, rRes] = await Promise.all([
        fetch(`${API}/subscriptions?workshop_id=${workshopId}`),
        fetch(`${API}/subscriptions/receipts?workshop_id=${workshopId}`),
      ]);
      const sData = await sRes.json().catch(()=>[]);
      const rData = await rRes.json().catch(()=>[]);
      const sList = Array.isArray(sData) ? sData : (sData.subscriptions || []);
      const active = sList.find(s=> ["active","trial","trialing"].includes(String(s.status||"").toLowerCase()));
      const picked = active || sList[0];
      if(picked){
        const norm = normalizeSubscription(picked, workshop);
        setSubscription(norm);
        localStorage.setItem("elite_workshop_subscription", JSON.stringify(picked));
      } else setSubscription(null);
      const rList = Array.isArray(rData) ? rData : (rData.receipts || []);
      setTransactions(rList.map(normalizeReceipt));
    }catch(e){ setError("Could not load subscription from backend. Is Flask running on :5000?"); }
    setLoading(false);
  }

  useEffect(()=>{ fetchAll(); }, [workshopId]);
  useEffect(()=>{ if(parentSub) setSubscription(normalizeSubscription(parentSub, workshop)); }, [parentSub]);
  useEffect(()=>{ if(workshopEmail) setPaypalEmail(workshopEmail); }, [workshopEmail]);

  const filteredTx = useMemo(()=>{
    if(!search) return transactions;
    const s = search.toLowerCase();
    return transactions.filter(t=> `${t.id} ${t.plan} ${t.status} ${t.method} ${t.receiptNo} ${t.transactionId}`.toLowerCase().includes(s));
  },[transactions, search]);

  const statusMeta = (status)=>{
    if(status==="Active") return { bg:"#DCFCE7", color:"#166534", border:"#BBF7D0", dot:"#22C55E", icon:"bi-check-circle-fill" };
    if(status==="Trialing") return { bg:"#EFF6FF", color:"#1E40AF", border:"#BFDBFE", dot:"#3B82F6", icon:"bi-clock-fill" };
    if(status==="Past Due") return { bg:"#FEF3C7", color:"#92400E", border:"#FDE68A", dot:"#F59E0B", icon:"bi-exclamation-triangle-fill" };
    if(status==="Expired"||status==="Canceled") return { bg:"#FEE2E2", color:"#991B1B", border:"#FECACA", dot:"#EF4444", icon:"bi-x-circle-fill" };
    return { bg:"#F8FAFC", color:"#475569", border:"#E2E8F0", dot:"#94A3B8", icon:"bi-dash-circle" };
  };

  const daysLeft = subscription ? calcDaysLeft(subscription.endDate) : 0;
  const progress = subscription ? Math.min(100, Math.max(5, (daysLeft / (subscription.planId==="free_trial"?7: subscription.planId==="monthly"?30: subscription.planId==="quarterly"?90:365))*100)) : 0;

  // ---------- OPEN PAYMENT MODAL ----------
  const openPayModal = (plan)=>{
    if(!workshopId){ alert("No workshop ID found. Please login again."); return; }
    if(plan.id==="free_trial" && transactions.some(t=> t.plan.toLowerCase().includes("trial"))){
      alert("Free Trial already used • BAR ARD 284719 • One trial per workshop");
      return;
    }
    setSelectedPlan(plan);
    setPayMethod("stripe");
    setCardNumber(""); setCardExpiry(""); setCardCvc(""); setCardName("");
    setPaypalEmail(workshopEmail);
    setPayError("");
    setShowPayModal(true);
  };

  const formatCard = (v)=>{
    const digits = v.replace(/\D/g,"").slice(0,16);
    return digits.replace(/(\d{4})(?=\d)/g,"$1 ");
  };
  const formatExpiry = (v)=>{
    const digits = v.replace(/\D/g,"").slice(0,4);
    if(digits.length>2) return digits.slice(0,2)+"/"+digits.slice(2);
    return digits;
  };

  // ---------- PROCESS PAYMENT + REGISTER TRANSACTION ----------
  const processPayment = async ()=>{
    if(!selectedPlan || !workshopId) return;
    setPayError("");

    // Free trial - no card / paypal needed
    if(selectedPlan.id==="free_trial"){
      setPayProcessing(true);
      try{
        const res = await fetch(`${API}/subscriptions`, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ workshop_id: workshopId, plan_id: selectedPlan.id, plan: selectedPlan.name, amount: 0, billing_email: workshopEmail, payment_method: "Free Trial", transaction_id: `TX-FREE-${Date.now()}` })
        });
        const data = await res.json().catch(()=>({}));
        if(!res.ok || data.success===false) throw new Error(data.error || "Free trial failed");
        const newSub = normalizeSubscription(data.subscription || { plan: selectedPlan.name, amount: 0, status: "trialing", start_date: new Date().toISOString().slice(0,10), end_date: new Date(Date.now()+7*86400000).toISOString().slice(0,10) }, workshop);
        setSubscription(newSub);
        if(data.receipt){ const nt = normalizeReceipt(data.receipt); setTransactions(prev=>[nt,...prev]); setReceipt(nt); }
        else await fetchAll();
        setShowPayModal(false);
        if(onRefresh) onRefresh();
      }catch(e){ setPayError(e.message); }
      setPayProcessing(false);
      return;
    }

    // Validate payment inputs
    let paymentMethod = "";
    let transactionId = "";
    if(payMethod==="stripe"){
      const digits = cardNumber.replace(/\D/g,"");
      if(digits.length!==16) return setPayError("Enter a valid 16-digit card number. Use test card 4242 4242 4242 4242.");
      if(!/^\d{2}\/\d{2}$/.test(cardExpiry)) return setPayError("Expiry must be MM/YY.");
      const [mm, yy] = cardExpiry.split("/").map(Number);
      if(mm<1||mm>12) return setPayError("Expiry month must be 01-12.");
      const exp = new Date(2000+yy, mm, 0);
      if(exp < new Date()) return setPayError("Card is expired.");
      if(cardCvc.replace(/\D/g,"").length<3) return setPayError("Enter a valid 3-digit CVC.");
      if(!cardName.trim()) return setPayError("Enter the name on card.");
      paymentMethod = `Stripe •••• ${digits.slice(-4)}`;
      transactionId = `TX-STRIPE-${Date.now().toString(36).toUpperCase()}`;
    } else {
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail||"")) return setPayError("Enter a valid PayPal email.");
      paymentMethod = `PayPal • ${paypalEmail}`;
      transactionId = `TX-PAYPAL-${Date.now().toString(36).toUpperCase()}`;
    }

    setPayProcessing(true);
    try{
      // Simulate Stripe / PayPal gateway (1.4s) - in production replace with Stripe confirmPayment / PayPal capture
      await new Promise(r=> setTimeout(r, 1400));
      // Register transaction + subscription in backend - this is the real registration
      const res = await fetch(`${API}/subscriptions`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          workshop_id: workshopId, plan_id: selectedPlan.id, plan: selectedPlan.name,
          amount: selectedPlan.price, billing_email: workshopEmail || paypalEmail,
          payment_method: paymentMethod, transaction_id: transactionId,
          card_last4: payMethod==="stripe" ? cardNumber.replace(/\D/g,"").slice(-4) : null,
          provider: payMethod
        })
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok || data.success===false) throw new Error(data.error || "Payment failed - transaction not registered");
      const newSub = normalizeSubscription(data.subscription, workshop);
      setSubscription(newSub);
      localStorage.setItem("elite_workshop_subscription", JSON.stringify(data.subscription));
      if(data.receipt){
        const nt = normalizeReceipt({ ...data.receipt, payment_method: paymentMethod, transaction_id: transactionId });
        setTransactions(prev=>[nt, ...prev]);
        setReceipt(nt);
      } else {
        await fetchAll();
      }
      setShowPayModal(false);
      if(onRefresh) onRefresh();
    }catch(e){ setPayError(e.message); }
    setPayProcessing(false);
  };

  const handleCancel = async ()=>{
    if(!subscription?.id) return;
    if(!confirm(`Cancel ${subscription.planName}? Access until ${subscription.endDate} • No refund per Auto-Renewal Law • BAR ARD 284719`)) return;
    try{
      const res = await fetch(`${API}/subscriptions/${subscription.id}/cancel`, { method:"PUT" });
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || "Cancel failed");
      setSubscription({...subscription, status:"Canceled", autoRenew:false});
      if(onRefresh) onRefresh();
    }catch(e){ alert(e.message); }
  };

  const toggleAutoRenew = async ()=>{
    if(!subscription?.id) return;
    try{
      const res = await fetch(`${API}/subscriptions/${subscription.id}/auto-renew`, {
        method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ auto_renew: !subscription.autoRenew })
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || "Toggle failed");
      setSubscription({...subscription, autoRenew:!subscription.autoRenew});
      if(onRefresh) onRefresh();
    }catch(e){ alert(e.message); }
  };

  if(loading) return <div style={{padding:"40px", textAlign:"center", color:"#64748B"}}>Loading subscription from backend...</div>;

  return (
    <>
    <style>{`
      .sub-wrap{ width:100%; max-width:100%; overflow:hidden; }
      .sub-card{ background:#fff; border:1.5px solid #E2E8F0; border-radius:18px; padding:18px; }
      .sub-card-dark{ background:#0A192F; border:1.5px solid #0A192F; border-radius:18px; padding:18px; color:#fff; }
      .plan-card{ background:#fff; border:1.5px solid #E2E8F0; border-radius:18px; padding:18px; height:100%; transition:0.2s; position:relative; }
      .plan-card.popular{ border-color:#0A192F; border-width:2px; box-shadow:0 10px 30px rgba(10,25,47,0.12); transform: translateY(-2px); }
      .plan-card:hover{ border-color:#0A192F; }
      .sub-badge{ font-size:11px; font-weight:800; padding:5px 10px; border-radius:20px; display:inline-flex; align-items:center; gap:6px; }
      .receipt-backdrop{ position:fixed; inset:0; background:rgba(10,25,47,0.55); backdrop-filter:blur(6px); z-index:99; display:grid; place-items:center; padding:16px; } .receipt-modal{ width:100%; max-width:560px; background:#fff; border:2px solid #0A192F; border-radius:22px; overflow:hidden; box-shadow:0 30px 80px rgba(0,0,0,0.25); }
      .pay-backdrop{ position:fixed; inset:0; background:rgba(10,25,47,0.6); backdrop-filter:blur(6px); z-index:100; display:grid; place-items:center; padding:16px; } .pay-modal{ width:100%; max-width:520px; background:#fff; border:2px solid #0A192F; border-radius:22px; overflow:hidden; box-shadow:0 30px 80px rgba(0,0,0,0.3); max-height:92vh; overflow-y:auto; }
      .pay-tab{ flex:1; height:48px; border-radius:12px; border:1.5px solid #E2E8F0; background:#F8FAFC; font-weight:800; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; }
      .pay-tab.active-stripe{ background:#0A192F; color:#fff; border-color:#0A192F; } .pay-tab.active-paypal{ background:#003087; color:#fff; border-color:#003087; }
      .pay-input{ width:100%; height:46px; border:1.5px solid #E2E8F0; border-radius:12px; padding:0 14px; font-size:14px; font-weight:600; background:#F8FAFC; box-sizing:border-box; }
      .progress-track{ height:10px; background:#F1F5F9; border-radius:20px; overflow:hidden; } .progress-bar{ height:100%; background:#0A192F; transition:width 0.5s; }
      @media(max-width:768px){ .sub-card, .sub-card-dark, .plan-card{ padding:14px; } }
    `}</style>

    <div className="sub-wrap">
      <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', marginBottom:'14px'}}>
        <div><h2 style={{fontWeight:900, fontSize:'28px', color:'#0A192F', margin:'0 0 6px'}}>Subscription • Plans & Receipts</h2><p style={{color:'#6B7A90', fontSize:'15px', margin:0, fontWeight:500}}>Current plan, days remaining, renewal, subscribe, all past receipts • BAR ARD 284719 • $ USD • PST • Inglewood, CA</p></div>
        <span style={{height:'44px', borderRadius:'12px', background:'#0A192F', color:'#fff', fontWeight:800, fontSize:'13px', padding:'0 14px', display:'grid', placeItems:'center', alignSelf:'flex-start'}}><i className="bi bi-credit-card me-2"></i>{subscription ? `${subscription.planName} • ${subscription.status} • ${daysLeft}d left` : "No Active Subscription"}</span>
      </div>

      {error && <div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", color:"#991B1B", padding:"12px 14px", borderRadius:"12px", marginBottom:"12px", fontSize:"13px", fontWeight:700}}>{error}</div>}

      {subscription ? (
        <div className="row g-3 mb-3" style={{margin:0, width:'100%'}}>
          <div className="col-lg-8">
            <div className="sub-card-dark" style={{height:'100%'}}>
              <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'10px', alignItems:'flex-start'}}>
                <div><div style={{fontSize:'12px', fontWeight:800, color:'#94A3B8', letterSpacing:'0.04em'}}>CURRENT SUBSCRIPTION • AUTO-RENEW {subscription.autoRenew ? "ON" : "OFF"}</div><div style={{fontSize:'32px', fontWeight:900, marginTop:'8px'}}>{subscription.planName} • ${subscription.price} {subscription.period}</div><div style={{fontSize:'13px', color:'#CBD5E1', marginTop:'4px'}}>SUB-{subscription.id} • {subscription.startDate} → {subscription.endDate} • Renews {subscription.renewalDate} PST • {subscription.billingEmail}</div></div>
                <span className="sub-badge" style={{background: statusMeta(subscription.status).bg, color: statusMeta(subscription.status).color, border:`1px solid ${statusMeta(subscription.status).border}`, fontSize:'12px'}}><span style={{width:'8px', height:'8px', borderRadius:'50%', background: statusMeta(subscription.status).dot, display:'inline-block'}}></span><i className={`bi ${statusMeta(subscription.status).icon}`}></i>{subscription.status} • {daysLeft} days left</span>
              </div>
              <div style={{marginTop:'18px'}}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', fontWeight:700, color:'#94A3B8', marginBottom:'6px'}}><span>{daysLeft} days remaining before renewal • {subscription.renewalDate}</span><span>{progress.toFixed(0)}% cycle left</span></div>
                <div className="progress-track"><div className="progress-bar" style={{width:`${progress}%`, background: daysLeft<=7 ? '#EF4444' : daysLeft<=21 ? '#F59E0B' : '#22C55E'}}></div></div>
                <div style={{display:'flex', gap:'8px', flexWrap:'wrap', marginTop:'12px'}}>
                  <span style={{fontSize:'11px', fontWeight:700, background:'rgba(255,255,255,0.10)', padding:'6px 10px', borderRadius:'20px'}}><i className="bi bi-calendar-check me-1"></i>Renews: {subscription.renewalDate} PST</span>
                  <span style={{fontSize:'11px', fontWeight:700, background:'rgba(255,255,255,0.10)', padding:'6px 10px', borderRadius:'20px'}}><i className="bi bi-credit-card me-1"></i>{subscription.paymentMethod}</span>
                  <button onClick={toggleAutoRenew} style={{fontSize:'11px', fontWeight:700, background: subscription.autoRenew ? '#22C55E' : '#475569', color:'#fff', padding:'6px 10px', borderRadius:'20px', border:'none', cursor:'pointer'}}>Auto-Renew {subscription.autoRenew ? 'ON' : 'OFF'} • Click to toggle</button>
                  {subscription.status!=="Canceled" && <button onClick={handleCancel} style={{fontSize:'11px', fontWeight:700, background:'#EF4444', color:'#fff', padding:'6px 10px', borderRadius:'20px', border:'none', cursor:'pointer'}}>Cancel Plan</button>}
                </div>
              </div>
              <div style={{marginTop:'18px', display:'flex', gap:'10px', flexWrap:'wrap'}}><span style={{fontSize:'11px', color:'#94A3B8', alignSelf:'center'}}>BAR ARD 284719 • JAMS arbitration • 30-day opt-out • Ayinde Technologies</span></div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="sub-card" style={{height:'100%'}}>
              <div style={{fontWeight:900, fontSize:'15px', color:'#0A192F'}}><i className="bi bi-receipt me-2"></i>Renewal Summary • $ USD</div>
              <div style={{marginTop:'14px', display:'grid', gap:'10px', fontSize:'13px'}}>
                <div style={{display:'flex', justifyContent:'space-between', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'10px', padding:'10px 12px'}}><span style={{color:'#6B7A90', fontWeight:600}}>Plan</span><b style={{color:'#0A192F'}}>{subscription.planName} • {subscription.period}</b></div>
                <div style={{display:'flex', justifyContent:'space-between', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'10px', padding:'10px 12px'}}><span style={{color:'#6B7A90'}}>Price</span><b>${subscription.price} • {subscription.trial ? 'Free Trial' : 'USD'}</b></div>
                <div style={{display:'flex', justifyContent:'space-between', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'10px', padding:'10px 12px'}}><span style={{color:'#6B7A90'}}>Status</span><span className="sub-badge" style={{background: statusMeta(subscription.status).bg, color: statusMeta(subscription.status).color, border:`1px solid ${statusMeta(subscription.status).border}`}}>{subscription.status}</span></div>
                <div style={{display:'flex', justifyContent:'space-between', background:'#0A192F', color:'#fff', borderRadius:'10px', padding:'10px 12px'}}><span style={{color:'#94A3B8'}}>Days Remaining</span><b style={{fontSize:'18px'}}>{daysLeft} days • Renews {subscription.renewalDate}</b></div>
                <div style={{fontSize:'11px', color:'#6B7A90', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:'10px', padding:'10px'}}><i className="bi bi-info-circle me-1"></i><b>California Auto-Renewal Law:</b> Subscription auto-renews unless canceled 24h before renewal. Receipt emailed to {subscription.billingEmail}. Tax $0 CA for digital service. Ayinde Technologies 112 S Market St, Ste 1008, Inglewood, CA 90301.</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="sub-card" style={{borderColor:'#FECACA', background:'#FEF2F2', marginBottom:'14px', textAlign:'center', padding:'28px'}}>
          <div style={{fontWeight:900, fontSize:'20px', color:'#991B1B'}}><i className="bi bi-exclamation-triangle me-2"></i>No Active Subscription • Workshop Hidden from Owners</div>
          <div style={{fontSize:'14px', color:'#991B1B', marginTop:'6px'}}>Subscribe to appear on Workshops page • BAR ARD 284719 • Choose plan below • Free trial available once</div>
        </div>
      )}

      <div style={{marginBottom:'10px', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'10px'}}>
        <span style={{fontWeight:900, fontSize:'18px', color:'#0A192F'}}><i className="bi bi-gem me-2"></i>Choose / Change Plan • $ USD • PST • Cancel Anytime</span>
        <span style={{fontSize:'12px', fontWeight:700, color:'#6B7A90', background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'6px 12px', borderRadius:'20px'}}>{subscription ? `Current: ${subscription.planName} • ${daysLeft}d left • ${subscription.status}` : 'No subscription • Pick below'} • Auto-Renewal Law disclosure</span>
      </div>

      <div className="row g-3 mb-4" style={{margin:0, width:'100%'}}>
        {PLANS.map(p=>{
          const isCurrent = subscription?.planId===p.id && subscription.status!=="Canceled";
          return (
            <div key={p.id} className="col-md-6 col-xl-3">
              <div className={`plan-card ${p.popular ? 'popular' : ''}`}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginTop: p.popular ? '8px' : '0'}}><span className="sub-badge" style={{background: p.id==='free_trial' ? '#EFF6FF' : p.popular ? '#0A192F' : '#F8FAFC', color: p.id==='free_trial' ? '#1E40AF' : p.popular ? '#fff' : '#475569', border:`1px solid ${p.popular ? '#0A192F' : '#E2E8F0'}`}}>{p.badge} {p.save ? `• ${p.save}` : ''}</span>{isCurrent && <span className="sub-badge" style={{background:'#DCFCE7', color:'#166534', border:'1px solid #BBF7D0'}}><i className="bi bi-check-circle-fill"></i>CURRENT • {daysLeft}d left</span>}</div>
                <div style={{marginTop:'12px'}}><div style={{fontWeight:900, fontSize:'20px', color:'#0A192F'}}>{p.name}</div><div style={{fontWeight:900, fontSize:'32px', color:'#0A192F', marginTop:'4px'}}>${p.price}<span style={{fontSize:'14px', fontWeight:600, color:'#6B7A90'}}>{p.per}</span></div><div style={{fontSize:'12px', color:'#6B7A90', fontWeight:600}}>{p.period} • $ USD • CA tax $0 • BAR compliant</div></div>
                <div style={{marginTop:'14px', display:'grid', gap:'8px'}}>{p.features.map(f=><div key={f} style={{fontSize:'13px', color:'#0A192F', display:'flex', gap:'8px'}}><i className="bi bi-check2" style={{color:'#22C55E', fontWeight:900}}></i>{f}</div>)}</div>
                <button onClick={()=>openPayModal(p)} disabled={isCurrent} style={{marginTop:'16px', width:'100%', height:'48px', borderRadius:'12px', background: isCurrent ? '#F1F5F9' : p.popular ? '#0A192F' : '#fff', color: isCurrent ? '#94A3B8' : p.popular ? '#fff' : '#0A192F', border: isCurrent ? '1.5px solid #E2E8F0' : p.popular ? '1.5px solid #0A192F' : '1.5px solid #0A192F', fontWeight:800, fontSize:'14px', cursor: isCurrent ? 'not-allowed' : 'pointer'}}>{isCurrent ? `Current • ${daysLeft}d left • Renews ${subscription.renewalDate}` : p.cta}</button>
                {p.id!=="free_trial" && <div style={{fontSize:'11px', color:'#6B7A90', textAlign:'center', marginTop:'8px'}}>Auto-renews • Cancel 24h before • JAMS arbitration</div>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sub-card">
        <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', marginBottom:'14px'}}>
          <span style={{fontWeight:900, fontSize:'16px', color:'#0A192F'}}><i className="bi bi-receipt-cutoff me-2"></i>Previous Transactions • Receipts • All History</span>
          <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
            <div style={{position:'relative'}}><i className="bi bi-search" style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#6B7A90'}}></i><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search invoice, plan, receipt..." style={{height:'42px', border:'1.5px solid #E2E8F0', borderRadius:'12px', padding:'0 14px 0 36px', fontSize:'13px', fontWeight:600, background:'#F8FAFC', width:'260px'}} /></div>
            <span style={{fontSize:'12px', fontWeight:700, background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'8px 12px', borderRadius:'20px', color:'#6B7A90'}}>{filteredTx.length}/{transactions.length} receipts • $ USD</span>
          </div>
        </div>

        <div className="d-none d-md-block" style={{overflowX:'auto'}}>
          <table className="table" style={{fontSize:'14px', margin:0}}>
            <thead><tr style={{color:'#6B7A90', fontSize:'12px'}}><th style={{fontWeight:800}}>INVOICE • DATE • PST</th><th style={{fontWeight:800}}>PLAN • PERIOD</th><th style={{fontWeight:800}}>AMOUNT • TAX • TOTAL</th><th style={{fontWeight:800}}>METHOD • STATUS</th><th style={{fontWeight:800}}>RECEIPT</th></tr></thead>
            <tbody>
              {filteredTx.map(t=>{
                const meta = statusMeta(t.status);
                return (
                  <tr key={t.dbId || t.id}>
                    <td><b style={{color:'#0A192F'}}>{t.id}</b><br/><span style={{fontSize:'12px', color:'#6B7A90'}}>{t.date} PST • {t.subId}</span></td>
                    <td><b style={{color:'#0A192F'}}>{t.plan}</b><br/><span style={{fontSize:'12px', color:'#6B7A90'}}>{t.period}</span></td>
                    <td><b style={{color:'#0A192F'}}>${t.amount}</b> + {t.tax}<br/><span style={{fontSize:'12px', color:'#6B7A90'}}>Total: ${t.total} • USD</span></td>
                    <td><span style={{fontSize:'12px', fontWeight:700}}>{t.method}</span><br/><span className="sub-badge" style={{background:meta.bg, color:meta.color, border:`1px solid ${meta.border}`, marginTop:'4px'}}><i className={`bi ${meta.icon}`}></i>{t.status}</span></td>
                    <td><div style={{display:'flex', gap:'6px'}}><button onClick={()=>setReceipt(t)} style={{height:'36px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff', fontWeight:700, fontSize:'12px', padding:'0 12px'}}><i className="bi bi-eye me-1"></i>{t.receiptNo}</button><button onClick={()=>downloadReceiptPdf(t, workshopName, workshopEmail)} style={{height:'36px', borderRadius:'10px', border:'1.5px solid #0A192F', background:'#0A192F', color:'#fff', fontWeight:700, fontSize:'12px', padding:'0 12px'}}><i className="bi bi-download"></i> PDF</button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="d-md-none" style={{display:'grid', gap:'10px'}}>
          {filteredTx.map(t=>(
            <div key={t.dbId || t.id} style={{border:'1.5px solid #E2E8F0', borderRadius:'14px', padding:'14px', background:'#fff'}}>
              <div style={{display:'flex', justifyContent:'space-between'}}><b style={{color:'#0A192F'}}>{t.id} • {t.plan}</b><span className="sub-badge" style={{background: statusMeta(t.status).bg, color: statusMeta(t.status).color, border:`1px solid ${statusMeta(t.status).border}`}}>{t.status}</span></div>
              <div style={{fontSize:'12px', color:'#6B7A90', marginTop:'6px'}}>{t.date} • {t.period} • {t.method} • Total ${t.total} USD • {t.tax}</div>
              <div style={{display:'flex', gap:'8px', marginTop:'10px'}}><button onClick={()=>setReceipt(t)} style={{flex:1, height:'40px', borderRadius:'10px', border:'1.5px solid #0A192F', background:'#fff', fontWeight:700, fontSize:'12px'}}><i className="bi bi-receipt me-1"></i>View {t.receiptNo}</button><button onClick={()=>downloadReceiptPdf(t, workshopName, workshopEmail)} style={{flex:1, height:'40px', borderRadius:'10px', border:'1.5px solid #0A192F', background:'#0A192F', color:'#fff', fontWeight:700, fontSize:'12px'}}><i className="bi bi-download me-1"></i>PDF</button></div>
            </div>
          ))}
        </div>

        {filteredTx.length===0 && <div style={{padding:'30px', textAlign:'center', color:'#6B7A90', fontWeight:600}}>{transactions.length===0 ? "No receipts yet — subscribe to a plan above and a receipt will appear here." : `No transactions for "${search}"`}</div>}

        <div style={{marginTop:'14px', background:'#0A192F', borderRadius:'12px', padding:'14px', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'10px', color:'#94A3B8', fontSize:'12px', fontWeight:600}}><span><i className="bi bi-shield-check me-1"></i>All receipts stored • BAR compliant • Auto-Renewal Law • Ayinde Technologies • 112 S Market St, Ste 1008, Inglewood, CA 90301 • support@ayindetechnologies.com • {transactions.length} total • ${transactions.reduce((s,t)=>s+t.amount,0)} lifetime</span><span style={{color:'#fff', fontWeight:800}}>{subscription ? `${subscription.planName} • ${daysLeft}d left • ${subscription.status} • Renews ${subscription.renewalDate}` : 'No active • Subscribe above'}</span></div>
      </div>
    </div>

    {/* PAYMENT MODAL - PayPal / Stripe */}
    {showPayModal && selectedPlan && (
      <div className="pay-backdrop" onClick={()=>{ if(!payProcessing) setShowPayModal(false); }}>
        <div className="pay-modal" onClick={e=>e.stopPropagation()}>
          <div style={{padding:'18px', background:'#0A192F', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div><div style={{fontWeight:900, fontSize:'18px'}}><i className="bi bi-lock-fill me-2"></i>Checkout • Secure Payment</div><div style={{fontSize:'12px', color:'#94A3B8'}}>{selectedPlan.name} • ${selectedPlan.price} • {selectedPlan.period} • BAR ARD 284719</div></div>
            <button onClick={()=>{ if(!payProcessing) setShowPayModal(false); }} style={{width:'40px', height:'40px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.08)', color:'#fff'}}><i className="bi bi-x-lg"></i></button>
          </div>
          <div style={{padding:'18px', display:'grid', gap:'14px'}}>
            <div style={{background:'#F8FAFC', border:'1.5px solid #E2E8F0', borderRadius:'14px', padding:'14px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div><div style={{fontWeight:900, fontSize:'16px', color:'#0A192F'}}>{selectedPlan.name}</div><div style={{fontSize:'12px', color:'#6B7A90'}}>{selectedPlan.period} • Auto-renews • Cancel 24h before • $ USD</div></div>
              <div style={{fontWeight:900, fontSize:'24px', color:'#0A192F'}}>${selectedPlan.price}</div>
            </div>

            {selectedPlan.id==="free_trial" ? (
              <div style={{background:'#EFF6FF', border:'1.5px solid #BFDBFE', borderRadius:'14px', padding:'14px', fontSize:'13px', color:'#1E40AF', lineHeight:1.6}}>
                <b>Free Trial • No card required.</b><br/>7 days free, all workshop features. After 7 days, choose Monthly $40 / Quarterly $100 / Annual $300 to keep appearing to owners. One trial per workshop • BAR ARD 284719.
              </div>
            ) : (
              <>
                <div style={{display:'flex', gap:'10px'}}>
                  <button onClick={()=>setPayMethod("stripe")} className={`pay-tab ${payMethod==="stripe" ? "active-stripe" : ""}`}><i className="bi bi-credit-card"></i>Stripe • Card</button>
                  <button onClick={()=>setPayMethod("paypal")} className={`pay-tab ${payMethod==="paypal" ? "active-paypal" : ""}`}><i className="bi bi-paypal"></i>PayPal</button>
                </div>

                {payMethod==="stripe" ? (
                  <div style={{display:'grid', gap:'12px'}}>
                    <div><label style={{fontSize:'12px', fontWeight:800, color:'#0A192F'}}>Name on card</label><input className="pay-input" value={cardName} onChange={e=>setCardName(e.target.value)} placeholder="Obinna Opara" /></div>
                    <div><label style={{fontSize:'12px', fontWeight:800, color:'#0A192F'}}>Card number</label><input className="pay-input" value={cardNumber} onChange={e=>setCardNumber(formatCard(e.target.value))} placeholder="4242 4242 4242 4242" inputMode="numeric" /></div>
                    <div style={{display:'flex', gap:'12px'}}>
                      <div style={{flex:1}}><label style={{fontSize:'12px', fontWeight:800, color:'#0A192F'}}>Expiry</label><input className="pay-input" value={cardExpiry} onChange={e=>setCardExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" /></div>
                      <div style={{flex:1}}><label style={{fontSize:'12px', fontWeight:800, color:'#0A192F'}}>CVC</label><input className="pay-input" value={cardCvc} onChange={e=>setCardCvc(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="123" inputMode="numeric" /></div>
                    </div>
                    <div style={{fontSize:'11px', color:'#6B7A90', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'10px', padding:'10px'}}>Test mode: use <b>4242 4242 4242 4242</b>, any future expiry, any CVC. In production this calls Stripe confirmPayment.</div>
                  </div>
                ) : (
                  <div style={{display:'grid', gap:'12px'}}>
                    <div style={{background:'#003087', borderRadius:'14px', padding:'14px', color:'#fff', display:'flex', gap:'10px', alignItems:'center'}}><i className="bi bi-paypal" style={{fontSize:'28px'}}></i><div><div style={{fontWeight:900}}>Pay with PayPal</div><div style={{fontSize:'12px', opacity:0.8}}>You will be charged ${selectedPlan.price} • Secure PayPal checkout</div></div></div>
                    <div><label style={{fontSize:'12px', fontWeight:800, color:'#0A192F'}}>PayPal email</label><input className="pay-input" value={paypalEmail} onChange={e=>setPaypalEmail(e.target.value)} placeholder="you@paypal.com" type="email" /></div>
                    <div style={{fontSize:'11px', color:'#6B7A90'}}>Test mode: any valid email works. In production this opens PayPal checkout and captures the order.</div>
                  </div>
                )}
              </>
            )}

            {payError && <div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", color:"#991B1B", padding:"12px", borderRadius:"12px", fontSize:"13px", fontWeight:700}}>{payError}</div>}

            <div style={{background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'12px', padding:'12px', display:'flex', justifyContent:'space-between', fontSize:'13px'}}><span style={{color:'#6B7A90'}}>Total today • Tax $0 CA</span><b style={{color:'#0A192F', fontSize:'16px'}}>${selectedPlan.price} USD</b></div>

            <button onClick={processPayment} disabled={payProcessing} style={{width:'100%', height:'50px', borderRadius:'12px', background: selectedPlan.id==="free_trial" ? '#22C55E' : payMethod==="paypal" ? '#003087' : '#0A192F', color:'#fff', border:'none', fontWeight:900, fontSize:'15px', cursor: payProcessing ? 'not-allowed' : 'pointer'}}>
              {payProcessing ? "Processing payment... Please wait" : selectedPlan.id==="free_trial" ? "Start Free Trial • $0" : payMethod==="paypal" ? `Pay $${selectedPlan.price} with PayPal` : `Pay $${selectedPlan.price} with Stripe`}
            </button>
            <div style={{fontSize:'11px', color:'#6B7A90', textAlign:'center', lineHeight:1.6}}>Secure • 256-bit SSL • BAR ARD 284719 • Auto-renews unless canceled 24h before • Receipt emailed to {workshopEmail} + PDF download after payment • Support Peter +1-201-534-2657</div>
          </div>
        </div>
      </div>
    )}

    {receipt && (
      <div className="receipt-backdrop" onClick={()=>setReceipt(null)}>
        <div className="receipt-modal" onClick={e=>e.stopPropagation()}>
          <div style={{padding:'18px', background:'#0A192F', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div><div style={{fontWeight:900, fontSize:'18px'}}>Receipt • {receipt.receiptNo}</div><div style={{fontSize:'12px', color:'#94A3B8'}}>{receipt.id} • {receipt.date} PST • BAR ARD 284719 • AutoVille • $ USD</div></div>
            <button onClick={()=>setReceipt(null)} style={{width:'40px', height:'40px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.08)', color:'#fff'}}><i className="bi bi-x-lg"></i></button>
          </div>
          <div style={{padding:'18px', display:'grid', gap:'12px'}}>
            <div style={{border:'1.5px solid #0A192F', borderRadius:'14px', padding:'14px'}}><div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90'}}>TRANSACTION RECEIPT • AYINDE TECHNOLOGIES • 112 S Market St, Ste 1008, Inglewood, CA 90301</div><div style={{marginTop:'8px', fontSize:'14px', lineHeight:1.7, color:'#0A192F'}}><b>Workshop:</b> {workshopName} • BAR ARD 284719 • {subscription?.billingEmail || workshopEmail}<br/><b>Plan:</b> {receipt.plan} • {receipt.period} • {receipt.subId}<br/><b>Amount:</b> ${receipt.amount} + {receipt.tax} = <b>Total ${receipt.total} USD</b> • {receipt.method} • {receipt.status}<br/><b>Transaction:</b> {receipt.transactionId || "-"}<br/><b>Date:</b> {receipt.date} PST • {receipt.id} • {receipt.receiptNo}</div></div>
            <div style={{border:'1px solid #E2E8F0', borderRadius:'12px', padding:'12px', fontSize:'11px', color:'#6B7A90', lineHeight:1.6}}><b>California Notice:</b> Digital service • No CA sales tax on SaaS per CDTFA • Auto-renewal Law: subscription renews automatically unless canceled 24h prior • JAMS arbitration with 30-day opt-out per Terms • Support Peter +1-201-534-2657 • support@ayindetechnologies.com • BAR compliant • Audit stored.</div>
            <div style={{display:'flex', gap:'10px'}}><button onClick={()=>downloadReceiptPdf(receipt, workshopName, workshopEmail)} style={{flex:1, height:'46px', borderRadius:'12px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800}}><i className="bi bi-download me-1"></i>Download PDF • {receipt.receiptNo}.pdf</button><button onClick={()=>setReceipt(null)} style={{flex:1, height:'46px', borderRadius:'12px', background:'#fff', border:'1.5px solid #E2E8F0', fontWeight:700}}>Close</button></div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}