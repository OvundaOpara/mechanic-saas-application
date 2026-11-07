import { useState } from "react";
import Swal from "sweetalert2";

export default function ContactPage({ changeView }) {
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", service: "", message: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!agreed) {
      Swal.fire({ icon: 'warning', title: 'Terms Required', text: 'Please accept Terms & Privacy to continue.' });
      return;
    }
    Swal.fire({ icon: 'success', title: 'Message Sent!', text: 'We will reply in 2 mins during business hours - PT 9am-6pm', confirmButtonColor: '#0A192F' });
  };

  return (
    <section className="contact-pro">
      <div className="container">
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
          <div style={{ marginBottom: '24px' }}>
            <span className="section-tag"><i className="bi bi-envelope me-2"></i>CONTACT US • RESPONSE IN 2 MINS</span>
            <h1 style={{ fontSize: 'clamp(32px,5vw,52px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.9, marginTop: '12px' }}>Let's talk about<br />your car.</h1>
            <p style={{ color: '#6B7A90', marginTop: '12px', maxWidth: '520px' }}>For owners and workshops in Los Angeles, California and across the US. Average reply 2 minutes during PT business hours.</p>
          </div>

          <div className="contact-card">
            {/* LEFT FORM */}
            <div className="contact-left">
              <form onSubmit={handleSubmit}>
                <div className="row g-0">
                  <div className="col-md-6 pe-md-2">
                    <div className="floating-group">
                      <input type="text" placeholder=" " required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                      <label>Full Name</label>
                      <i className="bi bi-person"></i>
                    </div>
                  </div>
                  <div className="col-md-6 ps-md-2">
                    <div className="floating-group">
                      <input type="text" placeholder=" " required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                      <label>WhatsApp / Phone</label>
                      <i className="bi bi-telephone"></i>
                    </div>
                  </div>
                </div>

                <div className="floating-group">
                  <input type="email" placeholder=" " required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  <label>Email Address</label>
                  <i className="bi bi-envelope"></i>
                </div>

                <div className="floating-group">
                  <select required value={form.service} onChange={e => setForm({ ...form, service: e.target.value })} style={{ paddingLeft: '44px' }}>
                    <option value="" disabled hidden></option>
                    <option value="owner">I am a Vehicle Owner</option>
                    <option value="workshop">I own a Workshop</option>
                    <option value="billing">Billing / Subscription (CA ARL)</option>
                    <option value="support">Technical Support</option>
                  </select>
                  <label>How can we help?</label>
                  <i className="bi bi-tools"></i>
                </div>

                <div className="floating-group">
                  <textarea placeholder=" " required value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}></textarea>
                  <label>Tell us about your car or shop...</label>
                  <i className="bi bi-chat-dots"></i>
                </div>

                <div className="toggle-row">
                  <label className="toggle-switch">
                    <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </label>
                  <div className="toggle-text">
                    I agree to AutoVille <a href="/" onClick={(e) => { e.preventDefault(); changeView("terms") }}>Terms of Use</a> and <a href="/" onClick={(e) => { e.preventDefault(); changeView("privacy") }}>Privacy Policy</a> (CCPA). I consent to being contacted about my request.
                  </div>
                </div>

                <button type="submit" className="btn btn-primary btn-lg w-100" disabled={!agreed} style={{ borderRadius: '14px', height: '56px', opacity: agreed ? 1 : 0.5, fontWeight: 700 }}>
                  <i className="bi bi-send me-2"></i>Send Message
                </button>

                <div style={{ display: 'flex', gap: '12px', marginTop: '16px', fontSize: '12px', color: '#94A3B8', alignItems: 'center' }}>
                  <i className="bi bi-shield-lock"></i> <span>Protected by Ayinde Technologies • 112 S Market St, Inglewood, CA 90301</span>
                </div>
              </form>
            </div>

            {/* RIGHT IMAGE - hidden on mobile */}
            <div className="contact-right" style={{ backgroundImage: `url(https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=1200&q=80)` }}>
              <div className="contact-image-overlay"></div>
              <div className="contact-image-content">
                <div style={{ display: 'inline-flex', background: '#FF5722', color: '#fff', borderRadius: '20px', padding: '6px 12px', fontSize: '12px', fontWeight: 700 }}><i className="bi bi-lightning-charge me-1"></i>LIVE IN LOS ANGELES</div>
                <h3 style={{ fontWeight: 800, color: 'yellow', fontSize: '28px', lineHeight: 1, marginTop: '16px' }}>Real mechanics.<br />Real time tracking.</h3>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginTop: '10px' }}>Join 2,400+ owners who stopped the trial-and-error. Verified shops, BAR-checked in California.</p>

                <div className="contact-badge">
                  <div style={{ width: '40px', height: '40px', background: '#fff', borderRadius: '10px', display: 'grid', placeItems: 'center', color: '#0A192F' }}><i className="bi bi-geo-alt-fill"></i></div>
                  <div><div style={{ fontWeight: 700, fontSize: '13px' }}>Home Service Available</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>DTLA • Hollywood • Inglewood • Santa Monica</div></div>
                </div>
                <div className="contact-badge">
                  <div style={{ width: '40px', height: '40px', background: '#fff', borderRadius: '10px', display: 'grid', placeItems: 'center', color: '#0A192F' }}><i className="bi bi-patch-check-fill"></i></div>
                  <div><div style={{ fontWeight: 700, fontSize: '13px' }}>62% Pass Verification</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>CAC • BAR • Address • Tools checked</div></div>
                </div>
                <div className="contact-badge">
                  <div style={{ width: '40px', height: '40px', background: '#fff', borderRadius: '10px', display: 'grid', placeItems: 'center', color: '#0A192F' }}><i className="bi bi-telephone-fill"></i></div>
                  <div><div style={{ fontWeight: 700, fontSize: '13px' }}>Support • Peter</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>+1-201-534-2657 • support@ayindetechnologies.com</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}