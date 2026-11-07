import { useState, useMemo, useEffect, useRef } from "react";

export default function AdminReviews(){
  const [initial, setInitial] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    fetch("http://127.0.0.1:5000/api/admin/reviews?limit=200&offset=0")
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
          const dateStr = String(x.created_at || x.date || new Date().toISOString()).split("T")[0];
          const shop = x.workshop_name || "Elite Garage Inglewood";
          return {
            id: "REV-"+x.id,
            rawId: x.id,
            workshop: shop,
            workshopOwner: x.workshop_owner || " 【entity-Carlos Rivera¦canonical_name=Carlos Rivera】",
            owner: x.owner_name || "Car Owner",
            ownerEmail: x.owner_email || "",
            rating: Number(x.rating || 5),
            comment: x.comment || "",
            date: dateStr,
            bookingId: x.booking_id ? "BK-"+x.booking_id : "—",
            logo: logos[shop] || logos["Elite Garage Inglewood"],
          };
        });
        mapped.sort((a,b)=> new Date(b.date) - new Date(a.date));
        setInitial(mapped);
        setLoading(false);
      })
      .catch(()=> setLoading(false));
  },[]);

  const workshopsList = useMemo(()=>{ const s={}; initial.forEach(r=> s[r.workshop]=1); return Object.keys(s); },[initial]);

  const [q,setQ]=useState("");
  const [workshopF,setWorkshopF]=useState("All");
  const [ratingF,setRatingF]=useState("All");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [visibleCount,setVisibleCount]=useState(8);
  const [selected,setSelected]=useState(null);
  const [showDetail,setShowDetail]=useState(false);
  const loaderRef = useRef(null);

  const filtered = useMemo(()=>{
    return initial.filter(r=>{
      var matchQ = (r.workshop+" "+r.owner+" "+r.comment+" "+r.id).toLowerCase().indexOf(q.toLowerCase())>-1;
      var matchW = workshopF==="All" || r.workshop===workshopF;
      var matchR = ratingF==="All" || String(r.rating)===String(ratingF);
      var matchFrom = !dateFrom || r.date >= dateFrom;
      var matchTo = !dateTo || r.date <= dateTo;
      return matchQ && matchW && matchR && matchFrom && matchTo;
    });
  },[initial,q,workshopF,ratingF,dateFrom,dateTo]);

  const visibleRows = useMemo(()=> filtered.slice(0, visibleCount), [filtered, visibleCount]);
  useEffect(()=>{ setVisibleCount(8); },[q,workshopF,ratingF,dateFrom,dateTo]);

  useEffect(()=>{
    var obs = new IntersectionObserver((entries)=>{
      if(entries[0].isIntersecting && visibleCount < filtered.length) setVisibleCount(c=> c + 4);
    },{threshold:0.1});
    if(loaderRef.current) obs.observe(loaderRef.current);
    return ()=> obs.disconnect();
  },[filtered.length, visibleCount]);

  const total = initial.length;
  const avg = total ? (initial.reduce((s,r)=>s+r.rating,0)/total).toFixed(1) : "0.0";
  const five = initial.filter(r=>r.rating===5).length;
  const one = initial.filter(r=>r.rating===1).length;
  const positive = initial.filter(r=>r.rating>=4).length;

  function Stars({n, size}){
    return <span style={{color:"#F59E0B", fontSize: size||"15px", letterSpacing:"1px"}}>{"★".repeat(n)}{"☆".repeat(5-n)}</span>;
  }
  function openDetail(r){ setSelected(r); setShowDetail(true); }

  return (
    <div style={{display:"grid", gap:"16px", fontSize:"15px"}}>
      <style>{`
        .owner-card{ background:#fff; border:1.5px solid #E2E8F0; border-radius:18px; padding:18px; }
        .modal-overlay{ position:fixed; inset:0; background:rgba(10,25,47,0.65); backdrop-filter:blur(6px); z-index:90; display:grid; place-items:center; padding:16px; }
        .modal-box{ width:100%; background:#fff; border-radius:22px; border:1.5px solid #E2E8F0; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.2); animation:pop 0.22s ease; }
        @keyframes pop{ from{transform:scale(0.96) translateY(8px); opacity:0} to{transform:scale(1) translateY(0); opacity:1} }
      `}</style>

      <div className="row g-3" style={{margin:0, width:"100%"}}>
        <div className="col-6 col-lg-3"><div style={{background:"#0A192F", borderRadius:"18px", padding:"18px", color:"#fff"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>TOTAL REVIEWS</div><div style={{fontSize:"30px", fontWeight:900}}>{loading ? "..." : total}</div><div style={{fontSize:"12px", color:"#CBD5E1"}}>Read-only • No reply • Real DB</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#FEFCE8", borderColor:"#FEF08A"}}><div style={{fontSize:"11px", fontWeight:800, color:"#854D0E"}}>AVERAGE RATING</div><div style={{fontSize:"28px", fontWeight:900, color:"#854D0E"}}>{avg} / 5</div><div style={{fontSize:"12px", color:"#CA8A04"}}><Stars n={Math.round(Number(avg))} size="13px" /> • {positive} positive (4-5★)</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card"><div style={{fontSize:"11px", fontWeight:800, color:"#64748B"}}>5★ / 1★</div><div style={{fontSize:"18px", fontWeight:900, color:"#0A192F"}}>{five} • {one}</div><div style={{fontSize:"12px", color:"#64748B"}}>Excellent vs Poor</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#DCFCE7", borderColor:"#BBF7D0"}}><div style={{fontSize:"11px", fontWeight:800, color:"#166534"}}>LA • PST • BAR</div><div style={{fontSize:"16px", fontWeight:900, color:"#166534"}}>112 S Market St</div><div style={{fontSize:"11px", color:"#16A34A"}}>Inglewood CA 90301</div></div></div>
      </div>

      <div className="owner-card" style={{padding:"20px"}}>
        <div style={{display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:"12px", marginBottom:"16px"}}>
          <div><div style={{fontWeight:900, fontSize:"18px", color:"#0A192F"}}><i className="bi bi-star-fill me-2" style={{color:"#F59E0B"}}></i>Reviews • Read-Only • Lazy-Load 4</div><div style={{fontSize:"13px", color:"#64748B", fontWeight:600, marginTop:"3px"}}>{filtered.length} filtered • Scroll to load more • Admin cannot reply</div></div>
          <div style={{display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center"}}>
            <select value={workshopF} onChange={e=>setWorkshopF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px", minWidth:"180px"}}><option value="All">All Workshops</option>{workshopsList.map(w=><option key={w} value={w}>{w}</option>)}</select>
            <select value={ratingF} onChange={e=>setRatingF(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 12px", fontWeight:700, fontSize:"14px"}}><option value="All">All Ratings</option><option value="5">5 Stars</option><option value="4">4 Stars</option><option value="3">3 Stars</option><option value="2">2 Stars</option><option value="1">1 Star</option></select>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 10px", fontSize:"13px"}} />
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{height:"44px", borderRadius:"12px", border:"1.5px solid #E2E8F0", padding:"0 10px", fontSize:"13px"}} />
            <div style={{position:"relative"}}><i className="bi bi-search" style={{position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", color:"#94A3B8"}}></i><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search workshop, owner, comment..." style={{height:"44px", width:"240px", borderRadius:"12px", border:"1.5px solid #E2E8F0", background:"#F8FAFC", padding:"0 14px 0 40px", fontSize:"14px", fontWeight:600}} /></div>
          </div>
        </div>

        <div className="row g-3" style={{margin:0, width:"100%"}}>
          {visibleRows.map(r=>(
            <div key={r.id} className="col-12 col-md-6">
              <div style={{border:"1.5px solid #E2E8F0", borderRadius:"16px", padding:"16px", background:"#fff", height:"100%"}}>
                <div style={{display:"flex", justifyContent:"space-between", gap:"10px"}}>
                  <div style={{display:"flex", gap:"10px", alignItems:"center"}}>
                    <img src={r.logo} alt="" style={{width:"44px", height:"44px", borderRadius:"12px", objectFit:"cover", border:"1.5px solid #E2E8F0"}} />
                    <div><div style={{fontWeight:800, fontSize:"14px", color:"#0A192F"}}>{r.workshop}</div><div style={{fontSize:"12px", color:"#64748B"}}>{r.owner} • {r.date} • {r.bookingId}</div></div>
                  </div>
                  <span style={{background: r.rating>=4?"#DCFCE7": r.rating===3?"#FEF3C7":"#FEE2E2", color: r.rating>=4?"#166534": r.rating===3?"#92400E":"#991B1B", padding:"5px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:800, height:"fit-content"}}>{r.rating}★ • {r.rating>=4?"Positive": r.rating===3?"Neutral":"Negative"}</span>
                </div>
                <div style={{marginTop:"10px"}}><Stars n={r.rating} /></div>
                <p style={{fontSize:"14px", color:"#334155", marginTop:"8px", lineHeight:"1.5", display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden"}}>{r.comment || "No comment"}</p>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"10px"}}>
                  <span style={{fontSize:"12px", color:"#94A3B8", fontWeight:700}}>{r.id} • Read-only</span>
                  <button onClick={()=>openDetail(r)} style={{height:"36px", padding:"0 14px", borderRadius:"10px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"13px"}}>View Full</button>
                </div>
              </div>
            </div>
          ))}
          {visibleRows.length===0 && !loading && <div style={{padding:20, textAlign:"center", color:"#94A3B8", width:"100%"}}>No reviews yet. Car owners leave reviews after a completed booking.</div>}
        </div>

        <div ref={loaderRef} style={{padding:"18px", textAlign:"center"}}>
          {visibleCount < filtered.length ? (
            <div style={{display:"inline-flex", gap:"10px", alignItems:"center", background:"#F8FAFC", border:"1.5px solid #E2E8F0", padding:"10px 18px", borderRadius:"20px", fontWeight:700, fontSize:"13px", color:"#64748B"}}>
              <span className="spinner-border spinner-border-sm" style={{width:"16px", height:"16px"}}></span> Loading 4 more... • {visibleRows.length}/{filtered.length}
            </div>
          ) : (
            <div style={{fontSize:"13px", fontWeight:700, color:"#94A3B8"}}>All {filtered.length} reviews loaded • Avg {avg} / 5 • 112 S Market St Inglewood CA 90301 • PST</div>
          )}
        </div>
      </div>

      {showDetail && selected && (
        <div className="modal-overlay" onClick={()=>setShowDetail(false)}>
          <div className="modal-box" style={{maxWidth:"620px"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:"#0A192F", padding:"18px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", color:"#fff"}}>
              <div><div style={{fontWeight:900, fontSize:"16px"}}>{selected.id} • {selected.rating}★ • {selected.workshop}</div><div style={{fontSize:"12px", color:"#94A3B8"}}>{selected.date} • {selected.owner} • {selected.bookingId}</div></div>
              <button onClick={()=>setShowDetail(false)} style={{width:"38px", height:"38px", borderRadius:"12px", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.18)", color:"#fff"}}><i className="bi bi-x-lg"></i></button>
            </div>
            <div style={{padding:"22px", display:"grid", gap:"14px"}}>
              <div style={{display:"flex", gap:"12px", alignItems:"center", background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"14px"}}>
                <img src={selected.logo} alt="" style={{width:"52px", height:"52px", borderRadius:"12px", objectFit:"cover"}} />
                <div><div style={{fontWeight:900, fontSize:"15px", color:"#0A192F"}}>{selected.workshop}</div><div style={{fontSize:"13px", color:"#64748B"}}>Owner: {selected.workshopOwner}</div><div style={{fontSize:"12px", color:"#64748B"}}>Reviewer: {selected.owner} {selected.ownerEmail ? "• "+selected.ownerEmail : ""}</div></div>
              </div>
              <div><Stars n={selected.rating} size="18px" /></div>
              <div style={{background:"#FFFBEB", border:"1.5px solid #FEF3C7", borderRadius:"12px", padding:"14px", fontSize:"14px", lineHeight:"1.6", color:"#334155"}}>{selected.comment || "No comment"}</div>
              <div style={{fontSize:"12px", color:"#64748B", textAlign:"center"}}>Read-only • Admin cannot reply • Audit log only</div>
              <button onClick={()=>setShowDetail(false)} style={{height:"44px", borderRadius:"12px", background:"#0A192F", color:"#fff", border:"none", fontWeight:800, fontSize:"14px"}}>Close • {selected.id}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}