import { useState, useMemo, useEffect, useCallback } from "react";
import Swal from "sweetalert2";

const API = "http://127.0.0.1:5000/api";

function getStoredUser(){ try{ return JSON.parse(localStorage.getItem("autoville_user")||"{}"); }catch{ return {}; } }

function mapStatusToUI(raw){
  const s = String(raw||"").toLowerCase();
  if(["paid","completed","success","succeeded"].includes(s)) return "Paid";
  if(["pending","awaiting","unpaid"].includes(s)) return "Pending";
  if(["refunded","refund","cancelled","canceled"].includes(s)) return "Refunded";
  return s ? s.charAt(0).toUpperCase()+s.slice(1) : "Pending";
}
function mapStatusToBackend(ui){
  const s = String(ui||"").toLowerCase();
  if(s==="paid") return "paid";
  if(s==="pending") return "pending";
  if(s==="refunded") return "refunded";
  return s;
}
function normalizePayment(p, workshop){
  const carMake = p.car_make || p.make || "";
  const carModel = p.car_model || p.model || "";
  const carYear = p.car_year || p.year || "";
  const carPlate = p.plate || p.license_plate || "";
  const carStr = [carMake, carModel, carYear].filter(Boolean).join(" ") || p.car || p.vehicle || "-";
  const carFull = carPlate ? `${carStr} • ${carPlate}` : carStr;
  const dateStr = String(p.payment_date || p.date || p.created_at || "").slice(0,10);
  const amount = Number(p.amount ?? p.total ?? 0);
  const tax = Number(p.tax ?? 0);
  const discount = Number(p.discount ?? 0);
  return {
    dbId: p.id, id: `#PAY-${p.id}`, date: dateStr, time: p.payment_time || p.time || "",
    customer: p.customer_name || p.owner_name || p.customer || "Customer",
    car: carFull, booking: p.booking_id ? `#AV-${p.booking_id}` : (p.booking || p.bookingId || "#AV-XXXX"),
    bookingDbId: p.booking_id || null, service: p.service_type || p.service || p.description || "General Repair",
    amount, method: p.payment_method || p.method || "Card", status: mapStatusToUI(p.status),
    email: p.customer_email || p.owner_email || p.email || "-", bar: p.bar_license || "ARD 284719",
    tax, discount, total: Number(p.total ?? (amount + tax - discount)), raw: p,
  };
}
const swalError = (title, text)=> Swal.fire({ icon:"error", title, text, confirmButtonColor:"#0A192F" });
const swalSuccess = (title, text)=> Swal.fire({ icon:"success", title, text, confirmButtonColor:"#0A192F" });

export default function MechanicPaymentsPage({ workshopId: propWorkshopId, workshop, payments: extPayments, setPayments: extSetPayments, onLogPayment, initialBooking, bookingToPay, preselectedBooking }) {
  const storedUser = getStoredUser();
  const workshopId = propWorkshopId || workshop?.id || storedUser.id || storedUser.workshop_id || storedUser.workshopId;
  const workshopName = workshop?.business_name || workshop?.name || storedUser.business_name || "Workshop";

  const [localPayments, setLocalPayments] = useState([]);
  const payments = extPayments && extPayments.length && !workshopId ? extPayments : localPayments;
  const setPayments = extSetPayments || setLocalPayments;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("All");
  const [status, setStatus] = useState("All");
  const [dateF, setDateF] = useState("All");
  const [page, setPage] = useState(0);
  const perPage = 5;
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [bookingsList, setBookingsList] = useState([]);
  const [form, setForm] = useState({booking:"", customer:"", car:"", service:"", amount:"", method:"Card", status:"Paid", date:new Date().toISOString().slice(0,10)});
  const [saving, setSaving] = useState(false);

  const incomingBooking = initialBooking || bookingToPay || preselectedBooking;
  useEffect(()=>{
    if(incomingBooking){
      const b = incomingBooking;
      setForm(prev=> ({ ...prev, booking: b.bookingId || b.id || b.booking || prev.booking, customer: b.customer || b.customer_name || prev.customer, car: b.car || prev.car, service: b.service || prev.service, amount: b.amount ? String(b.amount) : prev.amount }));
      setShowAdd(true);
    }
  }, [incomingBooking]);

  const fetchPayments = useCallback(async ()=>{
    if(!workshopId){ setLoading(false); return; }
    setLoading(true); setError("");
    try{
      let res = await fetch(`${API}/workshops/${workshopId}/incomes?limit=200`);
      let data = await res.json().catch(()=>[]);
      if(!res.ok){
        res = await fetch(`${API}/incomes?workshop_id=${workshopId}&limit=200`);
        data = await res.json().catch(()=>[]);
        if(!res.ok) throw new Error(data.error || "Failed to load payments");
      }
      const list = Array.isArray(data) ? data : (data.incomes || data.payments || data.data || []);
      const norm = list.map(p=> normalizePayment(p, workshop));
      setLocalPayments(norm);
      if(extSetPayments) extSetPayments(norm);
    }catch(e){ setError(e.message || "Could not load payments. Is Flask running on :5000?"); setLocalPayments([]); }
    setLoading(false);
  }, [workshopId]);

  const fetchBookingsForForm = useCallback(async ()=>{
    if(!workshopId) return;
    try{
      const res = await fetch(`${API}/bookings?workshop_id=${workshopId}&limit=200`);
      const data = await res.json().catch(()=>[]);
      const list = Array.isArray(data) ? data : (data.bookings || []);
      setBookingsList(list);
    }catch{}
  }, [workshopId]);

  useEffect(()=>{ fetchPayments(); fetchBookingsForForm(); }, [fetchPayments, fetchBookingsForForm]);

  const filtered = useMemo(()=>{
    let d=[...payments];
    if(search){ const s=search.toLowerCase(); d=d.filter(p=> `${p.id} ${p.customer} ${p.booking} ${p.service} ${p.car} ${p.method}`.toLowerCase().includes(s)); }
    if(method!=="All") d=d.filter(p=>p.method===method);
    if(status!=="All") d=d.filter(p=>p.status===status);
    if(dateF==="Today"){ const t=new Date().toISOString().slice(0,10); d=d.filter(p=>p.date===t); }
    if(dateF==="This Week") d=d.filter(p=> p.date && new Date(p.date) >= new Date(Date.now()-7*86400000));
    d.sort((a,b)=> new Date(b.date||"1970-01-01") - new Date(a.date||"1970-01-01"));
    return d;
  },[payments, search, method, status, dateF]);

  const totalPages = Math.ceil(filtered.length/perPage);
  const paged = filtered.slice(page*perPage, page*perPage+perPage);
  const stats = { revenue: payments.filter(p=>p.status==="Paid").reduce((s,p)=>s+p.amount,0), pending: payments.filter(p=>p.status==="Pending").reduce((s,p)=>s+p.amount,0), avg: payments.length ? (payments.reduce((s,p)=>s+p.amount,0)/payments.length).toFixed(0) : 0, count: payments.filter(p=>p.status==="Paid").length };

  const updateStatus = async (id, newStatus)=>{
    const target = payments.find(p=> p.id===id);
    if(!target) return;
    const oldStatus = target.status;
    setPayments(prev=> prev.map(p=> p.id===id ? {...p, status:newStatus} : p));
    if(selected && selected.id===id) setSelected({...selected, status:newStatus});
    try{
      let res = await fetch(`${API}/workshops/incomes/${target.dbId}/status`, { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ status: mapStatusToBackend(newStatus) }) });
      if(!res.ok){ res = await fetch(`${API}/incomes/${target.dbId}/status`, { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ status: mapStatusToBackend(newStatus) }) }); }
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || "Status update failed");
      await fetchPayments();
      swalSuccess("Status Updated", `${target.id} is now ${newStatus}`);
    }catch(e){
      setPayments(prev=> prev.map(p=> p.id===id ? {...p, status:oldStatus} : p));
      if(selected && selected.id===id) setSelected({...selected, status:oldStatus});
      swalError("Status Update Failed", e.message);
    }
  };

  const addPayment = async ()=>{
  if(!form.customer || !form.amount){ Swal.fire({icon:"warning", title:"Missing Fields", text:"Customer & amount are required", confirmButtonColor:"#0A192F"}); return; }
  if(!workshopId){ Swal.fire({icon:"error", title:"No Workshop", text:"No workshop ID. Please login again.", confirmButtonColor:"#0A192F"}); return; }
  setSaving(true);
  try{
    const bookingIdNum = String(form.booking||"").replace("#AV-","").replace("AV-","").trim();
    const payload = { workshop_id: workshopId, booking_id: /^\d+$/.test(bookingIdNum) ? Number(bookingIdNum) : null, booking: form.booking, customer_name: form.customer, car: form.car, service: form.service, service_type: form.service, amount: Number(form.amount), payment_method: form.method, method: form.method, status: mapStatusToBackend(form.status), payment_date: form.date, date: form.date, tax: 0, discount: 0, description: form.service };
    console.log("POST payload:", payload); // <-- check browser console F12
    let res = await fetch(`${API}/workshops/${workshopId}/incomes`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
    let raw = await res.text();
    console.log("POST status:", res.status, "response:", raw); // <-- real error is here
    let data = {};
    try{ data = JSON.parse(raw); }catch{}
    if(!res.ok){
      throw new Error(`HTTP ${res.status} - ${data.error || raw.slice(0,300) || "No response from backend"}`);
    }
    const created = data.income || data.payment || data.data || data;
    const np = created && created.id ? normalizePayment(created, workshop) : { dbId: Date.now(), id: `#PAY-${3000+payments.length+1}`, date: form.date, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})+" PST", customer: form.customer, car: form.car||"-", booking: form.booking||"#AV-XXXX", service: form.service||"General Repair", amount: Number(form.amount), method: form.method, status: form.status, email:"-", bar:"ARD 284719", tax:0, discount:0, total: Number(form.amount) };
    setPayments([np, ...payments]);
    setShowAdd(false);
    setForm({booking:"", customer:"", car:"", service:"", amount:"", method:"Card", status:"Paid", date:new Date().toISOString().slice(0,10)});
    await fetchPayments();
    if(onLogPayment) onLogPayment(np);
    Swal.fire({icon:"success", title:"Payment Logged", text:`$${form.amount} from ${form.customer} added to revenue`, confirmButtonColor:"#0A192F"});
  }catch(e){
    Swal.fire({icon:"error", title:"Failed to Log Payment", text: e.message, confirmButtonColor:"#0A192F"});
  }
  setSaving(false);
};

  const handleBookingSelect = (bookingLabel)=>{
    setForm(prev=> ({...prev, booking: bookingLabel}));
    const idNum = String(bookingLabel||"").replace("#AV-","").trim();
    const found = bookingsList.find(b=> String(b.id)===idNum);
    if(found){
      const carStr = [found.car_make, found.car_model, found.car_year].filter(Boolean).join(" ") || found.car || "";
      setForm(prev=> ({ ...prev, booking: bookingLabel, customer: found.owner_name || found.customer_name || prev.customer, car: carStr || prev.car, service: found.service_type || found.service || prev.service, amount: found.amount ? String(found.amount) : prev.amount }));
    }
  };

  const statusColor=(s)=> s==="Paid"?{bg:"#DCFCE7", color:"#166534"}: s==="Pending"?{bg:"#FEF3C7", color:"#92400E"}:{bg:"#FEE2E2", color:"#991B1B"};
  const methodColor=(m)=> m==="Card"?{bg:"#DBEAFE", color:"#1E40AF"}: m==="Cash"?{bg:"#F0FDF4", color:"#166534"}:{bg:"#F1F5F9", color:"#475569"};

  if(loading) return <div style={{padding:"40px", textAlign:"center", color:"#64748B"}}>Loading payments from backend...</div>;

  return (
    <>
    <style>{`
      .pay-wrap{ width:100%; max-width:100%; overflow:hidden; }
      .pay-stat{ background:#fff; border:1.5px solid #0A192F; border-radius:16px; padding:16px; height:100%; }
      .pay-toolbar{ background:#fff; border:1.5px solid #E2E8F0; border-radius:16px; padding:14px; display:flex; gap:10px; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom:14px; }
      .pay-search{ position:relative; flex:1; min-width:220px; max-width:340px; } .pay-search input{ width:100%; height:46px; border:1.5px solid #E2E8F0; border-radius:12px; padding:0 14px 0 42px; font-size:15px; font-weight:600; background:#F8FAFC; outline:none; } .pay-search i{ position:absolute; left:14px; top:50%; transform:translateY(-50%); color:#6B7A90; }
      .pay-table-wrap{ background:#fff; border:1.5px solid #E2E8F0; border-radius:16px; overflow:hidden; width:100%; }
      .pay-table{ width:100%; border-collapse:collapse; table-layout:fixed; } .pay-table th{ text-align:left; font-size:11px; font-weight:900; color:#6B7A90; padding:14px 10px; border-bottom:1.5px solid #E2E8F0; background:#F8FAFC; text-transform:uppercase; }
      .pay-table th:nth-child(1){ width:16%; } .pay-table th:nth-child(2){ width:28%; } .pay-table th:nth-child(3){ width:22%; } .pay-table th:nth-child(4){ width:12%; } .pay-table th:nth-child(5){ width:10%; } .pay-table th:nth-child(6){ width:12%; }
      .pay-table td{ padding:12px 10px; font-size:13px; font-weight:600; color:#0A192F; border-bottom:1px solid #E2E8F0; vertical-align:middle; }
      .pay-mobile{ display:none; } @media(max-width: 768px){ .pay-table-wrap.desktop{ display:none; } .pay-mobile{ display:grid; gap:12px; } .pay-toolbar{ flex-direction:column; align-items:stretch; } .pay-search{ max-width:100%; } }
      .pay-modal-backdrop{ position:fixed; inset:0; background:rgba(10,25,47,0.55); backdrop-filter:blur(6px); z-index:99; display:grid; place-items:center; padding:16px; } .pay-modal{ width:100%; max-width:600px; max-height:92vh; overflow:auto; background:#fff; border:2px solid #0A192F; border-radius:22px; box-shadow:0 30px 80px rgba(0,0,0,0.25); }
      .bk-input,.bk-select{ height:46px; border-radius:12px; border:1.5px solid #E2E8F0; background:#F8FAFC; font-weight:600; font-size:14px; padding:0 14px; width:100%; }
    `}</style>

    <div className="pay-wrap">
      <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', marginBottom:'16px'}}>
        <div><h2 style={{fontWeight:900, fontSize:'28px', color:'#0A192F', margin:'0 0 6px'}}>Payments • Revenue Book</h2><p style={{color:'#6B7A90', fontSize:'15px', margin:0, fontWeight:500}}>All service payments • BAR ARD 284719 • USD • PST • Ayinde Tech</p></div>
        <div style={{display:'flex', gap:'8px', alignSelf:'flex-start'}}><button onClick={fetchPayments} style={{height:'46px', borderRadius:'12px', background:'#fff', border:'1.5px solid #E2E8F0', fontWeight:800, fontSize:'13px', padding:'0 14px'}}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button><button onClick={()=>setShowAdd(true)} style={{height:'46px', borderRadius:'12px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, fontSize:'13px', padding:'0 18px'}}><i className="bi bi-plus-lg me-1"></i> Log Payment</button></div>
      </div>

      {error && <div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", color:"#991B1B", padding:"12px 14px", borderRadius:"12px", marginBottom:"12px", fontSize:"13px", fontWeight:700}}>{error}</div>}

      <div className="row g-3 mb-3" style={{margin:0, width:'100%'}}>
        <div className="col-6 col-lg-3"><div className="pay-stat"><div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90'}}>TOTAL REVENUE • PAID</div><div style={{fontWeight:900, fontSize:'26px', marginTop:'6px', color:'#166534'}}>${stats.revenue}</div><div style={{fontSize:'11px', color:'#22C55E', fontWeight:700}}>{stats.count} paid invoices • LA</div></div></div>
        <div className="col-6 col-lg-3"><div className="pay-stat"><div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90'}}>PENDING • AWAITING</div><div style={{fontWeight:900, fontSize:'26px', marginTop:'6px', color:'#92400E'}}>${stats.pending}</div><div style={{fontSize:'11px', color:'#F59E0B', fontWeight:700}}>Needs collection</div></div></div>
        <div className="col-6 col-lg-3"><div className="pay-stat"><div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90'}}>AVG TICKET</div><div style={{fontWeight:900, fontSize:'26px', marginTop:'6px'}}>${stats.avg}</div><div style={{fontSize:'11px', color:'#6B7A90'}}>Per service • CA</div></div></div>
        <div className="col-6 col-lg-3"><div className="pay-stat" style={{background:'#0A192F', borderColor:'#0A192F'}}><div style={{fontSize:'11px', fontWeight:800, color:'#94A3B8'}}>FILTERED RESULT</div><div style={{fontWeight:900, fontSize:'26px', marginTop:'6px', color:'#fff'}}>{filtered.length}</div><div style={{fontSize:'11px', color:'#22C55E'}}>{filtered.reduce((s,p)=>s+p.amount,0)} USD shown</div></div></div>
      </div>

      <div className="pay-toolbar">
        <div className="pay-search"><i className="bi bi-search"></i><input placeholder="Search pay ID, customer, booking, service..." value={search} onChange={e=>{setSearch(e.target.value); setPage(0);}} /></div>
        <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
          <select value={method} onChange={e=>{setMethod(e.target.value); setPage(0);}} style={{height:'46px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:800, fontSize:'12px', padding:'0 10px'}}><option value="All">All Methods</option><option>Card</option><option>Cash</option><option>Zelle</option><option>Transfer</option></select>
          <select value={status} onChange={e=>{setStatus(e.target.value); setPage(0);}} style={{height:'46px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:800, fontSize:'12px', padding:'0 10px'}}><option value="All">All Status</option><option>Paid</option><option>Pending</option><option>Refunded</option></select>
          <select value={dateF} onChange={e=>{setDateF(e.target.value); setPage(0);}} style={{height:'46px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:800, fontSize:'12px', padding:'0 10px'}}><option value="All">All Dates</option><option value="Today">Today</option><option value="This Week">This Week</option></select>
        </div>
      </div>

      <div className="pay-table-wrap desktop">
        <table className="pay-table">
          <thead><tr><th>Pay ID • Date • PST</th><th>Customer • Car • Booking</th><th>Service • Amount • USD</th><th>Method</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {paged.length===0 ? <tr><td colSpan={6} style={{textAlign:'center', padding:'32px', color:'#6B7A90'}}>{payments.length===0 ? "No payments yet. Log a payment or mark a booking as Paid." : "No payments found"}</td></tr> :
            paged.map(p=>{
              const sc=statusColor(p.status); const mc=methodColor(p.method);
              return (
                <tr key={p.id}>
                  <td><b>{p.id}</b><div style={{fontSize:'11px', color:'#6B7A90'}}>{p.date} • {p.time}</div><div style={{fontSize:'10px', color:'#6B7A90'}}>{p.bar}</div></td>
                  <td><div style={{fontWeight:800, fontSize:'12px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{p.customer}</div><div style={{fontSize:'11px', color:'#6B7A90', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{p.car} • {p.booking}</div></td>
                  <td><div style={{fontSize:'12px', fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{p.service}</div><div style={{fontSize:'13px', fontWeight:900, color:'#166534'}}>${p.amount}</div></td>
                  <td><span style={{fontSize:'10px', fontWeight:800, padding:'4px 8px', borderRadius:'20px', background:mc.bg, color:mc.color}}>{p.method.toUpperCase()}</span></td>
                  <td><span style={{fontSize:'10px', fontWeight:800, padding:'4px 8px', borderRadius:'20px', background:sc.bg, color:sc.color}}>{p.status.toUpperCase()}</span></td>
                  <td><button onClick={()=>setSelected(p)} style={{height:'34px', borderRadius:'8px', border:'1.5px solid #0A192F', background:'#0A192F', color:'#fff', fontWeight:800, fontSize:'11px', padding:'0 10px', cursor:'pointer'}}>Receipt</button></td>
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

      <div className="pay-mobile">
        {paged.map(p=>{
          const sc=statusColor(p.status);
          return (
            <div key={p.id} style={{background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:'16px', padding:'16px'}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'6px'}}><b style={{fontSize:'13px'}}>{p.id} • {p.date}</b><span style={{fontSize:'10px', fontWeight:800, padding:'4px 8px', borderRadius:'20px', background:sc.bg, color:sc.color}}>{p.status}</span></div>
              <div style={{fontSize:'13px', fontWeight:800}}>{p.customer} • {p.service}</div>
              <div style={{fontSize:'12px', color:'#166534', fontWeight:900}}>${p.amount} • {p.method} • {p.booking}</div>
              <div style={{fontSize:'11px', color:'#6B7A90', marginBottom:'10px'}}>{p.car}</div>
              <button onClick={()=>setSelected(p)} style={{width:'100%', height:'44px', borderRadius:'10px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, fontSize:'13px'}}>View Receipt</button>
            </div>
          );
        })}
        {paged.length===0 && <div style={{padding:"24px", textAlign:"center", color:"#6B7A90"}}>No payments found</div>}
      </div>
    </div>

    {selected && (
      <div className="pay-modal-backdrop" onClick={()=>setSelected(null)}>
        <div className="pay-modal" onClick={e=>e.stopPropagation()}>
          <div style={{padding:'16px', borderBottom:'1.5px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#F8FAFC', position:'sticky', top:0, zIndex:2}}>
            <div><div style={{fontWeight:900, fontSize:'15px'}}>{selected.id} • {selected.customer} • Receipt</div><div style={{fontSize:'11px', color:'#6B7A90'}}>{selected.date} • {selected.time} • {selected.bar} • Inglewood, CA • AutoVille</div></div>
            <button onClick={()=>setSelected(null)} style={{width:'36px', height:'36px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff'}}><i className="bi bi-x-lg"></i></button>
          </div>
          <div style={{padding:'16px', display:'grid', gap:'14px'}}>
            <div style={{border:'1.5px solid #0A192F', borderRadius:'14px', padding:'14px'}}>
              <div style={{display:'flex', justifyContent:'space-between'}}><div style={{fontSize:'12px', color:'#6B7A90', fontWeight:800}}>{workshopName.toUpperCase()} • BAR VERIFIED</div><div style={{fontSize:'11px', fontWeight:800, padding:'4px 8px', borderRadius:'20px', background:statusColor(selected.status).bg, color:statusColor(selected.status).color}}>{selected.status.toUpperCase()}</div></div>
              <div style={{marginTop:'10px', fontSize:'13px', lineHeight:1.6}}><b>Customer:</b> {selected.customer}<br/><b>Car:</b> {selected.car}<br/><b>Booking:</b> {selected.booking} • <b>Service:</b> {selected.service}<br/><b>Pay ID:</b> {selected.id} • <b>Method:</b> {selected.method} • <b>PST:</b> {selected.date} {selected.time}</div>
              <div style={{borderTop:'1px dashed #E2E8F0', margin:'12px 0'}}></div>
              <div style={{display:'grid', gap:'6px', fontSize:'13px'}}><div style={{display:'flex', justifyContent:'space-between'}}><span>Service Amount</span><span style={{fontWeight:800}}>${selected.amount}</span></div><div style={{display:'flex', justifyContent:'space-between', color:'#6B7A90'}}><span>Tax</span><span>${selected.tax}</span></div><div style={{display:'flex', justifyContent:'space-between', color:'#6B7A90'}}><span>Discount</span><span>-${selected.discount}</span></div><div style={{display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:'15px', borderTop:'1.5px solid #0A192F', paddingTop:'8px', marginTop:'4px'}}><span>Total Paid</span><span style={{color:'#166534'}}>${(selected.amount + selected.tax - selected.discount).toFixed(2)}</span></div></div>
            </div>
            <div style={{fontSize:'11px', color:'#6B7A90', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'12px', padding:'10px'}}>Ayinde Technologies • 112 S Market St, Ste 1008, Inglewood, CA 90301 • Support Peter +1-201-534-2657 • support@ayindetechnologies.com • Receipt generated by AutoVille Bookkeeping</div>
            <div><div style={{fontSize:'11px', fontWeight:800, color:'#6B7A90', marginBottom:'6px'}}>UPDATE STATUS • BAR COMPLIANT</div><div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>{["Paid","Pending","Refunded"].map(s=>(<button key={s} onClick={()=>updateStatus(selected.id, s)} style={{height:'38px', borderRadius:'20px', padding:'0 14px', fontWeight:800, fontSize:'12px', border:`1.5px solid ${selected.status===s ? '#0A192F' : '#E2E8F0'}`, background: selected.status===s ? '#0A192F' : '#fff', color: selected.status===s ? '#fff' : '#0A192F', cursor:'pointer'}}>{s}</button>))}</div></div>
            <div style={{display:'flex', gap:'10px'}}><button onClick={()=>{ window.print(); }} style={{flex:1, height:'46px', borderRadius:'12px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, fontSize:'13px'}}><i className="bi bi-printer me-1"></i> Print Receipt</button><button onClick={()=>setSelected(null)} style={{flex:1, height:'46px', borderRadius:'12px', background:'#fff', border:'1.5px solid #E2E8F0', fontWeight:800, fontSize:'13px'}}>Close</button></div>
          </div>
        </div>
      </div>
    )}

    {showAdd && (
      <div className="pay-modal-backdrop" onClick={()=>setShowAdd(false)}>
        <div className="pay-modal" style={{maxWidth:'520px'}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:'16px', background:'#F8FAFC', borderBottom:'1.5px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center'}}><div style={{fontWeight:900}}><i className="bi bi-cash-coin me-2" style={{color:'#22C55E'}}></i>Log Service Payment • Revenue</div><button onClick={()=>setShowAdd(false)} style={{width:'36px', height:'36px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff'}}><i className="bi bi-x-lg"></i></button></div>
          <div style={{padding:'16px', display:'grid', gap:'12px'}}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
              {bookingsList.length ? (
                <select className="bk-select" value={form.booking} onChange={e=>handleBookingSelect(e.target.value)}><option value="">Select Booking</option>{bookingsList.map(b=> <option key={b.id} value={`#AV-${b.id}`}>#AV-{b.id} • {b.owner_name || b.customer_name || ""} • {b.service_type || ""}</option>)}</select>
              ) : (
                <input className="bk-input" placeholder="Booking #AV-1024" value={form.booking} onChange={e=>setForm({...form, booking:e.target.value})} />
              )}
              <input type="date" className="bk-input" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} />
            </div>
            <input className="bk-input" placeholder="Customer James L." value={form.customer} onChange={e=>setForm({...form, customer:e.target.value})} />
            <input className="bk-input" placeholder="Car Toyota Camry 2019" value={form.car} onChange={e=>setForm({...form, car:e.target.value})} />
            <input className="bk-input" placeholder="Service Brake Pad + Rotor" value={form.service} onChange={e=>setForm({...form, service:e.target.value})} />
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}><input type="number" className="bk-input" placeholder="Amount 480" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} /><select className="bk-select" value={form.method} onChange={e=>setForm({...form, method:e.target.value})}><option>Card</option><option>Cash</option><option>Zelle</option><option>Transfer</option></select></div>
            <select className="bk-select" value={form.status} onChange={e=>setForm({...form, status:e.target.value})}><option>Paid</option><option>Pending</option><option>Refunded</option></select>
            <button onClick={addPayment} disabled={saving} style={{height:'48px', borderRadius:'12px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, opacity: saving?0.6:1}}>{saving ? "Saving..." : "Add to Revenue • P/L Update"}</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}