export default function TermsPage() {
  return (
    <section className="section-padding" style={{ paddingTop: '120px', background: '#fff', minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: '880px' }}>
        <span className="section-tag"><i className="bi bi-file-text me-2"></i>LEGAL • TERMS OF USE • US & CALIFORNIA COMPLIANT</span>
        <h1 style={{ fontSize: 'clamp(36px,5vw,56px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.9, marginTop: '16px' }}>Terms of Use</h1>
        <p style={{ color: '#6B7A90', margin: '12px 0 0' }}><i className="bi bi-calendar3 me-2"></i>Effective Date: November 3, 2025 • Last Updated: November 3, 2025</p>
        <p style={{ color: '#6B7A90', margin: '4px 0 32px' }}><i className="bi bi-geo-alt me-2"></i>For all users in Los Angeles, California, and across the United States.</p>

        <div className="card p-4 p-md-5" style={{ borderRadius: '24px', border: '1.5px solid #0A192F', lineHeight: '1.85', fontSize: '15px' }}>

          <div style={{ background: '#FFF7ED', border: '1px solid #FF5722', borderRadius: '16px', padding: '20px', marginBottom: '32px' }}>
            <strong><i className="bi bi-exclamation-circle me-2"></i>Binding Agreement:</strong> By creating an account, booking a repair, or listing your shop on AutoVille, you agree to these Terms. If you are a California resident or shop operating in Los Angeles / California, additional disclosures under California law apply (see Sections 5, 6, 13, 14). If you don't agree, don't use AutoVille.
          </div>

          <h5><i className="bi bi-info-circle me-2"></i>1. What AutoVille Is</h5>
          <p className="text-muted">AutoVille Inc. is a marketplace platform (website + app) connecting Vehicle Owners ("Owners") with independent mechanic workshops ("Workshops"). We are NOT a repair shop, we do NOT perform repairs, and we are NOT a party to the actual repair contract. The repair contract is directly between Owner and Workshop. AutoVille facilitates discovery, booking, messaging, and payment facilitation via Stripe.</p>

          <h5><i className="bi bi-person-check me-2"></i>2. Eligibility & Accounts</h5>
          <p className="text-muted">You must be 18+ and able to form a binding contract. For California users, you must be 16+ to book. You agree to provide accurate info (name, phone, email, ZIP like 90028, car year/make/model). One account per person/business. You are responsible for password confidentiality. We may suspend accounts with false info, fraud, or rating below 3.8.</p>

          <h5><i className="bi bi-person me-2"></i>3. For Vehicle Owners (US & LA)</h5>
          <ul className="text-muted">
            <li><i className="bi bi-check2 me-1"></i><strong>Accurate Info:</strong> Provide correct car info, symptoms, and service address for home service.</li>
            <li><i className="bi bi-file-earmark-text me-1"></i><strong>Booking:</strong> Request a quote. Workshop may inspect and adjust estimate with your written (in-app) approval before starting extra work - per California Automotive Repair Act.</li>
            <li><i className="bi bi-credit-card me-1"></i><strong>Payment:</strong> You pay Workshop directly. AutoVille may facilitate payment via Stripe and hold funds until job marked complete. CA sales tax and disposal fees may apply and will be disclosed by Workshop.</li>
            <li><i className="bi bi-x-circle me-1"></i><strong>Cancellation:</strong> Cancel free up to 2 hours before appointment. Late cancel/no-show may incur $25 fee charged by Workshop, disclosed at booking.</li>
            <li><i className="bi bi-house-door me-1"></i><strong>Home Service:</strong> For LA home service, ensure safe, legal parking and access. Mechanic can refuse unsafe location.</li>
          </ul>

          <h5><i className="bi bi-tools me-2"></i>4. For Workshops - Subscriptions & No Commission</h5>
          <p className="text-muted">We operate on <strong>flat subscription, zero commission</strong>. You keep 100% of labor and parts.</p>
          <div className="table-responsive"><table className="table table-bordered" style={{ fontSize: '14px' }}>
            <thead><tr><th><i className="bi bi-tag me-1"></i>Plan</th><th><i className="bi bi-currency-dollar me-1"></i>Price</th><th><i className="bi bi-arrow-repeat me-1"></i>Billing</th><th>What You Get</th></tr></thead>
            <tbody>
              <tr><td><i className="bi bi-gift me-1"></i>Free Trial</td><td>$0</td><td>7 Days</td><td>1 profile, up to 5 leads, no card required</td></tr>
              <tr><td>Monthly</td><td>$40</td><td>Monthly</td><td>Unlimited leads, verified badge, dashboard</td></tr>
              <tr><td><i className="bi bi-star-fill me-1"></i>Quarterly (Popular)</td><td>$100</td><td>Every 3 months ($33.33/mo)</td><td>Unlimited + Top placement + WhatsApp + Growth report</td></tr>
              <tr><td>Annual</td><td>$300</td><td>Yearly ($25/mo) Save 37%</td><td>All + Homepage feature + Dedicated manager + Free photoshoot</td></tr>
            </tbody>
          </table></div>
          <p className="text-muted"><i className="bi bi-shield-check me-1"></i><strong>California Auto-Renewal Law (ARL) Disclosure:</strong> For CA subscribers, by subscribing you authorize recurring billing at the price above until you cancel. Amount, frequency, first charge date, and trial terms are disclosed at checkout. You can cancel anytime from Dashboard &gt; Billing &gt; Cancel Subscription or email billing@autoville.com. Cancellation takes effect at end of current period - no prorated refund, but you keep access until then. We will send renewal reminder 3 days before annual plans.</p>

          <h5><i className="bi bi-award me-2"></i>5. California Workshop Requirements (Los Angeles & CA)</h5>
          <ul className="text-muted">
            <li><i className="bi bi-patch-check me-1"></i>You must hold a valid, active <strong>Bureau of Automotive Repair (BAR) license</strong> (ARD) for California. Upload BAR # during verification.</li>
            <li><i className="bi bi-file-earmark-text me-1"></i>You must provide written estimate, obtain authorization before extra work, and provide invoice with used parts disclosure - per California Business & Professions Code §9884.7 et seq.</li>
            <li><i className="bi bi-globe-americas me-1"></i>You agree to comply with California Auto Repair Act, environmental disposal laws (oil, coolant), and LA County business license requirements.</li>
            <li><i className="bi bi-search me-1"></i>AutoVille verifies BAR # via BAR database. Operating without BAR in CA results in immediate removal and report to BAR if required.</li>
            <li><i className="bi bi-house-gear me-1"></i>Home service in CA: you are responsible for safe disposal, and must carry garage liability insurance minimum $1M. Proof required for verified badge.</li>
          </ul>

          <h5><i className="bi bi-star-half me-2"></i>6. Verification, Ratings & Content Moderation</h5>
          <p className="text-muted"><i className="bi bi-patch-check-fill me-1"></i>Only 62% of applicants pass. Verification includes CAC/Business License, address, tools, 3 past jobs, and for CA - BAR. Owners can rate 1-5 after each verified booking only. Fake reviews, review gating, or paying for reviews is prohibited. Shops below 3.8 are paused and enter improvement plan. AutoVille may remove content that violates these Terms without notice.</p>

          <h5><i className="bi bi-receipt me-2"></i>7. Fees, Taxes, Chargebacks</h5>
          <p className="text-muted"><i className="bi bi-currency-dollar me-1"></i>Subscription fees are non-refundable except as required by law. California users: you may request refund for erroneous charge within 30 days at billing@autoville.com. Owners pay Workshop directly. If Stripe chargeback occurs, Workshop must provide proof of work (photos, signed invoice). Platform fee is only subscription - no per-job commission.</p>

          <h5><i className="bi bi-slash-circle me-2"></i>8. Prohibited Conduct</h5>
          <ul className="text-muted">
            <li><i className="bi bi-x-lg me-1"></i>Creating fake bookings, manipulating ratings, scraping, reverse-engineering</li>
            <li><i className="bi bi-arrow-left-right me-1"></i>Bypassing platform to avoid subscription after lead was obtained via AutoVille (12-month non-circumvention)</li>
            <li><i className="bi bi-exclamation-octagon me-1"></i>Performing unlicensed repair in California, or repairs you are not qualified for</li>
            <li><i className="bi bi-people me-1"></i>Harassment, discrimination based on protected classes (per CA Unruh Civil Rights Act), or unsafe work</li>
            <li><i className="bi bi-bug me-1"></i>Uploading malware, or using AutoVille for non-automotive solicitation</li>
          </ul>

          <h5><i className="bi bi-braces me-2"></i>9. Intellectual Property</h5>
          <p className="text-muted"><i className="bi bi-c-circle me-1"></i>AutoVille brand, logo, designs, code, and content are owned by AutoVille Inc. You grant us a non-exclusive, worldwide license to use shop photos, descriptions, and reviews you upload to promote your listing on AutoVille and social channels.</p>

          <h5><i className="bi bi-exclamation-triangle me-2"></i>10. Disclaimers - Important for California & US</h5>
          <p className="text-muted">AUTOVILLE IS A MARKETPLACE ONLY. WE DO NOT PERFORM REPAIRS, DO NOT GUARANTEE WORK QUALITY, AND ARE NOT RESPONSIBLE FOR ACTS OF WORKSHOPS OR OWNERS. All services are provided "AS IS". Workshops are independent contractors, not employees or agents of AutoVille. To the fullest extent permitted by law, we disclaim all warranties, express or implied, including merchantability and fitness. Always get a written estimate per California law before authorizing work over $100.</p>

          <h5><i className="bi bi-shield-exclamation me-2"></i>11. Limitation of Liability</h5>
          <p className="text-muted">To the maximum extent permitted by law (and not limiting California consumer rights that cannot be waived): AutoVille's total liability for any claim is limited to the greater of (a) amount you paid to AutoVille in last 6 months (subscription) or (b) $100. We are not liable for indirect, incidental, special, consequential, or punitive damages. For LA owners: Workshop is solely liable for faulty workmanship. AutoVille offers $100 Protection Credit at our discretion for verified poor work, not as insurance.</p>

          <h5><i className="bi bi-person-bounding-box me-2"></i>12. Indemnification</h5>
          <p className="text-muted">You agree to indemnify and hold harmless AutoVille, its officers, employees, from claims arising from (a) your breach of these Terms, (b) your violation of California BAR rules or other laws, (c) your repair work or vehicle use, (d) your content.</p>

          <h5><i className="bi bi-balance-scale me-2"></i>13. Dispute Resolution, Arbitration & Class Action Waiver - READ CAREFULLY</h5>
          <p className="text-muted"><i className="bi bi-chat-dots me-1"></i><strong>Informal First:</strong> Email disputes@autoville.com. We try to resolve in 30 days.</p>
          <p className="text-muted"><i className="bi bi-file-earmark-lock me-1"></i><strong>Arbitration:</strong> For US users, any dispute not resolved informally shall be resolved by binding arbitration administered by JAMS in Los Angeles, CA, under JAMS Streamlined Rules. You and AutoVille waive jury trial. <strong>California residents:</strong> You have the right to opt-out of arbitration within 30 days of account creation by emailing arbitration-optout@autoville.com with subject "Opt Out of Arbitration" and your account email. If you opt-out, disputes will be in state or federal court in Los Angeles County, California.</p>
          <p className="text-muted"><i className="bi bi-people me-1"></i><strong>Class Action Waiver:</strong> Claims must be brought individually, not as class or representative action. No class arbitration.</p>
          <p className="text-muted"><i className="bi bi-bank me-1"></i><strong>Small Claims Exception:</strong> Either party may bring qualifying claim in small claims court in Los Angeles County, CA (or your county of residence) instead of arbitration.</p>

          <h5><i className="bi bi-geo-alt me-2"></i>14. Governing Law & Venue</h5>
          <p className="text-muted">These Terms are governed by laws of the State of California and Federal law, without regard to conflict of law principles. If you opted out of arbitration, venue is state or federal courts in Los Angeles County, California. For non-CA US users, venue is also Los Angeles, CA unless local law requires otherwise.</p>

          <h5><i className="bi bi-door-closed me-2"></i>15. Termination</h5>
          <p className="text-muted"><i className="bi bi-trash me-1"></i>You can delete account anytime: Settings &gt; Delete Account. We may suspend/terminate for breach, fraud, BAR license lapse (CA), rating below 3.8, or 12 months inactivity. Upon termination, your listings are removed, but completed booking records and invoices are retained 4 years for tax/compliance.</p>

          <h5><i className="bi bi-arrow-clockwise me-2"></i>16. Changes to Terms</h5>
          <p className="text-muted">We may update Terms. For material changes affecting price, arbitration, or California rights, we will give 30 days notice via email and in-app banner. If you continue after effective date, you accept new Terms. For subscription increase, we will give 45 days notice per California ARL and you can cancel before increase takes effect.</p>

          <h5><i className="bi bi-three-dots me-2"></i>17. Other Provisions</h5>
          <p className="text-muted"><i className="bi bi-diagram-3 me-1"></i><strong>Severability:</strong> If any clause is unenforceable, rest remains. <i className="bi bi-arrow-left-right me-1"></i><strong>Assignment:</strong> You cannot assign. We can assign with notice. <i className="bi bi-file-earmark me-1"></i><strong>Entire Agreement:</strong> These Terms + Privacy Policy are entire agreement. <i className="bi bi-translate me-1"></i><strong>Language:</strong> English controls.</p>

          <h5><i className="bi bi-envelope me-2"></i>18. Contact & DMCA</h5>
          <p className="text-muted">
            <i className="bi bi-building me-1"></i>AutoVille Inc.<br />
            515 S Flower St, 18th Floor, Los Angeles, CA 90071<br />
            <i className="bi bi-envelope me-1"></i>Email: support@autoville.com • billing@autoville.com • legal@autoville.com<br />
            <i className="bi bi-telephone me-1"></i>Phone: (213) 555-0147 • Mon-Fri 9am-6pm PT<br />
            <i className="bi bi-shield-lock me-1"></i>DMCA Agent: dmca@autoville.com - send notice per 17 U.S.C. §512(c)(3) with your signature, work identified, URL, contact, good faith statement, and perjury statement.
          </p>

          <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '32px' }}><i className="bi bi-info-circle me-1"></i>Disclaimer: This Terms draft is for product development and does not constitute legal advice. Have California counsel review, especially for BAR, ARL, and arbitration enforceability under California law.</p>
        </div>
      </div>
    </section>
  );
}