import { useState, useMemo } from "react";

export default function MechanicHelpPage() {
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState(0);

  const ops = [
    { id:"bookings", title:"Bookings", icon:"bi-calendar-check", badge:"New", desc:"New owner requests from Inglewood, LA. Accept in 15 mins = 95% response score.", tips:["Accept <15 mins = +10 rank","WhatsApp = 2x close","Home Service = +40% leads"] },
    { id:"jobs", title:"Jobs", icon:"bi-tools", badge:"Live", desc:"Update Diagnosing → Waiting Parts → In Progress → Ready. Owner tracks live.", tips:["Set Waiting Parts on delay","Mark Done after test drive + photos"] },
    { id:"payments", title:"Payments", icon:"bi-credit-card", badge:"$ USD", desc:"Log income. Feeds Bookkeeping P/L. BAR requires full record.", tips:["Log cash same day","Method: Cash/Zelle/Card + Job ID"] },
    { id:"expenses", title:"Expenses", icon:"bi-receipt", badge:"Immutable", desc:"Cannot be deleted. For BAR audit. If mistake, log adjustment in Payments.", tips:["Keep receipts 7 yrs","Parts/Labor/Rent/Utilities"] },
    { id:"bookkeeping", title:"Bookkeeping", icon:"bi-journal-text", badge:"Lazy", desc:"Auto merges Payments+Expenses. P/L = Revenue-Expenses. Lazy 10 per scroll.", tips:["Scroll = lazy load","Filter monthly for CPA"] },
    { id:"customers", title:"Customers", icon:"bi-people", badge:"CRM", desc:"History, total spent, cars, last visit. Call back 7 days.", tips:["Oil change reminder","Recall past cars"] },
    { id:"reviews", title:"Reviews", icon:"bi-star", badge:"Read-Only", desc:"Read-only, lazy 4 per scroll. Below 3.8 = paused per BAR.", tips:["Ask at pickup for review","4.8+ = homepage top"] },
    { id:"team", title:"Team & Specialty", icon:"bi-people-fill", badge:"NEW", desc:"Add techs + specialties. Auto-routes jobs to right tech.", tips:["Add ASE certs","【entity-Toyota¦canonical_name=Toyota】 specialist gets 【entity-Toyota¦canonical_name=Toyota】 first"] },
  ];

  const filtered = useMemo(()=> !search ? ops : ops.filter(o=> (o.title+o.desc+o.tips.join(" ")).toLowerCase().includes(search.toLowerCase())), [search, ops]);

  return (
    <div style={{display:"grid", gap:"14px"}}>
      <div style={{background:"#0A192F", borderRadius:"18px", padding:"20px", color:"#fff", display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:"12px"}}>
        <div><div style={{fontWeight:900, fontSize:"26px"}}>Help Center • How AutoVille Works • BAR Compliant</div><div style={{color:"#94A3B8", fontSize:"14px", marginTop:"4px"}}>112 S Market St, Ste 1008, Inglewood, CA 90301 • PST • $ USD • Zero commission • 62% verification pass • 24-48h first lead</div></div>
        <div style={{position:"relative"}}><i className="bi bi-search" style={{position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", color:"#64748B"}}></i><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search bookings, BAR, P/L, team..." style={{height:"44px", width:"280px", borderRadius:"12px", border:"1.5px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.08)", color:"#fff", padding:"0 14px 0 38px", fontWeight:600}} /></div>
      </div>

      <div className="row g-3" style={{margin:0, width:"100%"}}>
        {[
          {n:"01", t:"Create & Verify", d:"CAC + address + 3 jobs + BAR ARD. 30 mins. 62% pass.", c:"#0A192F"},
          {n:"02", t:"Get Discovered", d:"LA owners see verified badge first. Leads to WhatsApp.", c:"#3B82F6"},
          {n:"03", t:"Booking → Job", d:"1 tap accept. Update status. Owner tracks live.", c:"#22C55E"},
          {n:"04", t:"Log Money Right", d:"Payments=income. Expenses=immutable for audit. P/L auto.", c:"#F59E0B"},
          {n:"05", t:"5-Star & Repeat", d:"Reviews read-only. 4.8+ = top rank. Specialty auto-routes.", c:"#8B5CF6"},
        ].map(s=>(
          <div key={s.n} className="col-md-4 col-xl-2">
            <div style={{background:"#fff", border:"1.5px solid #E2E8F0", borderTop:`4px solid ${s.c}`, borderRadius:"16px", padding:"14px", height:"100%"}}>
              <div style={{fontSize:"11px", fontWeight:900, color:s.c}}>{s.n}</div><div style={{fontWeight:900, marginTop:"6px", color:"#0A192F"}}>{s.t}</div><div style={{fontSize:"12px", color:"#475569", marginTop:"6px"}}>{s.d}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px,1fr))", gap:"14px"}}>
        {filtered.map(o=>(
          <div key={o.id} style={{background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:"18px", padding:"18px"}}>
            <div style={{display:"flex", justifyContent:"space-between"}}><div style={{display:"flex", gap:"10px", alignItems:"center"}}><span style={{width:"38px", height:"38px", borderRadius:"10px", background:"#0A192F", color:"#fff", display:"grid", placeItems:"center"}}><i className={`bi ${o.icon}`}></i></span><div><div style={{fontWeight:900, color:"#0A192F"}}>{o.title}</div><div style={{fontSize:"11px", color:"#64748B"}}>{o.desc.slice(0,38)}...</div></div></div><span style={{fontSize:"10px", fontWeight:800, background:"#0A192F", color:"#fff", padding:"4px 8px", borderRadius:"20px", height:"fit-content"}}>{o.badge}</span></div>
            <div style={{fontSize:"12.5px", color:"#334155", marginTop:"10px", lineHeight:1.5}}>{o.desc}</div>
            <div style={{marginTop:"10px", display:"grid", gap:"6px"}}>{o.tips.map((t,i)=><div key={i} style={{fontSize:"12px", background:"#F8FAFC", border:"1px dashed #E2E8F0", borderRadius:"10px", padding:"8px 10px"}}><i className="bi bi-lightbulb me-1" style={{color:"#F59E0B"}}></i>{t}</div>)}</div>
          </div>
        ))}
      </div>

      <div className="row g-3" style={{margin:0}}>
        <div className="col-md-4"><div style={{background:"#0A192F", color:"#fff", borderRadius:"16px", padding:"16px"}}><div style={{fontWeight:900}}><i className="bi bi-shield-check me-1" style={{color:"#22C55E"}}></i>Immutable Expenses</div><div style={{fontSize:"12px", color:"#94A3B8", marginTop:"8px", lineHeight:1.6}}>BAR requires immutable log. Cannot delete. Log correction in Payments with note. 7-year retention per Cal Code Regs Title 16.</div></div></div>
        <div className="col-md-4"><div style={{background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:"16px", padding:"16px"}}><div style={{fontWeight:900, color:"#0A192F"}}>Payments = Revenue</div><div style={{fontSize:"12px", color:"#475569", marginTop:"8px"}}>Log every income. Cash/Zelle/Card + Job ID. Feeds P/L.</div></div></div>
        <div className="col-md-4"><div style={{background:"#F0FDF4", border:"1.5px solid #BBF7D0", borderRadius:"16px", padding:"16px"}}><div style={{fontWeight:900, color:"#166534"}}>P/L = Revenue - Expenses</div><div style={{fontSize:"12px", color:"#15803D", marginTop:"8px"}}>Bookkeeping merges both. Lazy 10 per scroll. Export CSV for CPA.</div></div></div>
      </div>

      <div style={{background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:"18px", padding:"18px"}}>
        <div style={{fontWeight:900, color:"#0A192F", fontSize:"16px"}}><i className="bi bi-question-circle me-2"></i>Workshop FAQ • LA</div>
        {[
          {q:"How fast will I get customers?", a:"Most Inglewood shops get first lead 24-48h. Quarterly = top placement = 3x clicks. Keep response <15 mins."},
          {q:"Do you take commission?", a:"Zero. Flat $40/mo, $100/qtr, $300/yr. Keep 100%. Cancel anytime per CA ARL."},
          {q:"Why expenses immutable?", a:"BAR audit rule. If error, add adjustment in Payments, don't delete."},
          {q:"Team auto-routing?", a:"Set specialty per tech. Toyota job → Toyota specialist first."},
          {q:"Reviews read-only?", a:"To prevent intimidation. Below 3.8 = paused. AutoVille moderates."},
          {q:"Days left at 0?", a:"7-day grace, then hidden. Renew keeps rank + reviews. Auto-renew ON per ARL."},
        ].map((f,i)=>(
          <div key={i} style={{border:"1.5px solid #E2E8F0", borderRadius:"12px", marginTop:"10px", overflow:"hidden"}}>
            <button onClick={()=> setOpenFaq(openFaq===i ? -1 : i)} style={{width:"100%", height:"54px", background:"transparent", border:"none", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0 14px", fontWeight:800, color:"#0A192F"}}><span>0{i+1} • {f.q}</span><i className={`bi bi-${openFaq===i ? "dash" : "plus"}-lg`}></i></button>
            {openFaq===i && <div style={{padding:"0 14px 12px", fontSize:"13px", color:"#475569"}}>{f.a}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}