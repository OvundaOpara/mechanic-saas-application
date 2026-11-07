import { useState, useMemo } from "react";

export default function OwnerInvoicesPage({ C, isDark }) {
  const invoices = [
    { id:"INV-1024", date:"2025-11-02", due:"2025-11-09", shop:"Elite Auto Garage", shopAddr:"112 S Market St, Inglewood, CA 90301 • BAR #ARD284719", car:"【entity-Toyota¦canonical_name=Toyota】 Camry 2019 • ABC-123 CA", amount:478, status:"Pending", method:"Card on file", items:[{name:"Front brake pads - 【entity-Toyota¦canonical_name=Toyota】 Genuine (NAPA)", qty:1, price:145},{name:"Brake rotors - front pair OEM", qty:1, price:220},{name:"Labor - Brake replacement 1.2h", qty:1, price:95},{name:"CA Tax + Env fee", qty:1, price:18}] },
    { id:"INV-1021", date:"2025-10-18", due:"2025-10-18", shop:"LA Auto Pros", shopAddr:"3400 W 6th St, Los Angeles, CA 90020", car:"【entity-Honda¦canonical_name=Honda】 Civic 2020 • XYZ-789 CA", amount:130, status:"Paid", method:"Visa •• 4242", items:[{name:"AC Gas R134a refill", qty:1, price:60},{name:"Cabin filter", qty:1, price:25},{name:"Labor", qty:1, price:45}] },
    { id:"INV-1019", date:"2025-09-12", due:"2025-09-12", shop:"Culver City Auto Care", shopAddr:"11124 Washington Blvd, Culver City, CA 90232", car:"【entity-Toyota¦canonical_name=Toyota】 Camry 2019 • ABC-123 CA", amount:45, status:"Paid", method:"Apple Pay", items:[{name:"0W-20 Full Synthetic 5qt", qty:1, price:28},{name:"Oil filter - 【entity-Toyota¦canonical_name=Toyota】", qty:1, price:8},{name:"Labor", qty:1, price:9}] },
    { id:"INV-1015", date:"2025-08-03", due:"2025-08-10", shop:"Beverly Hills Performance", shopAddr:"9225 W Olympic Blvd, Beverly Hills, CA 90232", car:"【entity-BMW¦canonical_name=BMW】 X5 2021 • LA-90210 CA", amount:60, status:"Paid", method:"Mastercard •• 8888", items:[{name:"Rotation + Balancing 4 wheels", qty:1, price:60}] },
    { id:"INV-1010", date:"2025-07-15", due:"2025-07-15", shop:"Elite Auto Garage", shopAddr:"112 S Market St, Inglewood, CA", car:"【entity-Toyota¦canonical_name=Toyota】 Camry 2019 • ABC-123 CA", amount:85, status:"Paid", method:"Visa •• 4242", items:[{name:"OBD-II Full Scan + Live Data", qty:1, price:85}] },
    { id:"INV-1008", date:"2025-06-20", due:"2025-06-27", shop:"Santa Monica Auto", shopAddr:"1500 Santa Monica Blvd, Santa Monica, CA", car:"【entity-Honda¦canonical_name=Honda】 Civic 2020 • XYZ-789 CA", amount:180, status:"Overdue", method:"Unpaid", items:[{name:"Interstate Battery 12V 550CCA", qty:1, price:145},{name:"Labor + Terminal cleaning", qty:1, price:35}] },
    { id:"INV-1002", date:"2025-05-08", due:"2025-05-08", shop:"Beverly Hills Performance", shopAddr:"9225 W Olympic Blvd, Beverly Hills, CA", car:"【entity-BMW¦canonical_name=BMW】 X5 2021 • LA-90210 CA", amount:320, status:"Paid", method:"【entity-Amex¦canonical_name=Amex】 •• 1005", items:[{name:"Radiator fan assembly", qty:1, price:180},{name:"Coolant flush", qty:1, price:40},{name:"Labor 2.5h", qty:1, price:100}] },
  ];

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);
  const perPage = 5;
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(()=>{
    let d = [...invoices];
    if(search){ const s=search.toLowerCase(); d=d.filter(i=> `${i.id} ${i.shop} ${i.car}`.toLowerCase().includes(s)); }
    if(status!=="All") d=d.filter(i=> i.status===status);
    if(fromDate) d=d.filter(i=> new Date(i.date) >= new Date(fromDate));
    if(toDate) d=d.filter(i=> new Date(i.date) <= new Date(toDate));
    if(sort==="newest") d.sort((a,b)=> new Date(b.date)-new Date(a.date));
    if(sort==="oldest") d.sort((a,b)=> new Date(a.date)-new Date(b.date));
    if(sort==="high") d.sort((a,b)=> b.amount-a.amount);
    if(sort==="low") d.sort((a,b)=> a.amount-b.amount);
    return d;
  }, [search, status, fromDate, toDate, sort]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice(page*perPage, page*perPage+perPage);

  const totalBilled = invoices.reduce((s,i)=>s+i.amount,0);
  const totalPaid = invoices.filter(i=>i.status==="Paid").reduce((s,i)=>s+i.amount,0);
  const totalPending = invoices.filter(i=>i.status==="Pending").reduce((s,i)=>s+i.amount,0);
  const totalOverdue = invoices.filter(i=>i.status==="Overdue").reduce((s,i)=>s+i.amount,0);

  const cardBg = C?.card || "#fff";
  const cardBorder = C?.cardBorder || "#E2E8F0";
  const text = C?.text || "#0A192F";
  const muted = C?.muted || "#6B7A90";
  const soft = C?.soft || "#F8FAFC";

  return (
    <>
      <style>{`
        *{ box-sizing:border-box; }
        .inv-wrap{ width:100%; max-width:100%; overflow:hidden; }
        .inv-stat{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:18px; padding:18px; height:100%; }
        .inv-stat .label{ font-size:12px; font-weight:800; color:${muted}; letter-spacing:0.06em; text-transform:uppercase; }
        .inv-stat .value{ font-weight:900; font-size:26px; color:${text}; margin-top:6px; }
        .inv-toolbar{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:18px; padding:14px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .inv-search{ position:relative; flex:1; min-width:220px; max-width:360px; }
        .inv-search input{ width:100%; height:46px; border:1.5px solid ${cardBorder}; border-radius:12px; padding:0 14px 0 42px; font-size:15px; font-weight:600; background:${soft}; color:${text}; outline:none; }
        .inv-search i{ position:absolute; left:14px; top:50%; transform:translateY(-50%); color:${muted}; font-size:16px; }
        .inv-filters{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
        .inv-filters input, .inv-filters select{ height:46px; border:1.5px solid ${cardBorder}; border-radius:12px; padding:0 12px; font-size:13px; font-weight:700; background:${soft}; color:${text}; }
        .inv-table-wrap{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:18px; overflow:hidden; width:100%; }
        .inv-table{ width:100%; border-collapse:collapse; table-layout:fixed; }
        .inv-table th{ text-align:left; font-size:12px; font-weight:900; color:${muted}; padding:14px 12px; border-bottom:1.5px solid ${cardBorder}; background:${soft}; text-transform:uppercase; }
        .inv-table th:nth-child(1){ width:18%; } .inv-table th:nth-child(2){ width:28%; } .inv-table th:nth-child(3){ width:22%; } .inv-table th:nth-child(4){ width:18%; } .inv-table th:nth-child(5){ width:14%; }
        .inv-table td{ padding:14px 12px; font-size:14px; font-weight:600; color:${text}; border-bottom:1px solid ${cardBorder}; vertical-align:middle; }
        .inv-table tr:last-child td{ border-bottom:none; }
        .inv-table tr:hover td{ background:${soft}; }
        .badge{ font-size:11px; font-weight:800; padding:5px 10px; border-radius:20px; letter-spacing:0.05em; }
        .badge.paid{ background:#DCFCE7; color:#166534; } .badge.pending{ background:#FEF3C7; color:#92400E; } .badge.overdue{ background:#FEE2E2; color:#991B1B; }
        .btn-view{ height:38px; border-radius:11px; border:1.5px solid ${text}; background:${text}; color:#fff; font-weight:800; font-size:13px; padding:0 14px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; white-space:nowrap; }
        .btn-view.outline{ background:${cardBg}; color:${text}; }
        .inv-mobile{ display:none; }
        @media(max-width: 992px){
          .inv-table th:nth-child(2){ width:32%; } .inv-table th:nth-child(3){ display:none; } .inv-table td:nth-child(3){ display:none; }
        }
        @media(max-width: 768px){
          .inv-table-wrap.desktop{ display:none; }
          .inv-mobile{ display:grid; gap:12px; }
          .inv-mcard{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:16px; padding:16px; }
          .inv-toolbar{ flex-direction:column; align-items:stretch; }
          .inv-search{ max-width:100%; }
        }
        .inv-modal-backdrop{ position:fixed; inset:0; background:rgba(10,25,47,0.55); backdrop-filter:blur(6px); z-index:99; display:grid; place-items:center; padding:16px; }
        .inv-modal{ width:100%; max-width:760px; max-height:92vh; overflow:auto; background:${cardBg}; border:2px solid ${text}; border-radius:22px; box-shadow:0 30px 80px rgba(0,0,0,0.25); }
      `}</style>

      <div className="inv-wrap">
        <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', marginBottom:'16px'}}>
          <div>
            <h2 style={{fontWeight:900, fontSize:'30px', color:text, margin:'0 0 6px', letterSpacing:'-0.03em'}}>Invoices • Los Angeles, CA</h2>
            <p style={{color:muted, fontSize:'15px', margin:0, fontWeight:500}}>All BAR-verified shop invoices • Download PDF • Pay online</p>
          </div>
          <button style={{height:'44px', borderRadius:'12px', border:`1.5px solid ${cardBorder}`, background:cardBg, fontWeight:800, fontSize:'13px', padding:'0 16px', color:text}}><i className="bi bi-download me-1"></i> Export CSV</button>
        </div>

        <div className="row g-3 mb-3" style={{margin:0, width:'100%'}}>
          <div className="col-6 col-lg-3"><div className="inv-stat"><div className="label">Total Billed</div><div className="value">${totalBilled}</div><div style={{fontSize:'12px', color:muted, marginTop:'4px', fontWeight:600}}>{invoices.length} invoices • 6 months</div></div></div>
          <div className="col-6 col-lg-3"><div className="inv-stat"><div className="label">Paid</div><div className="value" style={{color:'#166534'}}>${totalPaid}</div><div style={{fontSize:'12px', color:'#22C55E', fontWeight:700}}>✔ {invoices.filter(i=>i.status==="Paid").length} paid</div></div></div>
          <div className="col-6 col-lg-3"><div className="inv-stat"><div className="label">Pending</div><div className="value" style={{color:'#92400E'}}>${totalPending}</div><div style={{fontSize:'12px', color:muted, fontWeight:600}}>Due in 7 days</div></div></div>
          <div className="col-6 col-lg-3"><div className="inv-stat" style={{background:'#0A192F', borderColor:'#0A192F'}}><div className="label" style={{color:'#94A3B8'}}>Overdue</div><div className="value" style={{color:'#fff'}}>${totalOverdue}</div><div style={{fontSize:'12px', color:'#FCA5A5', fontWeight:700}}>1 invoice • Action needed</div></div></div>
        </div>

        <div className="inv-toolbar">
          <div className="inv-search"><i className="bi bi-search"></i><input placeholder="Search invoice, shop, car..." value={search} onChange={e=>{setSearch(e.target.value); setPage(0);}} /></div>
          <div className="inv-filters">
            <select value={status} onChange={e=>{setStatus(e.target.value); setPage(0);}}>
              <option value="All">All Status</option><option value="Paid">Paid</option><option value="Pending">Pending</option><option value="Overdue">Overdue</option>
            </select>
            <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} />
            <span style={{fontWeight:800, fontSize:'12px', color:muted}}>TO</span>
            <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} />
            <select value={sort} onChange={e=>setSort(e.target.value)}>
              <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="high">Amount High</option><option value="low">Amount Low</option>
            </select>
            {(search||status!=="All"||fromDate||toDate) && <button onClick={()=>{setSearch(""); setStatus("All"); setFromDate(""); setToDate("");}} style={{height:'46px', borderRadius:'12px', border:`1.5px solid ${cardBorder}`, background:cardBg, fontWeight:800, fontSize:'12px', padding:'0 14px', cursor:'pointer', color:text}}>Clear</button>}
          </div>
        </div>

        <div className="inv-table-wrap desktop">
          <table className="inv-table">
            <thead><tr><th>Invoice</th><th>Date • Shop • Inglewood / LA</th><th>Car</th><th>Amount / Status</th><th>Action</th></tr></thead>
            <tbody>
              {paged.length===0 ? <tr><td colSpan={5} style={{textAlign:'center', padding:'32px', color:muted, fontSize:'15px'}}>No invoices found</td></tr> :
              paged.map(inv=>(
                <tr key={inv.id}>
                  <td><b style={{fontSize:'14px'}}>{inv.id}</b><div style={{fontSize:'11px', color:muted, fontWeight:700}}>Due {inv.due}</div></td>
                  <td><div style={{fontWeight:800, fontSize:'14px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{inv.shop}</div><div style={{fontSize:'12px', color:muted}}>{inv.date} • {inv.shopAddr.split("•")[0]}</div></td>
                  <td style={{fontSize:'13px'}}>{inv.car}</td>
                  <td><div style={{fontWeight:900, fontSize:'15px'}}>${inv.amount}</div><span className={`badge ${inv.status.toLowerCase()}`}>{inv.status.toUpperCase()}</span></td>
                  <td><button className="btn-view" onClick={()=>setSelected(inv)}><i className="bi bi-eye"></i> View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', borderTop:`1.5px solid ${cardBorder}`, background:soft, flexWrap:'wrap', gap:'8px'}}>
            <div style={{fontSize:'13px', fontWeight:700, color:muted}}>{page*perPage+1}–{Math.min((page+1)*perPage, filtered.length)} of {filtered.length} • Page {page+1}/{totalPages||1}</div>
            <div style={{display:'flex', gap:'8px'}}>
              <button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))} style={{height:'38px', borderRadius:'10px', border:`1.5px solid ${cardBorder}`, background:cardBg, fontWeight:800, fontSize:'13px', padding:'0 14px', cursor:'pointer', color:text}}>Prev</button>
              <button disabled={page>=totalPages-1} onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} style={{height:'38px', borderRadius:'10px', border:`1.5px solid ${cardBorder}`, background:cardBg, fontWeight:800, fontSize:'13px', padding:'0 14px', cursor:'pointer', color:text}}>Next</button>
            </div>
          </div>
        </div>

        <div className="inv-mobile">
          {paged.map(inv=>(
            <div key={inv.id} className="inv-mcard">
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                <b style={{fontSize:'15px', color:text}}>{inv.id} • {inv.date}</b>
                <span className={`badge ${inv.status.toLowerCase()}`}>{inv.status}</span>
              </div>
              <div style={{fontSize:'14px', fontWeight:800, color:text}}>{inv.shop}</div>
              <div style={{fontSize:'12px', color:muted, marginBottom:'8px'}}>{inv.car}</div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <b style={{fontSize:'18px', color:text}}>${inv.amount}</b>
                <button className="btn-view" onClick={()=>setSelected(inv)}><i className="bi bi-receipt"></i> View Invoice</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="inv-modal-backdrop" onClick={()=>setSelected(null)}>
          <div className="inv-modal" onClick={e=>e.stopPropagation()}>
            <div style={{padding:'20px', borderBottom:`1.5px solid ${cardBorder}`, display:'flex', justifyContent:'space-between', alignItems:'center', background:soft, position:'sticky', top:0, zIndex:2}}>
              <div>
                <div style={{fontWeight:900, fontSize:'18px', color:text}}>{selected.id} • {selected.shop}</div>
                <div style={{fontSize:'13px', color:muted, fontWeight:600, marginTop:'2px'}}>{selected.date} • Due {selected.due} • {selected.car}</div>
              </div>
              <button onClick={()=>setSelected(null)} style={{width:'40px', height:'40px', borderRadius:'10px', border:`1.5px solid ${cardBorder}`, background:cardBg, cursor:'pointer'}}><i className="bi bi-x-lg"></i></button>
            </div>

            <div style={{padding:'20px', display:'grid', gap:'16px'}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                <div style={{background:soft, border:`1px solid ${cardBorder}`, borderRadius:'12px', padding:'12px'}}>
                  <div style={{fontSize:'11px', fontWeight:900, color:muted}}>BILLED TO • Ayinde Technologies Client</div>
                  <div style={{fontSize:'14px', fontWeight:800, color:text, marginTop:'6px'}}>Vehicle Owner • Los Angeles, CA</div>
                  <div style={{fontSize:'12px', color:muted, marginTop:'4px'}}>support@ayindetechnologies.com • (201) 534-2657</div>
                </div>
                <div style={{background:soft, border:`1px solid ${cardBorder}`, borderRadius:'12px', padding:'12px'}}>
                  <div style={{fontSize:'11px', fontWeight:900, color:muted}}>SHOP • BAR VERIFIED</div>
                  <div style={{fontSize:'14px', fontWeight:800, color:text, marginTop:'6px'}}>{selected.shop}</div>
                  <div style={{fontSize:'12px', color:muted, marginTop:'2px'}}>{selected.shopAddr}</div>
                </div>
              </div>

              <div style={{background:cardBg, border:`1.5px solid ${cardBorder}`, borderRadius:'14px', overflow:'hidden'}}>
                {selected.items.map((it,i)=>(
                  <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'12px 14px', borderBottom:`1px solid ${cardBorder}`, fontSize:'14px', fontWeight:600}}>
                    <span>{it.name} <small style={{color:muted, fontWeight:700}}>x{it.qty}</small></span><b>${it.price}</b>
                  </div>
                ))}
                <div style={{display:'flex', justifyContent:'space-between', padding:'14px', fontWeight:900, fontSize:'16px', background:soft}}><span>Total • USD</span><b>${selected.amount}</b></div>
              </div>

              <div style={{display:'flex', gap:'10px', alignItems:'center', background: selected.status==="Paid" ? '#DCFCE7' : selected.status==="Pending" ? '#FEF3C7' : '#FEE2E2', border:`1px solid ${selected.status==="Paid" ? '#86EFAC' : selected.status==="Pending" ? '#FDE68A' : '#FCA5A5'}`, borderRadius:'12px', padding:'12px 14px'}}>
                <span className={`badge ${selected.status.toLowerCase()}`} style={{fontSize:'12px'}}>{selected.status.toUpperCase()}</span>
                <span style={{fontSize:'13px', fontWeight:700, color:text}}>{selected.status==="Paid" ? `Paid via ${selected.method} • ${selected.date}` : selected.status==="Pending" ? `Due ${selected.due} • ${selected.method} • Pay online or at shop • Inglewood, CA` : `Overdue since ${selected.due} • Please pay now to avoid late fee`}</span>
              </div>

              <div style={{display:'flex', gap:'10px'}}>
                {selected.status!=="Paid" && <button style={{flex:1, height:'48px', borderRadius:'12px', border:`1.5px solid ${text}`, background:text, color:'#fff', fontWeight:800, fontSize:'14px'}}><i className="bi bi-credit-card me-1"></i> Pay ${selected.amount} Now</button>}
                <button style={{flex:1, height:'48px', borderRadius:'12px', border:`1.5px solid ${cardBorder}`, background:cardBg, color:text, fontWeight:800, fontSize:'14px'}}><i className="bi bi-download me-1"></i> Download PDF</button>
                <button style={{height:'48px', borderRadius:'12px', border:`1.5px solid ${cardBorder}`, background:cardBg, color:text, fontWeight:800, fontSize:'14px', padding:'0 18px'}} onClick={()=>setSelected(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}