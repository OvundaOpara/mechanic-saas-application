// src/pages/OwnerWorkshopsPage.jsx - WIRED TO BACKEND - only verified + active subscription
import { useState, useMemo, useEffect, useCallback } from "react";
import Swal from "sweetalert2";

const API = "http://127.0.0.1:5000/api";
function getOwnerIdFromStorage(){
  try{ const u = JSON.parse(localStorage.getItem("autoville_user")||"{}"); return u?.id || u?.owner_id || u?.ownerId || u?.user_id || null; }catch{ return null; }
}

export default function OwnerWorkshopsPage({ C, isDark, ownerId, owner }) {
  const effectiveOwnerId = ownerId || getOwnerIdFromStorage();
  const [workshops, setWorkshops] = useState([]);
  const [likedIds, setLikedIds] = useState(new Set());
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("All");
  const [rating, setRating] = useState("All");
  const [page, setPage] = useState(1);
  const perPage = 6;
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showBook, setShowBook] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookForm, setBookForm] = useState({ carId:"", service:"Oil Change", date:"", time:"10:00 AM", note:"" });

  const fetchWorkshops = useCallback(async ()=>{
    setLoading(true); setError("");
    try{
      const res = await fetch(`${API}/workshops/available`);
      const data = await res.json().catch(()=>[]);
      if(!res.ok) throw new Error(data.error || `Failed to load workshops (${res.status})`);
      setWorkshops(Array.isArray(data) ? data : []);
    }catch(e){ setError(e.message); setWorkshops([]); }
    setLoading(false);
  }, []);

  const fetchFavorites = useCallback(async ()=>{
    if(!effectiveOwnerId) return;
    try{
      const r = await fetch(`${API}/owners/${effectiveOwnerId}/favorites`);
      const d = await r.json().catch(()=>[]);
      if(Array.isArray(d)) setLikedIds(new Set(d.map(Number)));
    }catch{}
  }, [effectiveOwnerId]);

  const fetchCars = useCallback(async ()=>{
    if(!effectiveOwnerId) return;
    try{
      const r = await fetch(`${API}/owners/${effectiveOwnerId}/vehicles`);
      const d = await r.json().catch(()=>[]);
      setCars(Array.isArray(d) ? d : []);
      if(Array.isArray(d) && d.length){
        setBookForm(f=>({...f, carId: String(d[0].id)}));
      }
    }catch{}
  }, [effectiveOwnerId]);

  useEffect(()=>{ fetchWorkshops(); fetchFavorites(); fetchCars(); }, [fetchWorkshops, fetchFavorites, fetchCars]);
  useEffect(()=>{ setPage(1); },[q, loc, rating]);

  const locations = ["All", ...new Set(workshops.map(w=>w.location).filter(Boolean))];

  const toggleLike = async (id) => {
    const isLiked = likedIds.has(id);
    // Optimistic
    setLikedIds(prev=>{ const n=new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; });
    setWorkshops(prev=> prev.map(w=> w.id===id ? {...w, likes: isLiked ? Math.max(0, w.likes-1) : w.likes+1 } : w ));
    if(selected && selected.id===id) setSelected(s=>({...s, likes: isLiked ? Math.max(0, s.likes-1) : s.likes+1}));
    if(!effectiveOwnerId) return;
    try{
      await fetch(`${API}/owners/${effectiveOwnerId}/favorites/${id}`, { method: isLiked ? "DELETE" : "POST" });
    }catch{ /* keep optimistic */ }
  };

  const filtered = useMemo(()=>{
    return workshops.filter(w=>{
      const matchQ = `${w.name} ${(w.expertise||[]).join(" ")} ${(w.services||[]).join(" ")}`.toLowerCase().includes(q.toLowerCase());
      const matchLoc = loc==="All" || w.location===loc;
      const matchRating = rating==="All" || w.rating >= parseFloat(rating);
      return matchQ && matchLoc && matchRating;
    });
  },[workshops, q, loc, rating]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page-1)*perPage, page*perPage);

  const openDetail = (w) => { setSelected(w); setShowDetail(true); };
  const openBook = (w) => {
    setSelected(w);
    setBookForm(f=>({...f, service: (w.services && w.services[0]) || "Oil Change", date: "", time: "10:00 AM", note: ""}));
    setShowBook(true);
  };

  const handleBook = async (e)=>{
    e.preventDefault();
    if(!effectiveOwnerId) return Swal.fire("Not logged in", "Please log in again", "warning");
    if(!bookForm.date) return Swal.fire("Pick a date", "Select a booking date", "warning");
    setBooking(true);
    try{
      const car = cars.find(c=>String(c.id)===String(bookForm.carId));
      const payload = {
        owner_id: effectiveOwnerId,
        workshop_id: selected.id,
        car_id: bookForm.carId ? Number(bookForm.carId) : null,
        vehicle: car ? `${car.make} ${car.model}` : "",
        service_type: bookForm.service,
        booking_date: bookForm.date,
        booking_time: bookForm.time,
        description: bookForm.note || `Booking for ${bookForm.service}`,
        amount: 0,
      };
      const res = await fetch(`${API}/bookings`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || `Booking failed (${res.status})`);
      setShowBook(false);
      Swal.fire("Booked!", `Your ${bookForm.service} at ${selected.name} on ${bookForm.date} at ${bookForm.time} is pending.`, "success");
    }catch(err){ Swal.fire("Could not book", err.message, "error"); }
    setBooking(false);
  };

  return (
    <>
    <style>{`
      .ws-search-wrap{ background:${C.card}; border:1.5px solid ${C.cardBorder}; border-radius:20px; padding:14px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
      .ws-input{ flex:1 1 220px; height:48px; background:${C.soft}; border:1.5px solid ${C.cardBorder}; border-radius:12px; padding:0 14px 0 40px; color:${C.text}; font-weight:600; font-size:14px; }
      .ws-select{ height:48px; background:${C.soft}; border:1.5px solid ${C.cardBorder}; border-radius:12px; padding:0 14px; color:${C.text}; font-weight:700; min-width:160px; font-size:14px; }
      .ws-card{ background:${C.card}; border:1.5px solid ${C.cardBorder}; border-radius:18px; overflow:hidden; transition:.2s; height:100%; display:flex; flex-direction:column; }
      .ws-card:hover{ transform:translateY(-3px); box-shadow:0 14px 30px rgba(0,0,0,0.08); }
      .ws-img{ height:170px; background-size:cover; background-position:center; position:relative; }
      .ws-img::after{ content:""; position:absolute; inset:0; background:linear-gradient(to top, rgba(10,25,47,0.8), transparent 60%); }
      .av-page-btn{ width:38px; height:38px; border-radius:10px; border:1.5px solid ${C.cardBorder}; background:${C.card}; color:${C.text}; font-weight:800; }
      .av-page-btn.active{ background:#0A192F; color:#fff; border-color:#0A192F; }
      .like-btn{ height:42px; border-radius:11px; font-weight:800; font-size:13px; display:flex; align-items:center; gap:6px; padding:0 14px; border:1.5px solid ${C.cardBorder}; transition:.2s; }
      .like-btn.liked{ background:#FEF2F2; border-color:#FECACA; color:#DC2626; }
      .like-btn:not(.liked){ background:${C.soft}; color:${C.text}; }
      .modal-overlay{ position:fixed; inset:0; background:rgba(5,12,28,0.72); backdrop-filter:blur(8px); z-index:110; display:grid; place-items:center; padding:16px; }
      .modal-pro{ width:100%; max-width:720px; background:${C.card}; border:1.5px solid ${C.cardBorder}; border-radius:24px; overflow:hidden; max-height:92vh; overflow-y:auto; }
    `}</style>

    <div style={{display:'flex', justifyContent:'space-between', alignItems:'end', flexWrap:'wrap', gap:'12px', marginBottom:'16px'}}>
      <div><h2 style={{fontWeight:900, fontSize:'30px', color:C.text, margin:0, letterSpacing:'-0.03em'}}>Find Workshops</h2><p style={{color:C.muted, fontSize:'14px', margin:'6px 0 0'}}>Only verified workshops with active subscription • {filtered.length} shops • Likes visible & toggleable</p></div>
      <div style={{display:'flex', gap:'8px'}}><div style={{fontSize:'13px', fontWeight:800, color:C.muted, background:C.card, border:`1px solid ${C.cardBorder}`, padding:'9px 14px', borderRadius:'20px'}}><i className="bi bi-heart-fill me-1" style={{color:'#EF4444'}}></i>{likedIds.size} liked</div><div style={{fontSize:'13px', fontWeight:800, color:C.muted, background:C.card, border:`1px solid ${C.cardBorder}`, padding:'9px 14px', borderRadius:'20px'}}>Page {page}/{totalPages||1}</div></div>
    </div>

    {error && <div style={{background:"#FEF2F2", border:"1.5px solid #FECACA", color:"#991B1B", padding:"12px 14px", borderRadius:"12px", marginBottom:"12px", fontSize:"13px", fontWeight:700}}>{error} <button onClick={fetchWorkshops} style={{marginLeft:"8px", background:"#fff", border:"1px solid #FECACA", borderRadius:"8px", padding:"4px 10px", fontWeight:800}}>Retry</button></div>}
    {loading ? <div style={{padding:"40px", textAlign:"center", color:C.muted}}>Loading verified workshops...</div> : (
    <>
    <div className="ws-search-wrap mb-3">
      <div style={{position:'relative', flex:'1 1 260px'}}><i className="bi bi-search" style={{position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', color:C.muted}}></i><input className="ws-input" placeholder="Search shop, service, Toyota, brake..." value={q} onChange={e=>setQ(e.target.value)} /></div>
      <div style={{display:'flex', gap:'8px', flex:'1 1 320px'}}>
        <div style={{position:'relative', flex:1}}><i className="bi bi-geo-alt" style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:C.muted, fontSize:'13px'}}></i><select className="ws-select" value={loc} onChange={e=>setLoc(e.target.value)} style={{paddingLeft:'34px', width:'100%'}}>{locations.map(l=><option key={l} value={l}>{l==="All"?"All Locations":l}</option>)}</select></div>
        <div style={{position:'relative', flex:1}}><i className="bi bi-star-fill" style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#F59E0B', fontSize:'13px'}}></i><select className="ws-select" value={rating} onChange={e=>setRating(e.target.value)} style={{paddingLeft:'34px', width:'100%'}}><option value="All">All Ratings</option><option value="4.8">4.8+ Stars</option><option value="4.5">4.5+ Stars</option><option value="4">4.0+ Stars</option></select></div>
      </div>
      {(q||loc!=="All"||rating!=="All") && <button className="btn" style={{height:'48px', borderRadius:'12px', background:C.soft, border:`1px solid ${C.cardBorder}`, fontWeight:800, color:C.text, fontSize:'13px'}} onClick={()=>{setQ(""); setLoc("All"); setRating("All")}}><i className="bi bi-x-lg me-1"></i>Clear</button>}
    </div>

    {filtered.length===0 ? (
      <div style={{padding:"40px", textAlign:"center", background:C.card, border:`1.5px solid ${C.cardBorder}`, borderRadius:"18px", color:C.muted}}>
        <div style={{fontSize:"28px"}}><i className="bi bi-shop"></i></div>
        <div style={{fontWeight:800, color:C.text, marginTop:"8px"}}>No verified workshops with active subscription yet</div>
        <div style={{fontSize:"13px"}}>Only approved workshops with an active plan appear here.</div>
      </div>
    ) : (
    <>
    <div className="row g-3">
      {paginated.map(w=> {
        const isLiked = likedIds.has(w.id);
        return (
        <div key={w.id} className="col-md-6 col-xl-4">
          <div className="ws-card">
            <div className="ws-img" style={{backgroundImage:`url(${w.image})`}}>
              <div style={{position:'absolute', top:'12px', left:'12px', right:'12px', zIndex:2, display:'flex', justifyContent:'space-between'}}>
                <div style={{display:'flex', gap:'6px'}}>{w.verified && <span style={{background:'#fff', color:'#0A192F', fontSize:'11px', fontWeight:900, padding:'5px 10px', borderRadius:'20px'}}><i className="bi bi-patch-check-fill me-1" style={{color:'#22C55E'}}></i>VERIFIED</span>}<span style={{background:'#FBBF24', color:'#000', fontSize:'11px', fontWeight:900, padding:'5px 10px', borderRadius:'20px'}}><i className="bi bi-star-fill me-1"></i>{w.rating}</span></div>
                <span style={{background:'rgba(0,0,0,0.6)', backdropFilter:'blur(6px)', color:'#fff', fontSize:'12px', fontWeight:800, padding:'5px 10px', borderRadius:'20px', border:'1px solid rgba(255,255,255,0.2)', display:'flex', alignItems:'center', gap:'5px'}}><i className="bi bi-heart-fill" style={{color:isLiked?'#EF4444':'#fff'}}></i>{w.likes}</span>
              </div>
              <div style={{position:'absolute', bottom:'12px', left:'14px', right:'14px', zIndex:2, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{color:'#fff', fontSize:'13px', fontWeight:700}}><i className="bi bi-geo-alt me-1"></i>{w.location} • {w.distance}</span>
                <span style={{background:'rgba(255,255,255,0.15)', backdropFilter:'blur(6px)', border:'1px solid rgba(255,255,255,0.25)', color:'#fff', fontSize:'11px', fontWeight:800, padding:'5px 10px', borderRadius:'20px'}}>{w.jobs} jobs</span>
              </div>
            </div>
            <div style={{padding:'16px', flex:1, display:'flex', flexDirection:'column'}}>
              <div style={{fontWeight:900, color:C.text, fontSize:'17px', lineHeight:1.2}}>{w.name}</div>
              <div style={{fontSize:'13px', color:C.muted, marginTop:'4px', fontWeight:600}}>{w.price} • <i className="bi bi-lightning me-1"></i>{w.response} avg response</div>
              <div style={{display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'12px'}}>{(w.expertise||[]).map(ex=><span key={ex} style={{fontSize:'12px', fontWeight:700, background:C.soft, border:`1px solid ${C.cardBorder}`, padding:'5px 10px', borderRadius:'20px', color:C.muted}}>{ex}</span>)}</div>
              <div style={{display:'flex', gap:'8px', marginTop:'auto', paddingTop:'14px'}}>
                <button onClick={()=>toggleLike(w.id)} className={`like-btn ${isLiked?'liked':''}`}><i className={`bi ${isLiked?'bi-heart-fill':'bi-heart'}`}></i>{w.likes}</button>
                <button onClick={()=>openDetail(w)} className="btn" style={{flex:1, borderRadius:'11px', fontWeight:800, fontSize:'13px', height:'42px', background:C.soft, border:`1.5px solid ${C.cardBorder}`, color:C.text}}><i className="bi bi-eye me-1"></i>Detail</button>
                <button onClick={()=>openBook(w)} className="btn btn-dark" style={{flex:1, borderRadius:'11px', fontWeight:800, fontSize:'13px', height:'42px'}}><i className="bi bi-calendar-plus me-1"></i>Book</button>
              </div>
            </div>
          </div>
        </div>
        );
      })}
    </div>

    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'18px', background:C.card, border:`1.5px solid ${C.cardBorder}`, borderRadius:'14px', padding:'14px 16px', flexWrap:'wrap', gap:'10px'}}>
      <div style={{fontSize:'13px', color:C.muted, fontWeight:700}}>Showing {filtered.length ? (page-1)*perPage+1 : 0}-{Math.min(page*perPage, filtered.length)} of {filtered.length} workshops • {likedIds.size} liked</div>
      <div style={{display:'flex', gap:'6px'}}><button className="av-page-btn" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}><i className="bi bi-chevron-left"></i></button>{Array.from({length:totalPages},(_,i)=>i+1).slice(Math.max(0, page-3), Math.max(0, page-3)+5).map(p=><button key={p} className={`av-page-btn ${page===p?"active":""}`} onClick={()=>setPage(p)}>{p}</button>)}<button className="av-page-btn" disabled={page===totalPages||totalPages===0} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}><i className="bi bi-chevron-right"></i></button></div>
    </div>
    </>
    )}
    </>
    )}

    {showDetail && selected && (
      <div className="modal-overlay" onClick={()=>setShowDetail(false)}>
        <div className="modal-pro" onClick={e=>e.stopPropagation()}>
          <div style={{height:'230px', backgroundImage:`url(${selected.image})`, backgroundSize:'cover', backgroundPosition:'center', position:'relative'}}>
            <button onClick={()=>setShowDetail(false)} style={{position:'absolute', top:'14px', right:'14px', zIndex:3, width:'40px', height:'40px', borderRadius:'50%', background:'rgba(255,255,255,0.9)', border:'none', display:'grid', placeItems:'center'}}><i className="bi bi-x-lg"></i></button>
            <div style={{position:'absolute', inset:0, background:'linear-gradient(to top, #0A192F 12%, rgba(10,25,47,0.4))'}}></div>
            <div style={{position:'absolute', bottom:'14px', left:'18px', right:'18px', zIndex:2}}>
              <div style={{display:'flex', gap:'8px', marginBottom:'8px', flexWrap:'wrap'}}><span style={{background:'#22C55E', color:'#fff', fontSize:'11px', fontWeight:900, padding:'5px 10px', borderRadius:'20px'}}><i className="bi bi-patch-check-fill me-1"></i>VERIFIED</span><span style={{background:'#FBBF24', color:'#000', fontSize:'11px', fontWeight:900, padding:'5px 10px', borderRadius:'20px'}}><i className="bi bi-star-fill me-1"></i>{selected.rating} • {selected.reviews} reviews</span><span style={{background:'rgba(0,0,0,0.5)', color:'#fff', fontSize:'12px', fontWeight:800, padding:'5px 10px', borderRadius:'20px'}}><i className="bi bi-heart-fill me-1" style={{color:'#EF4444'}}></i>{selected.likes} likes</span></div>
              <h3 style={{color:'#fff', fontWeight:900, margin:0, fontSize:'26px'}}>{selected.name}</h3>
              <div style={{color:'rgba(255,255,255,0.9)', fontSize:'13px', marginTop:'4px'}}><i className="bi bi-geo-alt-fill me-1"></i>{selected.address}</div>
            </div>
          </div>
          <div style={{padding:'20px', display:'grid', gap:'16px'}}>
            <div className="row g-3">
              <div className="col-6"><div style={{background:C.soft, border:`1px solid ${C.cardBorder}`, borderRadius:'12px', padding:'14px'}}><div style={{fontSize:'11px', fontWeight:800, color:C.muted}}><i className="bi bi-telephone me-1"></i>PHONE</div><div style={{fontWeight:800, color:C.text, marginTop:'4px', fontSize:'15px'}}>{selected.phone || "—"}</div></div></div>
              <div className="col-6"><div style={{background:C.soft, border:`1px solid ${C.cardBorder}`, borderRadius:'12px', padding:'14px'}}><div style={{fontSize:'11px', fontWeight:800, color:C.muted}}><i className="bi bi-envelope me-1"></i>EMAIL</div><div style={{fontWeight:700, color:C.text, fontSize:'13px'}}>{selected.email || "—"}</div></div></div>
            </div>
            <div style={{display:'flex', gap:'10px'}}><button onClick={()=>toggleLike(selected.id)} className={`like-btn ${likedIds.has(selected.id)?'liked':''}`} style={{flex:'0 0 auto', height:'48px', padding:'0 18px', fontSize:'14px'}}><i className={`bi ${likedIds.has(selected.id)?'bi-heart-fill':'bi-heart'}`}></i>{selected.likes} Likes</button><button className="btn btn-dark" style={{flex:1, height:'48px', borderRadius:'12px', fontWeight:900, fontSize:'14px'}} onClick={()=>{setShowDetail(false); setTimeout(()=>openBook(selected),150)}}><i className="bi bi-calendar-plus me-1"></i>Book Now</button></div>
            <p style={{fontSize:'14px', color:C.muted, lineHeight:1.6}}>{selected.about} • {selected.jobs} jobs • {selected.price}</p>
          </div>
        </div>
      </div>
    )}

    {showBook && selected && (
      <div className="modal-overlay" onClick={()=>setShowBook(false)}>
        <div className="modal-pro" style={{maxWidth:'520px'}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:'20px 22px 0', display:'flex', gap:'12px', alignItems:'start'}}>
            <div style={{width:'44px', height:'44px', borderRadius:'12px', background:'#0A192F', color:'#fff', display:'grid', placeItems:'center'}}><i className="bi bi-calendar-plus"></i></div>
            <div style={{flex:1}}><h4 style={{fontWeight:900, margin:0, color:C.text, fontSize:'18px'}}>Book {selected.name}</h4><p style={{fontSize:'13px', color:C.muted, margin:'2px 0 0'}}><i className="bi bi-heart-fill me-1" style={{color:'#EF4444'}}></i>{selected.likes} likes • {selected.location}</p></div>
            <button onClick={()=>setShowBook(false)} style={{width:'36px', height:'36px', borderRadius:'10px', border:`1.5px solid ${C.cardBorder}`, background:C.soft, display:'grid', placeItems:'center'}}><i className="bi bi-x-lg"></i></button>
          </div>
          <div style={{padding:'18px 22px 22px'}}>
            <form onSubmit={handleBook}>
              <div style={{display:'grid', gap:'12px'}}>
                <div><label style={{fontSize:'12px', fontWeight:800, color:C.muted}}>YOUR CAR</label><select className="ws-select" style={{width:'100%', height:'48px'}} value={bookForm.carId} onChange={e=>setBookForm({...bookForm, carId:e.target.value})}>{cars.length===0 ? <option value="">No cars yet — add one in My Garage</option> : cars.map(c=><option key={c.id} value={c.id}>{c.make} {c.model} {c.year} • {c.plate}</option>)}</select></div>
                <div><label style={{fontSize:'12px', fontWeight:800, color:C.muted}}>SERVICE</label><select className="ws-select" style={{width:'100%', height:'48px'}} value={bookForm.service} onChange={e=>setBookForm({...bookForm, service:e.target.value})}>{(selected.services||["Oil Change"]).map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                <div className="row g-2"><div className="col-6"><label style={{fontSize:'12px', fontWeight:800, color:C.muted}}>DATE</label><input required type="date" className="ws-select" style={{width:'100%'}} value={bookForm.date} onChange={e=>setBookForm({...bookForm, date:e.target.value})} /></div><div className="col-6"><label style={{fontSize:'12px', fontWeight:800, color:C.muted}}>TIME</label><select className="ws-select" style={{width:'100%'}} value={bookForm.time} onChange={e=>setBookForm({...bookForm, time:e.target.value})}><option>9:00 AM</option><option>10:00 AM</option><option>1:00 PM</option></select></div></div>
                <div><label style={{fontSize:'12px', fontWeight:800, color:C.muted}}>NOTE</label><input className="ws-select" style={{width:'100%'}} placeholder="Describe issue..." value={bookForm.note} onChange={e=>setBookForm({...bookForm, note:e.target.value})} /></div>
              </div>
              <button type="submit" disabled={booking} className="btn btn-dark w-100 mt-3" style={{height:'50px', borderRadius:'12px', fontWeight:900, fontSize:'15px'}}><i className="bi bi-check2-circle me-1"></i>{booking ? "Booking..." : "Confirm Booking"}</button>
            </form>
          </div>
        </div>
      </div>
    )}
    </>
  );
}