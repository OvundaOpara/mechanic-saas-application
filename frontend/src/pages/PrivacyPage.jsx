export default function PrivacyPage() {
  return (
    <section className="section-padding" style={{ paddingTop: '120px', background: '#FCFCF9', minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: '880px' }}>
        <span className="section-tag"><i className="bi bi-shield-lock me-2"></i>LEGAL • PRIVACY POLICY • CALIFORNIA COMPLIANT</span>
        <h1 style={{ fontSize: 'clamp(36px,5vw,56px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.9, marginTop: '16px' }}>Privacy Policy</h1>
        <p style={{ color: '#6B7A90', margin: '12px 0 0' }}><i className="bi bi-calendar3 me-2"></i>Effective Date: November 3, 2025 • Last Updated: November 3, 2025</p>
        <p style={{ color: '#6B7A90', margin: '4px 0 32px' }}><i className="bi bi-geo-alt me-2"></i>Applies to all users in Los Angeles, California, and across the United States.</p>

        <div className="card p-4 p-md-5" style={{ borderRadius: '24px', border: '1.5px solid #0A192F', lineHeight: '1.85', fontSize: '15px' }}>

          <div style={{ background: '#F1F5F9', borderRadius: '16px', padding: '20px', marginBottom: '32px' }}>
            <strong><i className="bi bi-info-circle me-2"></i>Quick Summary:</strong> AutoVille is a marketplace connecting vehicle owners with verified mechanic workshops. We collect only what we need to book, verify, and track jobs. We <strong><i className="bi bi-x-circle me-1"></i>never sell your personal data for money</strong>. If you book a workshop in LA, we share your name/phone/car details with THAT workshop only - at your direction. You can request access, deletion, or opt-out anytime at privacy@ayindetechnologies.com
          </div>

          <h5><i className="bi bi-building me-2"></i>1. Who We Are & Scope</h5>
          <p className="text-muted">AutoVille is a product of Ayinde Technologies. This policy applies to all US residents, including enhanced rights for California residents under CCPA/CPRA and CalOPPA.</p>

          <h5><i className="bi bi-collection me-2"></i>2. Information We Collect</h5>
          <p className="text-muted"><i className="bi bi-person me-1"></i><strong>A. Owners:</strong> Full name, email, phone/WhatsApp, service address or ZIP, vehicle year/make/model/VIN (last 6), booking details, payment via Stripe (we don't store card numbers), reviews and photos.</p>
          <p className="text-muted"><i className="bi bi-tools me-1"></i><strong>B. Workshops:</strong> Business legal name, DBA, owner name, EIN last 4, CAC/Business License, proof of address, shop photos, BAR license in California, bank for payouts via Stripe Connect.</p>
          <p className="text-muted"><i className="bi bi-cpu me-1"></i><strong>C. Automatic:</strong> Device ID, IP, city/state (Los Angeles, CA), browser, pages viewed, search queries, booking actions, approximate location, cookies (see Sec 6).</p>

          <h5><i className="bi bi-table me-2"></i>3. CCPA Categories (Last 12 Months)</h5>
          <div className="table-responsive"><table className="table table-bordered" style={{ fontSize: '14px' }}>
            <thead><tr><th>Category</th><th>Collected?</th><th>Examples</th></tr></thead>
            <tbody>
              <tr><td>Identifiers</td><td>Yes</td><td>Name, email, phone, IP, address</td></tr>
              <tr><td>Commercial Info</td><td>Yes</td><td>Bookings, vehicles serviced</td></tr>
              <tr><td>Geolocation</td><td>Yes</td><td>Service address, shop location, city (LA)</td></tr>
              <tr><td>Internet Activity</td><td>Yes</td><td>Search history, clicks</td></tr>
              <tr><td>Professional</td><td>Yes (Workshops)</td><td>Business license, BAR #</td></tr>
              <tr><td>Sensitive Info</td><td>Limited</td><td>Precise location (with permission), financial account</td></tr>
            </tbody>
          </table></div>

          <h5><i className="bi bi-bullseye me-2"></i>4. How We Use</h5>
          <p className="text-muted">To match you with nearby verified workshops, verify workshops (BAR check), facilitate booking, live tracking, invoicing, send updates via email/SMS/WhatsApp, detect fraud, enforce rating quality, improve search, comply with CA law.</p>

          <h5><i className="bi bi-share me-2"></i>5. How We Share - No Sale For Money</h5>
          <ul className="text-muted">
            <li><strong>With the other party to your booking:</strong> When you book, we share your name, phone, address, car details with that workshop. At your direction - NOT a sale under CCPA.</li>
            <li><strong>Service Providers:</strong> Stripe, {"【entity-Google Cloud¦canonical_name=Google Cloud】"}, Twilio, {"【entity-Google Maps¦canonical_name=Google Maps】"}, analytics. Under contract.</li>
            <li><strong>Legal:</strong> If required by CA Attorney General, LAPD, court order, or to protect safety.</li>
            <li>We do NOT share with data brokers or for cross-context behavioral advertising.</li>
          </ul>

          <h5><i className="bi bi-cookie me-2"></i>6. Cookies & Tracking</h5>
          <p className="text-muted">Essential (login, booking), functional (remember LA location), analytics (aggregated). Block non-essential in browser. We honor Global Privacy Control (GPC) for CA residents.</p>

          <h5><i className="bi bi-clock-history me-2"></i>7. Data Retention</h5>
          <p className="text-muted">Owner accounts: until you delete + 90 days backups. Booking history: 4 years. Workshop verification docs: 2 years (BAR compliance). Messages: 2 years.</p>

          <h5><i className="bi bi-lock me-2"></i>8. Security</h5>
          <p className="text-muted">Encryption in transit (TLS), at rest, role-based access, 2FA for staff. Report suspected access to security@ayindetechnologies.com</p>

          <h5 style={{ color: '#FF5722' }}><i className="bi bi-shield-check me-2"></i>9. Your California Privacy Rights (CCPA/CPRA)</h5>
          <ul className="text-muted">
            <li><i className="bi bi-eye me-1"></i><strong>Right to Know:</strong> What categories and specific pieces collected in last 12 months.</li>
            <li><i className="bi bi-trash me-1"></i><strong>Right to Delete:</strong> Request deletion with legal exceptions.</li>
            <li><i className="bi bi-pencil-square me-1"></i><strong>Right to Correct:</strong> Fix inaccurate info.</li>
            <li><i className="bi bi-slash-circle me-1"></i><strong>Right to Opt-Out of Sale/Share:</strong> Email privacy@ayindetechnologies.com or enable GPC.</li>
            <li><i className="bi bi-sliders me-1"></i><strong>Right to Limit Sensitive Info:</strong> Precise location and financial data.</li>
            <li><i className="bi bi-hand-thumbs-up me-1"></i><strong>Right to Non-Discrimination:</strong> No denial or different price for exercising rights.</li>
          </ul>
          <p className="text-muted">Exercise: Email privacy@ayindetechnologies.com. We verify via email OTP + phone match. Response within 45 days.</p>

          <h5><i className="bi bi-globe-americas me-2"></i>10. Other US State Rights</h5>
          <p className="text-muted">VA, CO, CT, UT etc. have similar rights. Same method. Honored nationwide.</p>

          <h5><i className="bi bi-geo-alt-fill me-2"></i>11. Location Data</h5>
          <p className="text-muted">Precise location only to show nearest workshops and home-service dispatch. Disable anytime in phone settings.</p>

          <h5><i className="bi bi-people me-2"></i>12. Children's Privacy</h5>
          <p className="text-muted">Not for children under 16.</p>

          <h5><i className="bi bi-megaphone me-2"></i>13. Marketing Choices</h5>
          <p className="text-muted">Opt-out via unsubscribe or reply STOP. Booking-critical messages cannot be opted out while booking active.</p>

          <h5><i className="bi bi-arrow-clockwise me-2"></i>14. Changes</h5>
          <p className="text-muted">Material changes affecting CA rights get 30 days email + banner notice.</p>

          <h5><i className="bi bi-telephone me-2"></i>15. Contact</h5>
          <div style={{ background: '#F8FAFC', borderRadius: '16px', padding: '20px', border: '1px solid #E2E8F0' }}>
            <p className="text-muted" style={{ margin: 0, fontWeight: 800, color: '#0A192F' }}><i className="bi bi-building me-2"></i>AutoVille is a product of Ayinde Technologies</p>
            <p className="text-muted" style={{ margin: '8px 0 0' }}><i className="bi bi-geo-alt me-2"></i>112 S Market St, Ste. 1008, Inglewood, CA 90301, USA</p>
            <hr style={{ margin: '16px 0' }} />
            <p className="text-muted" style={{ margin: 0 }}><i className="bi bi-headset me-2"></i><strong>Support • Peter</strong></p>
            <p className="text-muted" style={{ margin: '4px 0 0' }}><i className="bi bi-telephone me-2"></i><a href="tel:+12015342657" style={{ color: '#0A192F', fontWeight: 700, textDecoration: 'none' }}>+1-201-534-2657</a></p>
            <p className="text-muted" style={{ margin: '4px 0 0' }}><i className="bi bi-envelope me-2"></i><a href="mailto:support@ayindetechnologies.com" style={{ color: '#0A192F', fontWeight: 600 }}>support@ayindetechnologies.com</a></p>
            <hr style={{ margin: '16px 0' }} />
            <p className="text-muted" style={{ margin: 0 }}><i className="bi bi-info-circle me-2"></i><strong>General enquiries</strong></p>
            <p className="text-muted" style={{ margin: '4px 0 0' }}><i className="bi bi-envelope me-2"></i><a href="mailto:info@ayindetechnologies.com" style={{ color: '#0A192F', fontWeight: 600 }}>info@ayindetechnologies.com</a></p>
            <p className="text-muted" style={{ margin: '4px 0 0' }}><i className="bi bi-shield-lock me-2"></i>Privacy requests: <a href="mailto:privacy@ayindetechnologies.com" style={{ color: '#0A192F', fontWeight: 600 }}>privacy@ayindetechnologies.com</a></p>
            <p className="text-muted" style={{ margin: '12px 0 0', fontSize: '12px' }}><i className="bi bi-globe me-1"></i>For CA Attorney General inquiries: oag.ca.gov/privacy</p>
          </div>

          <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '32px' }}><i className="bi bi-info-circle me-1"></i>Disclaimer: Does not constitute legal advice. Have counsel review for BAR compliance.</p>
        </div>
      </div>
    </section>
  );
}