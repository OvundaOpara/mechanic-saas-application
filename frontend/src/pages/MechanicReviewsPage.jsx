import { useState, useMemo, useRef, useEffect, useCallback } from "react";

const API = "http://127.0.0.1:5000/api";
function getStoredUser(){ try{ return JSON.parse(localStorage.getItem("autoville_user")||"{}"); }catch{ return {}; } }

function normReview(r, idx){
  const rating = Number(r.rating ?? r.stars ?? 5);
  const created = String(r.created_at || r.date || "").slice(0,10);
  const timeStr = r.time || (r.created_at && String(r.created_at).length > 10 ? String(r.created_at).slice(11,16) + " PST" : "12:00 PM PST");
  const carStr = r.booking_car || r.car || [r.car_make, r.car_model, r.car_year].filter(Boolean).join(" ") || r.vehicle || "Vehicle";
  const tags = Array.isArray(r.tags) ? r.tags : [];
  const defaultTags = rating >= 5 ? ["Professional","On-Time"] : rating >= 4 ? ["Professional"] : rating === 3 ? ["Needs Attention"] : ["Re-check Needed"];
  return {
    dbId: r.id,
    id: `#REV-${r.id}`,
    custId: r.owner_id ? `#CUST-${r.owner_id}` : (r.custId || `#CUST-${3000+idx}`),
    name: r.owner_name || r.customer_name || r.name || "Customer",
    avatar: r.owner_avatar || r.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.owner_name || r.customer_name || "Customer")}&background=0A192F&color=fff`,
    car: carStr,
    service: r.service || r.booking_service || r.service_type || "General Repair",
    booking: r.booking_id ? `#AV-${r.booking_id}` : (r.booking || "-"),
    rating,
    date: created || "-",
    time: timeStr,
    comment: r.comment || r.review || r.feedback || "",
    tags: tags.length ? tags : defaultTags,
    recommend: r.recommend !== undefined ? !!r.recommend : rating >= 4,
    helpful: Number(r.helpful ?? r.helpful_count ?? 0),
    location: r.location || r.owner_location || "Inglewood, CA",
    verified: true,
  };
}

export default function MechanicReviewsPage({ workshopId: propWorkshopId, workshop }) {
  const storedUser = getStoredUser();
  const workshopId = propWorkshopId || workshop?.id || storedUser.id || storedUser.workshop_id || storedUser.workshopId;

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [ratingF, setRatingF] = useState("All");
  const [serviceF, setServiceF] = useState("All");
  const [sort, setSort] = useState("Newest");
  const [selected, setSelected] = useState(null);
  const [visible, setVisible] = useState(4);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef(null);

  const fetchReviews = useCallback(async ()=>{
    if(!workshopId){ setLoading(false); return; }
    setLoading(true); setError("");
    try{
      let res = await fetch(`${API}/workshops/${workshopId}/reviews?limit=500`);
      let data = await res.json().catch(()=>[]);
      if(!res.ok){
        res = await fetch(`${API}/reviews?workshop_id=${workshopId}&limit=500`);
        data = await res.json().catch(()=>[]);
        if(!res.ok){
          res = await fetch(`${API}/admin/reviews?workshop_id=${workshopId}&limit=500`);
          data = await res.json().catch(()=>[]);
          if(!res.ok) throw new Error(data.error || "Failed to load reviews");
        }
      }
      const list = Array.isArray(data) ? data : (data.reviews || data.data || []);
      setReviews(list.map((r,i)=> normReview(r,i)));
    }catch(e){ setError(e.message || "Could not load reviews. Is Flask running on :5000?"); setReviews([]); }
    setLoading(false);
  }, [workshopId]);

  useEffect(()=>{ fetchReviews(); }, [fetchReviews]);

  const services = useMemo(()=> ["All", ...new Set(reviews.map(r=>r.service))], [reviews]);

  const filtered = useMemo(()=>{
    let d=[...reviews];
    if(search){ const s=search.toLowerCase(); d=d.filter(r=> `${r.name} ${r.service} ${r.car} ${r.comment} ${r.booking} ${r.tags.join(" ")}`.toLowerCase().includes(s)); }
    if(ratingF!=="All") d=d.filter(r=>r.rating===Number(ratingF));
    if(serviceF!=="All") d=d.filter(r=>r.service===serviceF);
    if(sort==="Newest") d.sort((a,b)=> new Date(b.date)-new Date(a.date));
    if(sort==="Highest") d.sort((a,b)=> b.rating-a.rating);
    if(sort==="Lowest") d.sort((a,b)=> a.rating-b.rating);
    if(sort==="Helpful") d.sort((a,b)=> b.helpful-a.helpful);
    return d;
  },[reviews, search, ratingF, serviceF, sort]);

  const displayed = useMemo(()=> filtered.slice(0, visible), [filtered, visible]);

  useEffect(()=>{ setVisible(4); window.scrollTo({top:0, behavior:'smooth'}); },[search, ratingF, serviceF, sort]);

  const loadMore = useCallback(()=>{
    if(visible >= filtered.length || isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(()=>{
      setVisible(v=> Math.min(v+4, filtered.length));
      setIsLoadingMore(false);
    }, 500);
  },[visible, filtered.length, isLoadingMore]);

  useEffect(()=>{
    const observer = new IntersectionObserver(entries=>{
      if(entries[0].isIntersecting){ loadMore(); }
    }, { rootMargin: "200px" });
    const el = sentinelRef.current;
    if(el) observer.observe(el);
    return ()=>{ if(el) observer.unobserve(el); };
  },[loadMore]);

  const stats = {
    total: reviews.length,
    avg: reviews.length ? (reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1) : "0.0",
    five: reviews.filter(r=>r.rating===5).length,
    four: reviews.filter(r=>r.rating===4).length,
    three: reviews.filter(r=>r.rating===3).length,
    two: reviews.filter(r=>r.rating===2).length,
    one: reviews.filter(r=>r.rating===1).length,
    recommend: reviews.length ? Math.round(reviews.filter(r=>r.recommend).length/reviews.length*100) : 0,
  };

  const StarRow=({rating, size=16})=>(
    <span>{[1,2,3,4,5].map(i=><i key={i} className={`bi ${i<=rating ? "bi-star-fill" : "bi-star"}`} style={{color: i<=rating ? "#F59E0B" : "#E2E8F0", fontSize:`${size}px`, marginRight:"2px"}}></i>)}</span>
  );

  if(loading) return <div style={{padding:"40px", textAlign:"center", color:"#64748B"}}>Loading reviews from backend...</div>;

  return (
    <>
    <style>{`
      .rev-wrap{ width:100%; max-width:100%; overflow:hidden; }
      .rev-stat{ background:#fff; border:1.5px solid #0A192F; border-radius:18px; padding:18px; height:100%; }
      .rev-card{ background:#fff; border:1.5px solid #E2E8F0; border-radius:18px; padding:18px; margin-bottom:14px; transition:0.2s; }
      .rev-card:hover{ border-color:#0A192F; box-shadow:0 6px 20px rgba(10,25,47,0.06); }
      .rev-toolbar{ background:#fff; border:1.5px solid #E2E8F0; border-radius:16px; padding:16px; display:flex; gap:12px; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom:16px; }
      .rev-search{ position:relative; flex:1; min-width:240px; max-width:360px; } .rev-search input{ width:100%; height:48px; border:1.5px solid #E2E8F0; border-radius:14px; padding:0 14px 0 44px; font-size:15px; font-weight:600; background:#F8FAFC; outline:none; } .rev-search i{ position:absolute; left:16px; top:50%; transform:translateY(-50%); color:#6B7A90; }
      .rev-modal-backdrop{ position:fixed; inset:0; background:rgba(10,25,47,0.55); backdrop-filter:blur(6px); z-index:99; display:grid; place-items:center; padding:16px; } .rev-modal{ width:100%; max-width:720px; max-height:92vh; overflow:auto; background:#fff; border:2px solid #0A192F; border-radius:22px; box-shadow:0 30px 80px rgba(0,0,0,0.25); }
      .star-bar-bg{ height:10px; background:#F1F5F9; border-radius:10px; overflow:hidden; } .star-bar{ height:100%; background:#F59E0B; }
      @media(max-width:768px){ .rev-toolbar{ flex-direction:column; align-items:stretch; } .rev-search{ max-width:100%; } }
    `}</style>

    <div className="rev-wrap">
      <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', marginBottom:'14px'}}>
        <div><h2 style={{fontWeight:900, fontSize:'30px', color:'#0A192F', margin:'0 0 8px'}}>Reviews • Ratings & Remarks</h2><p style={{color:'#6B7A90', fontSize:'16px', margin:0, fontWeight:500}}>Read-only • Lazy load on scroll • Overall = average of all service ratings • BAR ARD 284719 • Inglewood, CA</p></div>
        <div style={{display:'flex', gap:'8px', alignSelf:'flex-start'}}>
          <button onClick={fetchReviews} style={{height:'46px', borderRadius:'12px', background:'#fff', border:'1.5px solid #E2E8F0', fontWeight:800, fontSize:'13px', padding:'0 14px'}}><i className="bi bi-arrow-clockwise me-1"></i>Refresh</button>
          <span style={{height:'46px', borderRadius:'12px', background:'#0A192F', color:'#fff', fontWeight:800, fontSize:'14px', padding:'0 16px', display:'grid', placeItems:'center'}}><i className="bi bi-star-fill me-2" style={{color:'#FBBF24'}}></i>{stats.avg} • {stats.total} reviews • {stats.recommend}% recommend • Showing {displayed.length}/{filtered.length}</span>
        </div>
      </div>

      {error && <div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", color:"#991B1B", padding:"12px 14px", borderRadius:"12px", marginBottom:"12px", fontSize:"13px", fontWeight:700}}>{error}</div>}

      <div className="row g-3 mb-3" style={{margin:0, width:'100%'}}>
        <div className="col-lg-4">
          <div className="rev-stat" style={{background:'#0A192F', borderColor:'#0A192F', color:'#fff'}}>
            <div style={{fontSize:'13px', fontWeight:800, color:'#94A3B8'}}>OVERALL RATING • ACCUMULATED • READ-ONLY • LAZY</div>
            <div style={{display:'flex', gap:'14px', alignItems:'center', marginTop:'12px'}}>
              <div style={{fontWeight:900, fontSize:'52px', lineHeight:1}}>{stats.avg}</div>
              <div><div style={{display:'flex', gap:'2px'}}>{[1,2,3,4,5].map(i=><i key={i} className="bi bi-star-fill" style={{color: i<=Math.round(Number(stats.avg)) ? "#FBBF24" : "#334155", fontSize:"22px"}}></i>)}</div><div style={{fontSize:'13px', color:'#94A3B8', marginTop:'4px', fontWeight:600}}>{stats.total} verified • Lazy load 4 per scroll • No reply needed</div></div>
            </div>
            <div style={{marginTop:'14px', fontSize:'14px', color:'#CBD5E1', lineHeight:1.6}}>Overall workshop rating auto-calculated from Owner Remarks. Page lazy loads as you scroll down - 4 more reviews each time you reach bottom.</div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="rev-stat">
            <div style={{fontSize:'13px', fontWeight:900, color:'#6B7A90', marginBottom:'14px'}}>RATING BREAKDOWN • DISTRIBUTION</div>
            {[5,4,3,2,1].map(st=>{
              const count = stats[ st===5?"five": st===4?"four": st===3?"three": st===2?"two":"one"];
              const pct = stats.total ? (count/stats.total*100) : 0;
              return (
                <div key={st} style={{display:'flex', gap:'10px', alignItems:'center', marginBottom:'10px'}}>
                  <span style={{fontSize:'14px', fontWeight:800, width:'48px', color:'#0A192F'}}>{st} ★ • {count}</span>
                  <div className="star-bar-bg" style={{flex:1}}><div className="star-bar" style={{width:`${pct}%`}}></div></div>
                  <span style={{fontSize:'13px', fontWeight:700, color:'#6B7A90', width:'40px'}}>{pct.toFixed(0)}%</span>
                </div>
              );
            })}
            <div style={{marginTop:'14px', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'12px', padding:'12px', fontSize:'13px', color:'#6B7A90'}}><b>Positive:</b> {stats.five + stats.four} (4-5★) • <b>Needs attention:</b> {stats.three + stats.two + stats.one} (1-3★) • Scroll to lazy load more.</div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="rev-stat">
            <div style={{fontSize:'13px', fontWeight:900, color:'#6B7A90', marginBottom:'14px'}}>FILTER BY RATING • QUICK VIEW</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
              {[
                {label:"All", val:"All", count:stats.total, color:"#0A192F"},
                {label:"5 Stars", val:"5", count:stats.five, color:"#166534"},
                {label:"4 Stars", val:"4", count:stats.four, color:"#1E40AF"},
                {label:"3 Stars", val:"3", count:stats.three, color:"#92400E"},
                {label:"2 Stars", val:"2", count:stats.two, color:"#991B1B"},
                {label:"1 Star", val:"1", count:stats.one, color:"#7F1D1D"},
              ].map(b=>(
                <button key={b.val} onClick={()=>setRatingF(b.val)} style={{height:'50px', borderRadius:'12px', border:`1.5px solid ${ratingF===b.val ? b.color : '#E2E8F0'}`, background: ratingF===b.val ? b.color : '#fff', color: ratingF===b.val ? '#fff' : '#0A192F', fontWeight:800, fontSize:'14px'}}>{b.label} • {b.count}</button>
              ))}
            </div>
            <div style={{marginTop:'14px', fontSize:'13px', color:'#475569', background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:'12px', padding:'12px', lineHeight:1.6}}><i className="bi bi-infinity me-1" style={{color:'#1E40AF'}}></i><b>Lazy Load:</b> Shows {displayed.length} of {filtered.length} filtered. Scroll down - 4 more load automatically when you reach bottom. No reply per policy.</div>
          </div>
        </div>
      </div>

      <div className="rev-toolbar">
        <div className="rev-search"><i className="bi bi-search"></i><input placeholder="Search customer, service, comment, tags..." value={search} onChange={e=>setSearch(e.target.value)} /></div>
        <div style={{display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center'}}>
          <select value={serviceF} onChange={e=>setServiceF(e.target.value)} style={{height:'48px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:700, fontSize:'14px', padding:'0 12px', minWidth:'190px'}}>{services.map(s=><option key={s} value={s}>{s==="All"?"All Services":s}</option>)}</select>
          <select value={sort} onChange={e=>setSort(e.target.value)} style={{height:'48px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontWeight:700, fontSize:'14px', padding:'0 12px'}}><option>Newest</option><option>Highest</option><option>Lowest</option><option>Helpful</option></select>
          <span style={{fontSize:'13px', fontWeight:700, color:'#6B7A90', background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'8px 12px', borderRadius:'20px'}}>{displayed.length}/{filtered.length} loaded</span>
        </div>
      </div>

      {filtered.length===0 ? <div style={{background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:'18px', padding:'40px', textAlign:'center', color:'#6B7A90', fontSize:'15px', fontWeight:600}}>{reviews.length===0 ? "No reviews yet. Reviews appear when an owner leaves a rating after a completed booking." : `No reviews for ${ratingF} stars • ${serviceF}`}</div> :
        displayed.map(r=>(
          <div key={r.id} className="rev-card">
            <div style={{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'14px'}}>
              <div style={{display:'flex', gap:'16px', alignItems:'flex-start', flex:1, minWidth:'280px'}}>
                <img src={r.avatar} alt={r.name} style={{width:'58px', height:'58px', borderRadius:'50%', objectFit:'cover', border:'2px solid #E2E8F0'}} />
                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center'}}><span style={{fontWeight:900, fontSize:'17px', color:'#0A192F'}}>{r.name}</span><span style={{fontSize:'11px', fontWeight:800, background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'5px 10px', borderRadius:'20px', color:'#475569'}}>{r.custId} • {r.booking}</span>{r.verified && <span style={{fontSize:'11px', fontWeight:800, background:'#EFF6FF', border:'1px solid #BFDBFE', padding:'5px 10px', borderRadius:'20px', color:'#1E40AF'}}><i className="bi bi-patch-check-fill me-1"></i>Verified</span>}<span style={{fontSize:'11px', fontWeight:800, padding:'5px 10px', borderRadius:'20px', background: r.recommend ? '#DCFCE7' : '#FEE2E2', color: r.recommend ? '#166534' : '#991B1B'}}>{r.recommend ? 'Recommends' : 'Not Recommend'}</span></div>
                  <div style={{fontSize:'13px', color:'#6B7A90', marginTop:'4px', fontWeight:500}}>{r.car} • {r.location} • {r.date} {r.time} • {r.id}</div>
                  <div style={{marginTop:'8px', display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap'}}><StarRow rating={r.rating} size={18} /><span style={{fontSize:'14px', fontWeight:800, color:'#0A192F'}}>{r.rating}.0 • {r.service}</span></div>
                  <div style={{marginTop:'10px', fontSize:'15px', color:'#0A192F', lineHeight:1.65, fontWeight:500}}>{r.comment}</div>
                  <div style={{marginTop:'12px', display:'flex', gap:'8px', flexWrap:'wrap'}}>{r.tags.map(t=><span key={t} style={{fontSize:'12px', fontWeight:700, background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'6px 12px', borderRadius:'20px', color:'#475569'}}><i className="bi bi-tag me-1"></i>{t}</span>)}</div>
                  <div style={{marginTop:'12px', fontSize:'13px', color:'#6B7A90', fontWeight:500}}><i className="bi bi-hand-thumbs-up me-1"></i>{r.helpful} helpful • BAR ARD 284719 • AutoVille verified • Read-only • No reply</div>
                </div>
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:'10px', alignSelf:'flex-start'}}>
                <button onClick={()=>setSelected(r)} style={{height:'44px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#fff', fontWeight:700, fontSize:'14px', padding:'0 18px'}}><i className="bi bi-eye me-1"></i>View Full</button>
                <span style={{fontSize:'11px', fontWeight:800, background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'6px 10px', borderRadius:'20px', textAlign:'center', color:'#6B7A90'}}>READ-ONLY</span>
              </div>
            </div>
          </div>
        ))
      }

      <div ref={sentinelRef} style={{height:'1px'}}></div>
      {visible < filtered.length ? (
        <div style={{background:'#F8FAFC', border:'1.5px solid #E2E8F0', borderRadius:'14px', padding:'16px', textAlign:'center', marginTop:'8px'}}>
          {isLoadingMore ?
            <span style={{fontSize:'14px', fontWeight:700, color:'#6B7A90'}}><span className="spinner-border spinner-border-sm me-2" role="status"></span>Loading 4 more reviews... Scroll lazy-load • {displayed.length}/{filtered.length}</span> :
            <span style={{fontSize:'14px', fontWeight:600, color:'#6B7A90'}}>Scroll down to load more • Showing {displayed.length} of {filtered.length} • <button onClick={loadMore} style={{border:'none', background:'transparent', color:'#0A192F', fontWeight:800, textDecoration:'underline', cursor:'pointer'}}>Load 4 more now</button> • {filtered.length - displayed.length} remaining</span>
          }
        </div>
      ) : filtered.length>0 && (
        <div style={{background:'#F0FDF4', border:'1.5px solid #BBF7D0', borderRadius:'14px', padding:'16px', textAlign:'center', marginTop:'8px', fontSize:'14px', fontWeight:700, color:'#166534'}}>
          <i className="bi bi-check-circle-fill me-2"></i>All {filtered.length} reviews loaded • End of {ratingF} filter • BAR ARD 284719 • No reply needed
        </div>
      )}

      <div style={{background:'#0A192F', borderRadius:'16px', padding:'18px', color:'#fff', marginTop:'12px', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'10px'}}>
        <span style={{fontSize:'14px', color:'#94A3B8', fontWeight:600}}><i className="bi bi-infinity me-1"></i>Lazy: 4 per scroll • {displayed.length}/{filtered.length} loaded • {filtered.length - displayed.length} more on scroll • No workshop reply per policy</span>
        <span style={{fontSize:'14px', fontWeight:800, color:'#fff'}}>{stats.avg}★ • {stats.recommend}% recommend • Inglewood</span>
      </div>
    </div>

    {selected && (
      <div className="rev-modal-backdrop" onClick={()=>setSelected(null)}>
        <div className="rev-modal" onClick={e=>e.stopPropagation()}>
          <div style={{padding:'18px', borderBottom:'1.5px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#F8FAFC', position:'sticky', top:0, zIndex:2}}>
            <div style={{display:'flex', gap:'14px', alignItems:'center', minWidth:0}}><img src={selected.avatar} style={{width:'58px', height:'58px', borderRadius:'50%', objectFit:'cover', border:'2px solid #0A192F'}} alt="" /><div style={{minWidth:0}}><div style={{fontWeight:900, fontSize:'18px', color:'#0A192F', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{selected.name} • {selected.id}</div><div style={{fontSize:'13px', color:'#6B7A90'}}><StarRow rating={selected.rating} size={14} /> • {selected.rating}.0 • {selected.service} • {selected.date}</div></div></div>
            <button onClick={()=>setSelected(null)} style={{width:'42px', height:'42px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#fff', flexShrink:0}}><i className="bi bi-x-lg"></i></button>
          </div>
          <div style={{padding:'18px', display:'grid', gap:'16px'}}>
            <div style={{border:'1.5px solid #0A192F', borderRadius:'16px', padding:'18px'}}>
              <div style={{fontSize:'12px', fontWeight:800, color:'#6B7A90', marginBottom:'8px'}}>CUSTOMER REMARK • {selected.custId} • {selected.booking} • READ-ONLY • VERIFIED</div>
              <div style={{display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center', marginBottom:'10px'}}><StarRow rating={selected.rating} size={20} /><span style={{fontSize:'15px', fontWeight:800, color:'#0A192F'}}>{selected.rating}.0 • {selected.service}</span><span style={{fontSize:'12px', fontWeight:800, padding:'5px 10px', borderRadius:'20px', background: selected.recommend ? '#DCFCE7' : '#FEE2E2', color: selected.recommend ? '#166534' : '#991B1B'}}>{selected.recommend ? 'Recommends' : 'Does Not Recommend'}</span></div>
              <div style={{fontSize:'16px', color:'#0A192F', lineHeight:1.7, fontWeight:500}}>{selected.comment}</div>
              <div style={{marginTop:'12px', display:'flex', gap:'8px', flexWrap:'wrap'}}>{selected.tags.map(t=><span key={t} style={{fontSize:'12px', fontWeight:700, background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'6px 12px', borderRadius:'20px'}}>{t}</span>)}</div>
              <div style={{marginTop:'14px', fontSize:'13px', color:'#6B7A90', lineHeight:1.6}}><div><b>Customer:</b> {selected.name} • {selected.custId} • {selected.car}</div><div><b>Booking:</b> {selected.booking} • {selected.date} {selected.time} PST • {selected.location}</div><div><b>Helpful:</b> {selected.helpful} owners • {selected.id} • BAR ARD 284719 • 112 S Market St, Ste 1008, Inglewood, CA 90301</div><div style={{marginTop:'8px', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'10px', padding:'10px'}}><i className="bi bi-info-circle me-1"></i>Per policy, workshop does not reply. Read-only review for quality monitoring.</div></div>
            </div>
            <button onClick={()=>setSelected(null)} style={{height:'48px', borderRadius:'12px', background:'#0A192F', color:'#fff', border:'none', fontWeight:800, fontSize:'15px'}}>Close • {selected.id} • Read-Only</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}