export default function WorkshopsPage({ workshopsData, navToAuth }) {
  return (
    <section className="workshops-archive" style={{ paddingTop: '140px', minHeight: '100vh' }}>
      <div className="container">
        <div className="archive-head">
          <div>
            <span className="archive-tag">LIVE • {workshopsData.length} VERIFIED SHOPS</span>
            <h2>All Mechanic<br />Workshops</h2>
          </div>
          <p className="archive-desc">Search by location, brand specialization, or rating.</p>
        </div>

        <div className="archive-list">
          {workshopsData.map((shop, i) => (
            <div className="archive-row" key={shop.id}>
              <div className="archive-index">0{i + 1}</div>
              <div className="archive-thumb-wrap">
                <div className="archive-thumb" style={{ backgroundImage: `url(${shop.image})` }}></div>
                <div className="archive-rating-float">★ {shop.rating}</div>
              </div>
              <div className="archive-main">
                <h3 className="archive-name">{shop.name}</h3>
                <div className="archive-meta">
                  <span className="archive-loc"><i className="bi bi-geo-alt-fill me-1"></i>{shop.location}</span>
                  <span className="archive-rating"><span className="dot"></span> {shop.rating}</span>
                </div>
                <div className="archive-expertise">
                  {shop.expertise.map(tag => <span key={tag} className="exp-pill">{tag}</span>)}
                </div>
              </div>
              <div className="archive-action">
                <button className="archive-btn" onClick={() => navToAuth("owner")}>
                  View & Book <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}