export default function FeaturesPage({ ownerFeatures, workshopFeatures }) {
  return (
    <section className="features-perfect">
      <div className="container">
        <div className="features-hero">
          <div>
            <span className="section-tag"><i className="bi bi-grid me-1"></i>WHY AUTOVILLE • BUILT FOR BOTH SIDES</span>
            <h1>Features that<br />actually fix<br />the problem.</h1>
          </div>
          <p>Not a listing site. It's an operating system for car care.</p>
        </div>

        <div className="feat-block owner-block">
          <div className="feat-block-head">
            <div className="head-left">
              <span className="eyebrow">FOR VEHICLE OWNERS</span>
              <h2>No more trial<br />and error.</h2>
            </div>
            <p className="head-right">6 features that protect your car, money, and time.</p>
          </div>
          <div className="owner-atlas">
            {ownerFeatures.map((f) => (
              <div key={f.n} className="owner-card">
                <div className="owner-img" style={{ backgroundImage: `url(${f.img})` }}>
                  <span className="owner-num">{f.n}</span>
                </div>
                <div className="owner-body">
                  <div className="owner-icon"><i className={`bi ${f.icon}`}></i></div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                  <span className="owner-stat">{f.stat}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="feat-block workshop-block">
          <div className="feat-block-head dark-head">
            <div className="head-left">
              <span className="eyebrow dark">FOR WORKSHOPS & TECHNICIANS</span>
              <h2 style={{ color: '#fff' }}>Real growth.<br />Not likes.</h2>
            </div>
            <p className="head-right dark">Everything you need to run your shop like a business.</p>
          </div>
          <div className="workshop-grid">
            {workshopFeatures.map((f) => (
              <div key={f.n} className="workshop-card">
                <div className="w-top">
                  <span className="w-num">{f.n}</span>
                  <span className="w-metric">{f.metric}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}