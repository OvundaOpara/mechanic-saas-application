import { useState, useMemo, useEffect } from "react";

export default function AdminAnalytics(){
  const [range,setRange]=useState("6M");
  const [monthlyData,setMonthlyData]=useState([]);
  const [topWorkshops,setTopWorkshops]=useState([]);
  const [totals,setTotals]=useState({bookings:0, income:0, exp:0, profit:0, owners:0, workshops:0, mrr:0, avgRating:0, growth:0});
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    setLoading(true);
    fetch(`http://127.0.0.1:5000/api/admin/analytics?range=${range}`)
      .then(r=>r.json())
      .then(d=>{
        setMonthlyData(d.monthly || []);
        setTopWorkshops(d.topWorkshops || []);
        setTotals(d.totals || {bookings:0, income:0, exp:0, profit:0, owners:0, workshops:0, mrr:0, avgRating:0, growth:0});
        setLoading(false);
      })
      .catch(()=> setLoading(false));
  },[range]);

  const totalBookings = totals.bookings;
  const totalIncome = totals.income;
  const totalExp = totals.exp;
  const totalProfit = totals.profit;
  const mrr = totals.mrr;

  const maxBooking = Math.max(1, ...monthlyData.map(d=>d.bookings));
  const maxIncome = Math.max(1, ...monthlyData.map(d=>d.income));
  const maxOwners = Math.max(1, ...monthlyData.map(d=>d.owners));
  const maxWs = Math.max(1, ...monthlyData.map(d=>d.workshops));

  return (
    <div style={{display:"grid", gap:"16px", fontSize:"15px"}}>
      <style>{`
        .owner-card{ background:#fff; border:1.5px solid #E2E8F0; border-radius:18px; padding:18px; }
        .bar-col{ display:flex; flex-direction:column; align-items:center; gap:6px; flex:1; }
        .bar{ width:100%; border-radius:10px 10px 4px 4px; min-height:8px; position:relative; transition:height 0.3s; }
      `}</style>

      <div className="row g-3" style={{margin:0, width:"100%"}}>
        <div className="col-6 col-lg-3"><div style={{background:"#0A192F", borderRadius:"18px", padding:"18px", color:"#fff"}}><div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>TOTAL BOOKINGS • {range}</div><div style={{fontSize:"32px", fontWeight:900}}>{loading ? "..." : totalBookings}</div><div style={{fontSize:"12px", color:"#22C55E"}}>{totals.growth>=0 ? "↑" : "↓"} {totals.growth}% MoM • LA County</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#DCFCE7", borderColor:"#BBF7D0"}}><div style={{fontSize:"11px", fontWeight:800, color:"#166534"}}>INCOME • SUBS • ZERO COMM</div><div style={{fontSize:"28px", fontWeight:900, color:"#166534"}}>${totalIncome.toLocaleString()}</div><div style={{fontSize:"12px", color:"#16A34A"}}>MRR ${mrr.toLocaleString()} • $40/$100/$300</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card" style={{background:"#FEF2F2", borderColor:"#FECACA"}}><div style={{fontSize:"11px", fontWeight:800, color:"#991B1B"}}>EXPENDITURE • AUDIT</div><div style={{fontSize:"28px", fontWeight:900, color:"#991B1B"}}>${totalExp.toLocaleString()}</div><div style={{fontSize:"12px", color:"#DC2626"}}>P/L ${totalProfit.toLocaleString()} • Margin {totalIncome ? ((totalProfit/totalIncome)*100).toFixed(1) : "0.0"}%</div></div></div>
        <div className="col-6 col-lg-3"><div className="owner-card"><div style={{fontSize:"11px", fontWeight:800, color:"#64748B"}}>OWNERS + WORKSHOPS</div><div style={{fontSize:"20px", fontWeight:900, color:"#0A192F"}}>{totals.owners} owners</div><div style={{fontSize:"12px", color:"#64748B"}}>{totals.workshops} workshops • Avg {totals.avgRating}★</div></div></div>
      </div>

      <div className="row g-3" style={{margin:0, width:"100%"}}>
        <div className="col-12 col-lg-8">
          <div className="owner-card" style={{padding:"20px"}}>
            <div style={{display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:"10px", marginBottom:"16px"}}>
              <div><div style={{fontWeight:900, fontSize:"18px"}}><i className="bi bi-graph-up me-2"></i>Bookings Trend • {range}</div><div style={{fontSize:"13px", color:"#64748B"}}>{totalBookings} bookings • Avg {monthlyData.length ? (totalBookings/monthlyData.length).toFixed(0) : 0}/mo • PST • Real DB</div></div>
              <div style={{display:"flex", gap:"6px"}}>{["1M","3M","6M","1Y"].map(r=><button key={r} onClick={()=>setRange(r)} style={{height:"36px", padding:"0 14px", borderRadius:"10px", border:"1.5px solid #E2E8F0", background: range===r ? "#0A192F" : "#fff", color: range===r ? "#fff" : "#0A192F", fontWeight:800, fontSize:"12px"}}>{r}</button>)}</div>
            </div>
            <div style={{display:"flex", gap:"10px", alignItems:"flex-end", height:"160px", padding:"10px", background:"#F8FAFC", borderRadius:"14px", border:"1.5px solid #E2E8F0"}}>
              {monthlyData.map(d=>{
                var h = (d.bookings / maxBooking)*100;
                return (
                  <div key={d.month+d.year} className="bar-col">
                    <div style={{fontSize:"11px", fontWeight:800}}>{d.bookings}</div>
                    <div className="bar" style={{height: Math.max(h, 4)+"%", background:"#0A192F"}}></div>
                    <div style={{fontSize:"11px", fontWeight:700, color:"#64748B"}}>{d.month}</div>
                  </div>
                );
              })}
              {monthlyData.length===0 && !loading && <div style={{width:"100%", textAlign:"center", color:"#94A3B8"}}>No bookings yet in this range.</div>}
            </div>
            <div style={{display:"flex", gap:"8px", marginTop:"12px", flexWrap:"wrap"}}>
              <span style={{background:"#F1F5F9", border:"1px solid #E2E8F0", padding:"5px 12px", borderRadius:"20px", fontSize:"12px", fontWeight:700}}><span style={{display:"inline-block", width:"10px", height:"10px", background:"#0A192F", borderRadius:"3px", marginRight:"6px"}}></span>Bookings • Zero commission</span>
              <span style={{fontSize:"12px", color:"#94A3B8", fontWeight:600}}>112 S Market St Inglewood CA 90301 • BAR log • PST</span>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-4">
          <div className="owner-card" style={{padding:"20px"}}>
            <div style={{fontWeight:900, fontSize:"16px", marginBottom:"12px"}}><i className="bi bi-currency-dollar me-2"></i>Income vs Expenditure</div>
            <div style={{display:"flex", gap:"12px", alignItems:"flex-end", height:"160px", padding:"10px", background:"#F8FAFC", borderRadius:"14px", border:"1.5px solid #E2E8F0"}}>
              {monthlyData.map(d=>{
                var hi = (d.income / maxIncome)*100;
                var he = (d.exp / maxIncome)*100;
                return (
                  <div key={d.month+d.year} className="bar-col">
                    <div style={{display:"flex", gap:"4px", alignItems:"flex-end", width:"100%", justifyContent:"center", height:"100px"}}>
                      <div style={{width:"12px", height: Math.max(hi,4)+"%", background:"#22C55E", borderRadius:"4px"}}></div>
                      <div style={{width:"12px", height: Math.max(he,4)+"%", background:"#EF4444", borderRadius:"4px"}}></div>
                    </div>
                    <div style={{fontSize:"11px", fontWeight:700, color:"#64748B"}}>{d.month}</div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex", gap:"8px", marginTop:"12px"}}>
              <span style={{background:"#DCFCE7", border:"1px solid #BBF7D0", padding:"4px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:800, color:"#166534"}}>Income ${totalIncome.toLocaleString()}</span>
              <span style={{background:"#FEF2F2", border:"1px solid #FECACA", padding:"4px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:800, color:"#991B1B"}}>Exp ${totalExp.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3" style={{margin:0, width:"100%"}}>
        <div className="col-12 col-lg-7">
          <div className="owner-card" style={{padding:"20px"}}>
            <div style={{fontWeight:900, fontSize:"16px", marginBottom:"14px"}}><i className="bi bi-trophy me-2"></i>Top Workshops • By Bookings • Real DB</div>
            <div style={{display:"grid", gap:"10px"}}>
              {topWorkshops.map((w,i)=>{
                var pct = topWorkshops.length ? (w.bookings / Math.max(1, topWorkshops[0].bookings))*100 : 0;
                return (
                  <div key={w.name} style={{display:"flex", gap:"12px", alignItems:"center", background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"12px"}}>
                    <div style={{width:"28px", height:"28px", borderRadius:"8px", background:"#0A192F", color:"#fff", display:"grid", placeItems:"center", fontWeight:900, fontSize:"12px"}}>#{i+1}</div>
                    <img src={w.logo} alt="" style={{width:"40px", height:"40px", borderRadius:"10px", objectFit:"cover", border:"1.5px solid #E2E8F0"}} />
                    <div style={{flex:1}}>
                      <div style={{display:"flex", justifyContent:"space-between"}}><span style={{fontWeight:800, fontSize:"13px"}}>{w.name}</span><span style={{fontSize:"11px", fontWeight:800, color:"#64748B"}}>{w.bar} • {w.rating} <i className="bi bi-star-fill" style={{color:"#F59E0B"}}></i></span></div>
                      <div style={{height:"8px", background:"#E2E8F0", borderRadius:"20px", marginTop:"6px", overflow:"hidden"}}><div style={{width:pct+"%", height:"100%", background:"#0A192F", borderRadius:"20px"}}></div></div>
                      <div style={{display:"flex", justifyContent:"space-between", marginTop:"4px"}}><span style={{fontSize:"11px", color:"#64748B"}}>{w.bookings} bookings • LA</span><span style={{fontSize:"11px", fontWeight:800, color:"#166534"}}>${w.revenue.toLocaleString()} subs</span></div>
                    </div>
                  </div>
                );
              })}
              {topWorkshops.length===0 && !loading && <div style={{padding:12, textAlign:"center", color:"#94A3B8"}}>No workshop bookings yet.</div>}
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-5">
          <div className="owner-card" style={{padding:"20px", display:"grid", gap:"14px"}}>
            <div style={{fontWeight:900, fontSize:"16px"}}><i className="bi bi-geo-alt me-2"></i>Platform Growth • LA County • PST</div>
            <div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"14px"}}>
              <div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8", marginBottom:"8px"}}>OWNERS GROWTH</div>
              <div style={{display:"flex", gap:"8px", alignItems:"flex-end", height:"80px"}}>
                {monthlyData.map(d=>{
                  var h = (d.owners / maxOwners)*100;
                  return <div key={d.month+d.year} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:"4px"}}><div style={{width:"100%", height: Math.max(h,4)+"%", background:"#3B82F6", borderRadius:"6px 6px 3px 3px"}}></div><span style={{fontSize:"10px", fontWeight:700, color:"#64748B"}}>{d.month}</span></div>
                })}
              </div>
            </div>
            <div style={{background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"14px", padding:"14px"}}>
              <div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8", marginBottom:"8px"}}>WORKSHOPS ONBOARDED</div>
              <div style={{display:"flex", gap:"8px", alignItems:"flex-end", height:"80px"}}>
                {monthlyData.map(d=>{
                  var h = (d.workshops / maxWs)*100;
                  return <div key={d.month+d.year} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:"4px"}}><div style={{width:"100%", height: Math.max(h,4)+"%", background:"#0A192F", borderRadius:"6px 6px 3px 3px"}}></div><span style={{fontSize:"10px", fontWeight:700, color:"#64748B"}}>{d.month}</span><span style={{fontSize:"9px", fontWeight:800}}>{d.workshops}</span></div>
                })}
              </div>
            </div>
            <div className="row g-2" style={{margin:0, width:"100%"}}>
              <div className="col-6"><div style={{background:"#EFF6FF", border:"1.5px solid #DBEAFE", borderRadius:"12px", padding:"12px"}}><div style={{fontSize:"10px", fontWeight:800, color:"#1E40AF"}}>SUB PLANS</div><div style={{fontSize:"13px", fontWeight:900}}>M $40 • Q $100 • A $300</div><div style={{fontSize:"11px", color:"#3B82F6"}}>Zero commission</div></div></div>
              <div className="col-6"><div style={{background:"#DCFCE7", border:"1.5px solid #BBF7D0", borderRadius:"12px", padding:"12px"}}><div style={{fontSize:"10px", fontWeight:800, color:"#166534"}}>BAR COMPLIANCE</div><div style={{fontSize:"13px", fontWeight:900}}>{totals.workshops} Verified</div><div style={{fontSize:"11px", color:"#16A34A"}}>112 S Market St</div></div></div>
            </div>
            <div style={{background:"#0A192F", borderRadius:"14px", padding:"14px", color:"#fff"}}>
              <div style={{fontSize:"11px", fontWeight:800, color:"#94A3B8"}}>KEY INSIGHTS • PST • AUDIT • REAL</div>
              <div style={{display:"grid", gap:"6px", marginTop:"8px", fontSize:"12px", fontWeight:600, color:"#CBD5E1"}}>
                <div>• Bookings {totals.growth>=0 ? "↑" : "↓"} {totals.growth}% MoM • Inglewood CA 90301</div>
                <div>• MRR ${mrr.toLocaleString()} • Annual plan best margin</div>
                <div>• Avg rating {totals.avgRating}★ • {totals.workshops} workshops</div>
                <div>• Zero commission • Subs only revenue</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="owner-card" style={{padding:"20px"}}>
        <div style={{fontWeight:900, fontSize:"16px", marginBottom:"12px"}}><i className="bi bi-table me-2"></i>Monthly Breakdown • LA • Immutable Audit</div>
        <div style={{overflowX:"auto", borderRadius:"14px", border:"1.5px solid #E2E8F0"}}>
          <table className="table" style={{margin:0, fontSize:"14px"}}>
            <thead><tr><th style={{background:"#F8FAFC", fontSize:"11px"}}>Month</th><th style={{background:"#F8FAFC"}}>Bookings</th><th style={{background:"#F8FAFC"}}>Income (Subs)</th><th style={{background:"#F8FAFC"}}>Expenditure</th><th style={{background:"#F8FAFC"}}>P/L</th><th style={{background:"#F8FAFC"}}>Margin</th><th style={{background:"#F8FAFC"}}>Owners New</th><th style={{background:"#F8FAFC"}}>Workshops New</th></tr></thead>
            <tbody>
              {monthlyData.map(d=>{
                var pl = d.income - d.exp;
                var margin = d.income ? ((pl / d.income)*100).toFixed(1) : "0.0";
                return <tr key={d.month+d.year}><td style={{fontWeight:900}}>{d.month} {d.year}</td><td style={{fontWeight:700}}>{d.bookings}</td><td style={{fontWeight:800, color:"#166534"}}>${d.income.toLocaleString()}</td><td style={{color:"#991B1B", fontWeight:700}}>${d.exp.toLocaleString()}</td><td style={{fontWeight:900, color: pl>=0 ? "#0A192F" : "#991B1B"}}>${pl.toLocaleString()}</td><td><span style={{background: parseFloat(margin)>=20 ? "#DCFCE7" : "#FEF3C7", color: parseFloat(margin)>=20 ? "#166534" : "#92400E", padding:"4px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:800}}>{margin}%</span></td><td>{d.owners}</td><td>{d.workshops}</td></tr>
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}