export default function PricingPage({ navToAuth, changeView }) {
  return (
    <section className="section-padding" style={{ paddingTop: '120px', background: '#FCFCF9', minHeight: '100vh' }}>
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 48px' }}>
          <span className="section-tag"><i className="bi bi-tag me-1"></i>PRICING • NO COMMISSION • CA COMPLIANT</span>
          <h1 style={{ fontSize: 'clamp(36px,6vw,64px)', fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 0.9, marginTop: '16px' }}>Pricing built for<br />real garages.</h1>
          <p style={{ color: '#6B7A90', marginTop: '16px', fontSize: '18px' }}>Pay to be discovered. Keep 100% of your job revenue. We never take a cut. Cancel anytime per California Auto-Renewal Law.</p>
        </div>

        <div className="pricing-grid">
          <div className="price-card">
            <div className="price-top"><h4>Starter Trial</h4><span className="price-duration">1 Week Free</span></div>
            <div className="price-value"><span className="curr">$</span>0</div>
            <p className="price-desc">Test AutoVille with real customer leads. No card needed.</p>
            <ul className="price-features">
              <li><i className="bi bi-check2"></i> 1 workshop profile</li>
              <li><i className="bi bi-check2"></i> Up to 5 leads</li>
              <li><i className="bi bi-check2"></i> Basic analytics</li>
              <li className="disabled"><i className="bi bi-x"></i> No top placement</li>
              <li className="disabled"><i className="bi bi-x"></i> No WhatsApp integration</li>
            </ul>
            <button className="price-btn outline" onClick={() => navToAuth("workshop")}><i className="bi bi-gift me-1"></i>Start Free Trial</button>
            <span className="price-note">No credit card • 7 days only</span>
          </div>

          <div className="price-card">
            <div className="price-top"><h4>Monthly</h4><span className="price-duration">Billed monthly</span></div>
            <div className="price-value"><span className="curr">$</span>40<span className="per">/month</span></div>
            <p className="price-desc">For small garages starting to get online in LA.</p>
            <ul className="price-features">
              <li><i className="bi bi-check2"></i> Unlimited leads</li>
              <li><i className="bi bi-check2"></i> Verified badge</li>
              <li><i className="bi bi-check2"></i> Booking management dashboard</li>
              <li><i className="bi bi-check2"></i> Priority support</li>
              <li><i className="bi bi-check2"></i> Customer reviews & ratings</li>
            </ul>
            <button className="price-btn" onClick={() => navToAuth("workshop")}>Go Monthly</button>
            <span className="price-note">Cancel anytime • No contract</span>
          </div>

          <div className="price-card popular">
            <div className="popular-badge"><i className="bi bi-star-fill me-1"></i>MOST POPULAR • SAVE 17%</div>
            <div className="price-top"><h4>Quarterly</h4><span className="price-duration">3 Months • Best value</span></div>
            <div className="price-value"><span className="curr">$</span>100<span className="per">/quarter</span></div>
            <p className="price-desc">Most workshops choose this to grow fast across California & US.</p>
            <ul className="price-features">
              <li><i className="bi bi-check2"></i> Unlimited leads</li>
              <li><i className="bi bi-check2"></i> Top search placement</li>
              <li><i className="bi bi-check2"></i> WhatsApp integration</li>
              <li><i className="bi bi-check2"></i> Monthly growth report</li>
              <li><i className="bi bi-check2"></i> Promotion in socials</li>
              <li><i className="bi bi-check2"></i> Cancel anytime</li>
            </ul>
            <button className="price-btn primary" onClick={() => navToAuth("workshop")}>Go Quarterly <i className="bi bi-arrow-right ms-1"></i></button>
            <span className="price-note">That's $33.3 / month</span>
          </div>

          <div className="price-card">
            <div className="price-top"><h4>Annual</h4><span className="price-duration">12 Months</span></div>
            <div className="price-value"><span className="curr">$</span>300<span className="per">/year</span></div>
            <p className="price-desc">For established shops that want to dominate Los Angeles & US.</p>
            <ul className="price-features">
              <li><i className="bi bi-check2"></i> Everything in Quarterly</li>
              <li><i className="bi bi-check2"></i> Homepage featured slot</li>
              <li><i className="bi bi-check2"></i> Dedicated account manager</li>
              <li><i className="bi bi-check2"></i> Free shop photoshoot</li>
              <li><i className="bi bi-check2"></i> Priority dispute resolution</li>
              <li><i className="bi bi-check2"></i> API access</li>
            </ul>
            <button className="price-btn" onClick={() => navToAuth("workshop")}>Go Annual</button>
            <span className="price-note">Save 37% vs monthly • $25/mo</span>
          </div>
        </div>

        <div style={{ marginTop: '72px', background: '#fff', border: '1.5px solid #0A192F', borderRadius: '20px', overflow: 'hidden' }}>
          <div style={{ padding: '24px', borderBottom: '1.5px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h5 style={{ margin: 0, fontWeight: 800 }}><i className="bi bi-table me-2"></i>Compare All Plans</h5>
            <span style={{ fontSize: '12px', color: '#6B7A90' }}><i className="bi bi-info-circle me-1"></i>All prices USD • California taxes may apply</span>
          </div>
          <div className="table-responsive">
            <table className="table mb-0" style={{ fontSize: '14px' }}>
              <thead><tr><th>Feature</th><th>Free</th><th>Monthly $40</th><th>Quarterly $100</th><th>Annual $300</th></tr></thead>
              <tbody>
                <tr><td>Leads per month</td><td>5</td><td>Unlimited</td><td>Unlimited</td><td>Unlimited</td></tr>
                <tr><td>Verified badge</td><td><i className="bi bi-x text-muted"></i></td><td><i className="bi bi-check2" style={{ color: '#22C55E' }}></i></td><td><i className="bi bi-check2" style={{ color: '#22C55E' }}></i></td><td><i className="bi bi-check2" style={{ color: '#22C55E' }}></i></td></tr>
                <tr><td>Top search</td><td><i className="bi bi-x text-muted"></i></td><td><i className="bi bi-x text-muted"></i></td><td><i className="bi bi-check2" style={{ color: '#22C55E' }}></i></td><td><i className="bi bi-check2" style={{ color: '#22C55E' }}></i></td></tr>
                <tr><td>WhatsApp + SMS</td><td><i className="bi bi-x text-muted"></i></td><td><i className="bi bi-check2" style={{ color: '#22C55E' }}></i></td><td><i className="bi bi-check2" style={{ color: '#22C55E' }}></i></td><td><i className="bi bi-check2" style={{ color: '#22C55E' }}></i></td></tr>
                <tr><td>Homepage featured</td><td><i className="bi bi-x text-muted"></i></td><td><i className="bi bi-x text-muted"></i></td><td><i className="bi bi-x text-muted"></i></td><td><i className="bi bi-check2" style={{ color: '#22C55E' }}></i></td></tr>
                <tr><td>Support</td><td>Email</td><td>Priority</td><td>Priority</td><td>Dedicated manager</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '48px' }}>
          <p style={{ color: '#6B7A90', fontSize: '14px' }}><i className="bi bi-shield-check me-1"></i>All plans covered by California Auto-Renewal Law • Cancel in 1 click • Receipt to your email</p>
          <p style={{ color: '#6B7A90', fontSize: '13px' }}>Product of Ayinde Technologies • 112 S Market St, Ste. 1008, Inglewood, CA 90301 • Support: Peter +1-201-534-2657</p>
          <button className="btn btn-dark mt-3" style={{ borderRadius: '12px', padding: '14px 28px', fontWeight: 700 }} onClick={() => changeView("contact")}><i className="bi bi-chat-dots me-2"></i>Talk to Peter</button>
        </div>
      </div>
    </section>
  );
}