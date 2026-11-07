export default function HelpPage({ changeView, setAuthRole }) {
  return (
    <section style={{ paddingTop: '100px', background: '#FCFCF9', minHeight: '100vh' }}>
      <div className="container">
        <div style={{ background: '#0A192F', borderRadius: '28px', padding: 'clamp(28px,5vw,56px)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
          <div style={{ maxWidth: '720px', position: 'relative', zIndex: 2 }}>
            <span className="section-tag" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}><i className="bi bi-life-preserver me-2"></i>HELP CENTER • LIVE FROM LA • AVG REPLY 2 MINS</span>
            <h1 style={{ fontSize: 'clamp(36px,5vw,58px)', fontWeight: 800, lineHeight: 0.9, letterSpacing: '-0.04em', marginTop: '16px' }}>How can we<br />help you?</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '16px', marginTop: '16px', maxWidth: '520px' }}>Search booking, billing, verification, or California BAR requirements. For Los Angeles, California, and all US.</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '28px', background: '#fff', borderRadius: '14px', padding: '8px', maxWidth: '560px' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '12px' }}>
                <i className="bi bi-search" style={{ color: '#6B7A90' }}></i>
                <input placeholder="Search - BAR license, cancel subscription, home service LA" style={{ border: 'none', outline: 'none', width: '100%', fontSize: '15px' }} />
              </div>
              <button className="btn btn-primary" style={{ borderRadius: '10px', padding: '10px 22px' }}><i className="bi bi-search me-1"></i>Search</button>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>POPULAR:</span>
              {['Cancel CA', 'BAR verification', 'Home service LA', 'Get first lead', 'Refund'].map(t => <button key={t} onClick={() => changeView("faq")} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '20px', padding: '4px 12px', fontSize: '12px' }}>{t}</button>)}
            </div>
          </div>
          <div style={{ position: 'absolute', right: '-20px', top: '20px', fontSize: '200px', opacity: 0.05 }}><i className="bi bi-question-circle"></i></div>
        </div>

        <div className="row g-3" style={{ marginTop: '24px' }}>
          {[
            { icon: 'bi-chat-dots', t: 'Chat with us', d: '2 min avg reply - PT 9am-6pm', cta: 'Start chat', action: () => changeView("contact") },
            { icon: 'bi-geo-alt', t: 'Track booking', d: 'See mechanic ETA & job status', cta: 'Track now', action: () => { setAuthRole("owner"); changeView("auth") } },
            { icon: 'bi-credit-card', t: 'Manage subscription', d: 'Cancel per California ARL law', cta: 'Billing', action: () => changeView("pricing") },
          ].map(x => (
            <div key={x.t} className="col-md-4"><div className="card h-100 p-4" style={{ borderRadius: '20px', border: '1.5px solid #0A192F', cursor: 'pointer' }} onClick={x.action}><div style={{ width: '44px', height: '44px', background: '#F1F5F9', borderRadius: '12px', display: 'grid', placeItems: 'center' }}><i className={`bi ${x.icon}`} style={{ fontSize: '20px' }}></i></div><h5 style={{ fontWeight: 800, marginTop: '12px' }}>{x.t}</h5><p style={{ color: '#6B7A90', fontSize: '14px' }}>{x.d}</p><span style={{ fontWeight: 700, color: '#FF5722', fontSize: '14px' }}>{x.cta} <i className="bi bi-arrow-right"></i></span></div></div>
          ))}
        </div>

        <div className="row g-4" style={{ marginTop: '32px' }}>
          <div className="col-lg-8">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}><h3 style={{ fontWeight: 800 }}><i className="bi bi-grid me-2"></i>Browse by topic</h3><span style={{ fontSize: '13px', color: '#6B7A90' }}>52 articles • Updated for California 2025</span></div>

            <div className="card p-4 mb-3" style={{ borderRadius: '20px', border: '1.5px solid #0A192F' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}><span style={{ background: '#0A192F', color: '#fff', borderRadius: '10px', width: '36px', height: '36px', display: 'grid', placeItems: 'center' }}><i className="bi bi-person"></i></span><div><h5 style={{ margin: 0, fontWeight: 800 }}>For Vehicle Owners - US & Los Angeles</h5><p style={{ margin: 0, fontSize: '13px', color: '#6B7A90' }}>Booking, estimates, home service, payments</p></div></div>
              <div className="row g-2">
                {[
                  { ic: 'bi-search', t: 'How to book a workshop in Los Angeles', d: 'Find by ZIP (90028), brand, rating. Book in 60 seconds.' },
                  { ic: 'bi-file-earmark-text', t: 'Understanding your written estimate (CA law)', d: 'CA requires written estimate >$100. Approve extra work in app.' },
                  { ic: 'bi-house-door', t: 'Home Service explained - LA coverage', d: 'We cover DTLA, Hollywood, Santa Monica, Valley.' },
                  { ic: 'bi-broadcast', t: 'Live tracking - like Uber for your car', d: 'See "Mechanic started", "Parts ordered", "Ready".' },
                  { ic: 'bi-receipt', t: 'How payment & invoice works', d: 'Pay workshop via Stripe. Get BAR-compliant invoice.' },
                  { ic: 'bi-star', t: 'How ratings & $100 protection works', d: 'Rate only after verified job. Below 3.8 shop paused.' },
                  { ic: 'bi-exclamation-triangle', t: 'What if repair fails?', d: 'Contact within 72h. We mediate + $100 credit.' },
                  { ic: 'bi-car-front', t: 'Managing multiple cars & history', d: 'Add VIN, get reminders for oil, smog, registration.' },
                ].map(a => <div key={a.t} className="col-md-6"><div style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', gap: '10px' }}><i className={`bi ${a.ic}`} style={{ fontSize: '18px', marginTop: '2px' }}></i><div><div style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.3 }}>{a.t}</div><div style={{ fontSize: '12px', color: '#6B7A90', marginTop: '4px' }}>{a.d}</div></div></div></div>)}
              </div>
            </div>

            <div className="card p-4 mb-3" style={{ borderRadius: '20px', border: '1.5px solid #0A192F', background: '#0A192F', color: '#fff' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}><span style={{ background: '#FF5722', color: '#fff', borderRadius: '10px', width: '36px', height: '36px', display: 'grid', placeItems: 'center' }}><i className="bi bi-tools"></i></span><div><h5 style={{ margin: 0, fontWeight: 800, color: '#fff' }}>For Workshops - Growth without commission</h5><p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Verification, leads, billing, California BAR</p></div></div>
              <div className="row g-2">
                {[
                  { ic: 'bi-patch-check', t: 'How verification works - 62% pass', d: 'CAC, address, tools, 3 jobs. CA: BAR ARD required.' },
                  { ic: 'bi-lightning', t: 'How to get first lead in LA in 24-48h', d: 'Complete profile, add German/【entity-Toyota¦canonical_name=Toyota】 tags, WhatsApp.' },
                  { ic: 'bi-currency-dollar', t: 'Subscription: $40/$100/$300 - Zero commission', d: 'Keep 100%. Quarterly is popular - top placement.' },
                  { ic: 'bi-arrow-repeat', t: 'California Auto-Renewal Law compliance', d: 'We disclose price, frequency. Cancel: Dashboard > Billing.' },
                  { ic: 'bi-kanban', t: 'How to manage bookings & invoices', d: 'Accept, reschedule, add parts, mark done. BAR invoice.' },
                  { ic: 'bi-whatsapp', t: 'WhatsApp leads - close 2x faster', d: 'Leads go to WhatsApp. Reply in 5 mins = 3x booking.' },
                  { ic: 'bi-graph-up-arrow', t: 'How ranking works in Los Angeles', d: 'Verified + rating + response time + distance = rank.' },
                  { ic: 'bi-award', t: 'BAR license check - CA shops only', d: 'Upload BAR ARD #, we verify via BAR database.' },
                ].map(a => <div key={a.t} className="col-md-6"><div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.06)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '10px' }}><i className={`bi ${a.ic}`} style={{ fontSize: '18px', marginTop: '2px', color: '#fff' }}></i><div><div style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.3, color: '#fff' }}>{a.t}</div><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>{a.d}</div></div></div></div>)}
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="card p-4" style={{ borderRadius: '20px', border: '1.5px solid #0A192F', position: 'sticky', top: '100px' }}>
              <h6 style={{ fontWeight: 800 }}><i className="bi bi-headset me-2"></i>Contact Support</h6>
              <p style={{ fontSize: '13px', color: '#6B7A90' }}>LA team - 9am-6pm PT. Average 2 mins.</p>
              <div className="d-grid gap-2 mt-3">
                <button className="btn btn-primary" onClick={() => changeView("contact")}><i className="bi bi-chat-dots me-2"></i>Chat / Email Us</button>
                <button className="btn btn-outline-dark" onClick={() => window.open('tel:+12135550147')}><i className="bi bi-telephone me-2"></i>(213) 555-0147</button>
                <button className="btn btn-light" onClick={() => changeView("faq")}><i className="bi bi-question-circle me-2"></i>See FAQ</button>
              </div>
              <hr />
              <h6 style={{ fontWeight: 800, fontSize: '14px' }}><i className="bi bi-geo-alt me-1"></i>Popular in Los Angeles</h6>
              <div className="d-flex flex-column gap-2 mt-2">
                {['Smog check + repair shops in LA', 'German car specialist near 90028', 'Hybrid battery repair LA', 'Mobile mechanic Downtown LA'].map(q => <a key={q} href="/" onClick={(e) => { e.preventDefault(); changeView("workshops") }} style={{ fontSize: '13px', color: '#0A192F', textDecoration: 'none', cursor: 'pointer', fontWeight: 500 }}><i className="bi bi-arrow-right-short me-1"></i>{q}</a>)}
              </div>
              <hr />
              <div style={{ background: '#F1F5F9', borderRadius: '12px', padding: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800 }}><i className="bi bi-shield-lock me-1"></i>CALIFORNIA NOTICE</div>
                <div style={{ fontSize: '11px', color: '#6B7A90', marginTop: '4px' }}>For CA residents: Exercise CCPA rights at privacy@autoville.com. For BAR complaints, contact BAR at 800-952-5210 or bar.ca.gov</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}