export default function ServicesPage({ servicesData }) {
  return (
    <section className="services-manual-page">
      <div className="container">
        <div className="services-hero">
          <div>
            <span className="section-tag"><i className="bi bi-tools me-1"></i>FOR VEHICLE OWNERS • 10 CORE SERVICES</span>
            <h1>One platform.<br />Every fix your<br />car needs.</h1>
          </div>
          <div className="services-hero-right">
            <p>From quick oil change to full engine rebuild.</p>
          </div>
        </div>

        <div className="service-atlas">
          {servicesData.map((s, i) => (
            <div key={s.id} className={`service-row ${i % 2 === 1 ? 'reverse' : ''}`}>
              <div className="service-num">{s.id}</div>
              <div className="service-img-wrap">
                <div className="service-img" style={{ backgroundImage: `url(${s.img})` }}></div>
              </div>
              <div className="service-content">
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <div className="service-tags">{s.tags.map(t => <span key={t}>{t}</span>)}</div>
              </div>
              <div className="service-arrow"><i className="bi bi-arrow-right"></i></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}