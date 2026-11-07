export default function FaqPage({ faqData, faqOpen, setFaqOpen }) {
  return (
    <section className="faq-manual" style={{ paddingTop: '140px' }}>
      <div className="container">
        <div className="faq-layout">
          <div className="faq-left">
            <span className="section-tag"><i className="bi bi-question-circle me-1"></i>SUPPORT • FAQ</span>
            <h2>Frequently<br />Asked<br />Questions</h2>
          </div>
          <div className="faq-right">
            {faqData.map((item, idx) => (
              <div key={idx} className={`faq-item ${faqOpen === idx ? 'open' : ''}`} onClick={() => setFaqOpen(faqOpen === idx ? -1 : idx)}>
                <div className="faq-item-head">
                  <span className="faq-num">0{idx + 1}</span>
                  <h4 className="faq-q">{item.q}</h4>
                  <span className="faq-icon">{faqOpen === idx ? '−' : '+'}</span>
                </div>
                <div className="faq-a-wrap">
                  <p className="faq-a">{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}