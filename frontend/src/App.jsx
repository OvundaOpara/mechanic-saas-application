import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import "./App.css";
import 'bootstrap-icons/font/bootstrap-icons.css';

import MechanicDashboard from "./pages/MechanicDashboard";
import CarOwnerDashboard from "./pages/CarOwnerDashboard";
import AuthPage from "./pages/AuthPage";
import WorkshopsPage from "./pages/WorkshopsPage";
import FaqPage from "./pages/FaqPage";
import ContactPage from "./pages/ContactPage";
import HelpPage from "./pages/HelpPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import ServicesPage from "./pages/ServicesPage";
import FeaturesPage from "./pages/FeaturesPage";
import PricingPage from "./pages/PricingPage";
import WorkshopHelp from "./pages/WorkshopHelp";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import { getStoredAdmin } from "./utils/adminAuth.js";

const API = "http://127.0.0.1:5000/api";

function parseExpertise(w) {
  const raw = w.specialties || w.services || w.expertise;
  if (Array.isArray(raw)) return raw.filter(Boolean).slice(0, 4);
  if (typeof raw === "string" && raw.trim()) return raw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 4);
  return ["General Repair"];
}

const servicesData = [
  { id: "01", title: "Engine Diagnostics & Scanning", img: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=800&q=80", desc: "Full OBD-II scanning, error code analysis and live engine data.", tags: ["ECU Scan", "Check Engine", "Live Data"] },
  { id: "02", title: "Oil Change & Routine Maintenance", img: "https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?auto=format&fit=crop&w=800&q=80", desc: "Genuine oil, filters, and 15-point inspection.", tags: ["5k/10k Service", "Genuine Filters", "Top-up"] },
  { id: "03", title: "Brake System Repair", img: "https://images.unsplash.com/photo-1487754180451-85dd2875a2d1?auto=format&fit=crop&w=800&q=80", desc: "Brake pads, discs, calipers, ABS sensors.", tags: ["Pads & Discs", "ABS", "Handbrake"] },
  { id: "04", title: "Electrical & Wiring", img: "https://images.unsplash.com/photo-1551520344-7b1a5c7b4e5e?auto=format&fit=crop&w=800&q=80", desc: "Battery, alternator, starter, and complex wiring tracing.", tags: ["Battery", "Alternator", "Wiring Loom"] },
  { id: "05", title: "AC & Cooling System", img: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=80", desc: "AC gas refill, compressor, radiator and overheating fix.", tags: ["AC Gas", "Radiator", "Compressor"] },
  { id: "06", title: "Suspension & Steering", img: "https://images.unsplash.com/photo-1613214149922-f1809c99b414?auto=format&fit=crop&w=800&q=80", desc: "Shocks, control arms, ball joints, steering rack.", tags: ["Shocks", "Linkages", "Alignment"] },
];

const faqData = [
  { q: "Do workshops pay commission per job?", a: "No. Zero commission. Flat $40/mo, $100/qtr, $300/yr. Keep 100%." },
  { q: "How does the 1 week free trial work?", a: "Create profile, get verified (30 mins), receive up to 5 real leads for 7 days. No card." },
  { q: "Are mechanics verified?", a: "Yes. CAC, address, tools, 3 jobs. CA shops need BAR license. Only 62% pass." },
  { q: "What if a workshop does bad work?", a: "Rate after every job. Below 3.8 paused. $100 protection credit." },
  { q: "Can owners book home service?", a: "Yes. Choose Home Service at booking - battery, oil, diagnostics at your location." },
  { q: "How fast do I get customers after paying?", a: "Instantly. Most Inglewood/LA shops get first inquiry in 24-48h." },
];

const ownerFeatures = [
  { n: "01", icon: "bi-patch-check", title: "Verified Workshops Only", desc: "Every workshop is CAC-checked and job-tested. Only 62% pass.", stat: "62% pass rate", img: "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=600&q=80" },
  { n: "02", icon: "bi-broadcast", title: "Live Job Tracking", desc: "See when mechanic starts, parts ordered, work in progress.", stat: "Real-time updates", img: "https://images.unsplash.com/photo-1551520344-7b1a5c7b4e5e?auto=format&fit=crop&w=600&q=80" },
  { n: "03", icon: "bi-house-door", title: "Home Service", desc: "Battery, oil, diagnostics done at your home or office.", stat: "Los Angeles • Inglewood", img: "https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?auto=format&fit=crop&w=600&q=80" },
  { n: "04", icon: "bi-currency-dollar", title: "Fair Price First", desc: "Get estimate before job starts. No hidden fees.", stat: "No hidden fees", img: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=600&q=80" },
  { n: "05", icon: "bi-clock-history", title: "History & Reminders", desc: "Every service saved. Reminders for next service.", stat: "Never miss service", img: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=600&q=80" },
  { n: "06", icon: "bi-star", title: "Rating Protection", desc: "Rate after every job. Workshops below 3.8 are paused.", stat: "4.8 avg rating", img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80" },
];

const workshopFeatures = [
  { n: "01", title: "Zero Commission", desc: "Keep 100%. Flat subscription, not 20% per job.", metric: "$0 commission" },
  { n: "02", title: "Unlimited Qualified Leads", desc: "Owners searching for Toyota, Honda, German cars see you first.", metric: "120+ leads/mo avg" },
  { n: "03", title: "Booking Dashboard", desc: "Accept, reschedule, invoice, and mark jobs done.", metric: "Manage on phone" },
  { n: "04", title: "WhatsApp Integration", desc: "Leads go straight to WhatsApp.", metric: "2x faster close" },
  { n: "05", title: "Verified Badge & Top Rank", desc: "Verified shops rank higher and get 3x more clicks.", metric: "3x more clicks" },
  { n: "06", title: "Growth Analytics", desc: "See views, calls, bookings, revenue.", metric: "Monthly report" },
];

const slides = ["/img/hero-1.jpg","/img/hero-2.jpg","/img/hero-5.webp","/img/hero-4.jpg"];

const VIEW_TO_PATH = {
  "landing": "/",
  "workshops": "/workshops",
  "services": "/services",
  "features": "/features",
  "pricing": "/pricing",
  "faq": "/faq",
  "help": "/help",
  "contact": "/contact",
  "privacy": "/privacy",
  "terms": "/terms",
  "auth": "/login",
  "mechanic-dashboard": "/mechanic-workshop/dashboard",
  "car-owner-dashboard": "/car-owner/dashboard",
  "car-owner/cars": "/car-owner/cars",
  "car-owner/workshops": "/car-owner/workshops",
  "car-owner/appointments": "/car-owner/appointments",
  "car-owner/tracking": "/car-owner/tracking",
  "car-owner/history": "/car-owner/history",
  "car-owner/analytics": "/car-owner/analytics",
  "car-owner/favorites": "/car-owner/favorites",
  "car-owner/remarks": "/car-owner/remarks",
  "car-owner/settings": "/car-owner/settings",
  "workshop-help": "/workshop-help",
  "admin-login": "/console/login",
  "admin-dashboard": "/console/dashboard",
};

function getViewFromPath(pathname){
  const p = (pathname || "/").replace(/\/+$/, "") || "/";
  if(p === "/") return "landing";
  if(p === "/workshops") return "workshops";
  if(p === "/services") return "services";
  if(p === "/features") return "features";
  if(p === "/pricing") return "pricing";
  if(p === "/faq") return "faq";
  if(p === "/help") return "help";
  if(p === "/contact") return "contact";
  if(p === "/privacy") return "privacy";
  if(p === "/terms") return "terms";
  if(p === "/login" || p === "/auth") return "auth";
  if(p === "/console/login") return "admin-login";
  if(p.startsWith("/console/dashboard") || p.startsWith("/console")) return "admin-dashboard";
  if(p.startsWith("/mechanic-workshop") || p === "/mechanic-dashboard") return "mechanic-dashboard";
  if(p.startsWith("/car-owner")){
    if(p === "/car-owner/dashboard" || p === "/car-owner-dashboard") return "car-owner-dashboard";
    const sub = p.replace("/car-owner/","").split("/")[0];
    if(["cars","workshops","appointments","tracking","history","analytics","favorites","remarks","settings"].includes(sub)){
      return `car-owner/${sub}`;
    }
    return "car-owner-dashboard";
  }
  if(p === "/workshop-help" || p === "/help/workshop") return "workshop-help";
  return "landing";
}

export default function App() {
  const [view, setView] = useState(()=> getViewFromPath(window.location.pathname));
  const [authRole, setAuthRole] = useState("owner");
  const [authMode, setAuthMode] = useState("login");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [archivePage, setArchivePage] = useState(0);
  const [faqOpen, setFaqOpen] = useState(0);
  const [user, setUser] = useState(() => {
    try { const s = localStorage.getItem("autoville_user"); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  // ---- DYNAMIC WORKSHOPS: TOP 10 ACTIVE + HIGH RATING + MOST LIKED ----
  const [workshopsData, setWorkshopsData] = useState([]);
  const [workshopsLoading, setWorkshopsLoading] = useState(true);

  const perPage = 5; // 10 total = 2 pages
  const totalPages = Math.ceil(workshopsData.length / perPage);
  const pagedShops = workshopsData.slice(archivePage * perPage, archivePage * perPage + perPage);

  const changeView = (newView) => {
    let normalized = newView;
    if(normalized === "car-owner/dashboard") normalized = "car-owner-dashboard";
    if(normalized === "/login" || normalized === "/auth") normalized = "auth";
    let url = VIEW_TO_PATH[normalized];
    if(!url){
      if(normalized.startsWith("car-owner/")) url = `/${normalized}`;
      else if(normalized.startsWith("/")) url = normalized;
      else url = "/";
    }
    let nextViewState = normalized;
    if(url.startsWith("/mechanic-workshop/")) nextViewState = "mechanic-dashboard";
    if(url.startsWith("/console/dashboard")) nextViewState = "admin-dashboard";
    setView(nextViewState);
    window.scrollTo(0,0);
    window.history.pushState({}, "", url);
  };

  useEffect(() => {
    const onPop = () => { setView(getViewFromPath(window.location.pathname)); window.scrollTo(0,0); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [view]);

  // Load top workshops once on mount
  useEffect(() => {
    const loadTopWorkshops = async () => {
      setWorkshopsLoading(true);
      try {
        const [wRes, rRes, fRes] = await Promise.allSettled([
          fetch(`${API}/workshops/available`),
          fetch(`${API}/admin/reviews?limit=500`),
          fetch(`${API}/favorites`),
        ]);

        const workshopsRaw = wRes.status === "fulfilled" && wRes.value.ok
          ? await wRes.value.json().catch(() => []) : [];
        const reviewsRaw = rRes.status === "fulfilled" && rRes.value.ok
          ? await rRes.value.json().catch(() => []) : [];
        const favsRaw = fRes.status === "fulfilled" && fRes.value.ok
          ? await fRes.value.json().catch(() => []) : [];

        const workshops = Array.isArray(workshopsRaw) ? workshopsRaw : (workshopsRaw.workshops || workshopsRaw.data || []);
        const reviews = Array.isArray(reviewsRaw) ? reviewsRaw : (reviewsRaw.reviews || reviewsRaw.data || []);
        const favs = Array.isArray(favsRaw) ? favsRaw : (favsRaw.favorites || favsRaw.data || []);

        const ratingMap = {};
        reviews.forEach(r => {
          if (!r.workshop_id) return;
          const id = String(r.workshop_id);
          if (!ratingMap[id]) ratingMap[id] = { sum: 0, n: 0 };
          ratingMap[id].sum += Number(r.rating || 0);
          ratingMap[id].n += 1;
        });

        const likesMap = {};
        favs.forEach(f => {
          const wid = String(f.workshop_id || f.workshopId || "");
          if (!wid) return;
          likesMap[wid] = (likesMap[wid] || 0) + 1;
        });

        const mapped = workshops.map(w => {
          const id = String(w.id);
          const agg = ratingMap[id];
          const rating = agg && agg.n ? Number((agg.sum / agg.n).toFixed(1)) : Number(w.rating || w.avg_rating || 0);
          const likes = likesMap[id] ?? Number(w.likes || w.favorites_count || w.favorite_count || 0);
          const subStatus = String(w.subscription_status || w.subscription?.status || w.plan_status || "Active");
          const hasActiveSub = w.has_active_subscription !== false && !["expired", "cancelled", "canceled", "inactive"].includes(subStatus.toLowerCase());
          return {
            id: w.id,
            name: w.business_name || w.name || "Workshop",
            location: w.address || [w.city, w.state].filter(Boolean).join(", ") || "—",
            rating,
            reviewsCount: agg?.n ?? Number(w.review_count || w.reviews || 0),
            likes,
            image: w.logo || w.image_url || w.image || "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=600&q=80",
            expertise: parseExpertise(w),
            hasActiveSub,
          };
        });

        const top10 = mapped
          .filter(w => w.hasActiveSub && w.rating >= 4.0)
          .sort((a, b) => (b.rating - a.rating) || (b.likes - a.likes) || (b.reviewsCount - a.reviewsCount))
          .slice(0, 10);

        setWorkshopsData(top10);
        setArchivePage(0);
      } catch (e) {
        console.error("Landing workshops load failed", e);
        setWorkshopsData([]);
      } finally {
        setWorkshopsLoading(false);
      }
    };
    loadTopWorkshops();
  }, []);

  useEffect(() => {
    if (view !== "landing") return;
    const timer = setInterval(() => setCurrentSlide(prev => (prev + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, [view]);

  const navToAuth = (role) => { setAuthRole(role); setAuthMode("login"); changeView("auth"); };

  const Navbar = () => (
    <nav className="navbar navbar-expand-lg fixed-top autocare-nav">
      <div className="container">
        <a className="navbar-brand fw-bold d-flex align-items-center" href="/" onClick={(e) => { e.preventDefault(); changeView("landing"); }} style={{cursor:'pointer'}}>
          <img src="/img/logo-trans.png" alt="AutoVille" height="40" className="me-2" /> AutoVille
        </a>
        <button className="navbar-toggler bg-light" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav"><span className="navbar-toggler-icon"></span></button>
        <div className="collapse navbar-collapse" id="mainNav">
          <ul className="navbar-nav mx-auto gap-lg-3">
            <li className="nav-item"><a className={`nav-link ${view === 'landing' ? 'active' : ''}`} href="/" onClick={(e)=>{e.preventDefault(); changeView("landing")}} style={{cursor:'pointer'}}>Home</a></li>
            <li className="nav-item"><a className={`nav-link ${view === 'workshops' ? 'active' : ''}`} href="/" onClick={(e)=>{e.preventDefault(); changeView("workshops")}} style={{cursor:'pointer'}}>Mechanic Workshops</a></li>
            <li className="nav-item"><a className={`nav-link ${view === 'services' ? 'active' : ''}`} href="/" onClick={(e)=>{e.preventDefault(); changeView("services")}} style={{cursor:'pointer'}}>Services</a></li>
            <li className="nav-item"><a className={`nav-link ${view === 'features' ? 'active' : ''}`} href="/" onClick={(e)=>{e.preventDefault(); changeView("features")}} style={{cursor:'pointer'}}>Features</a></li>
            <li className="nav-item"><a className={`nav-link ${view === 'pricing' ? 'active' : ''}`} href="/" onClick={(e)=>{e.preventDefault(); changeView("pricing")}} style={{cursor:'pointer'}}>Pricing</a></li>
          </ul>
          <div className="d-flex gap-3 mt-3 mt-lg-0">
            <button className="btn btn-outline-light" onClick={() => navToAuth("owner")}>Vehicle Owner</button>
            <button className="btn btn-primary" onClick={() => navToAuth("workshop")}>Workshop</button>
          </div>
        </div>
      </div>
    </nav>
  );

  const Footer = () => (
    <footer className="footer-redesign">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="brand-row"><img src="/img/logo-trans.png" alt="AutoVille" height="34" /><strong>AutoVille</strong></div>
            <p>The ultimate ecosystem connecting vehicle owners with top-rated automotive professionals.</p>
            <div className="footer-socials"><span>LA • Inglewood • Torrance • Long Beach • Santa Monica</span></div>
          </div>
          <div className="footer-links">
            <div><h5>Platform</h5>
              <a href="/" onClick={(e)=>{e.preventDefault(); changeView("services")}} style={{cursor:'pointer'}}><i className="bi bi-tools me-2"></i>Services</a>
              <a href="/" onClick={(e)=>{e.preventDefault(); changeView("features")}} style={{cursor:'pointer'}}><i className="bi bi-grid me-2"></i>Features</a>
              <a href="/" onClick={(e)=>{e.preventDefault(); changeView("pricing")}} style={{cursor:'pointer'}}><i className="bi bi-tag me-2"></i>Pricing</a>
              <a href="/" onClick={(e)=>{e.preventDefault(); changeView("workshops")}} style={{cursor:'pointer'}}><i className="bi bi-geo-alt me-2"></i>Workshops</a>
            </div>
            <div><h5>Support</h5>
              <a href="/" onClick={(e)=>{e.preventDefault(); changeView("help")}} style={{cursor:'pointer'}}><i className="bi bi-life-preserver me-2"></i>Help Center</a>
              <a href="/" onClick={(e)=>{e.preventDefault(); changeView("faq")}} style={{cursor:'pointer'}}><i className="bi bi-question-circle me-2"></i>FAQ</a>
              <a href="/" onClick={(e)=>{e.preventDefault(); changeView("contact")}} style={{cursor:'pointer'}}><i className="bi bi-envelope me-2"></i>Contact Us</a>
              <a href="/" onClick={(e)=>{e.preventDefault(); setAuthRole("workshop"); setAuthMode("login"); changeView("auth");}} style={{cursor:'pointer'}}><i className="bi bi-box-arrow-in-right me-2"></i>Workshop Login</a>
            </div>
          </div>
          <div className="footer-news">
            <h5><i className="bi bi-send me-2"></i>Subscribe to Newsletter</h5>
            <p>Get latest automotive tips and offers.</p>
            <form className="footer-form" onSubmit={(e) => { e.preventDefault(); Swal.fire('Subscribed', 'Thank you!', 'success'); }}>
              <input type="email" placeholder="Your Email Address" required />
              <button type="submit">Subscribe</button>
            </form>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} AutoVille. All rights reserved.</span>
          <div className="bottom-right">
            <div className="bottom-links">
              <a href="/" onClick={(e)=>{e.preventDefault(); changeView("privacy")}} style={{cursor:'pointer'}}><i className="bi bi-shield-lock me-1"></i>Privacy</a>
              <a href="/" onClick={(e)=>{e.preventDefault(); changeView("terms")}} style={{cursor:'pointer'}}><i className="bi bi-file-text me-1"></i>Terms</a>
            </div>
            <div className="footer-icons">
              <a href="https://facebook.com" target="_blank" rel="noreferrer" className="icon-btn"><i className="bi bi-facebook"></i></a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="icon-btn"><i className="bi bi-instagram"></i></a>
              <a href="https://x.com" target="_blank" rel="noreferrer" className="icon-btn"><i className="bi bi-twitter-x"></i></a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" className="icon-btn"><i className="bi bi-youtube"></i></a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );

  // ---- ROUTED PAGES ----
  if (view === "auth") return <AuthPage changeView={changeView} authRole={authRole} setAuthRole={setAuthRole} setUser={setUser} authMode={authMode} setAuthMode={setAuthMode} />;
  if (view === "workshops") return <><Navbar /><WorkshopsPage workshopsData={workshopsData} navToAuth={navToAuth} /><Footer /></>;
  if (view === "faq") return <><Navbar /><FaqPage faqData={faqData} faqOpen={faqOpen} setFaqOpen={setFaqOpen} /><Footer /></>;
  if (view === "contact") return <><Navbar /><ContactPage changeView={changeView} /><Footer /></>;
  if (view === "help") return <><Navbar /><HelpPage changeView={changeView} setAuthRole={setAuthRole} /><Footer /></>;
  if (view === "workshop-help") return <><Navbar /><WorkshopHelp changeView={changeView} setAuthRole={setAuthRole} /><Footer /></>;
  if (view === "privacy") return <><Navbar /><PrivacyPage /><Footer /></>;
  if (view === "terms") return <><Navbar /><TermsPage /><Footer /></>;
  if (view === "admin-login") return <AdminLoginPage changeView={changeView} />;
  if (view === "admin-dashboard") return <AdminDashboard changeView={changeView} />;
  if (view === "services") return <><Navbar /><ServicesPage servicesData={servicesData} /><Footer /></>;
  if (view === "features") return <><Navbar /><FeaturesPage ownerFeatures={ownerFeatures} workshopFeatures={workshopFeatures} /><Footer /></>;
  if (view === "pricing") return <><Navbar /><PricingPage navToAuth={navToAuth} changeView={changeView} /><Footer /></>;
  if (view === "mechanic-dashboard") return <MechanicDashboard changeView={changeView} />;
  if (view === "car-owner-dashboard" || view.startsWith("car-owner")) {
    return <CarOwnerDashboard changeView={changeView} view={view} user={user} onLogout={()=>{localStorage.removeItem("autoville_user"); setUser(null); changeView("landing");}} />;
  }

  // ---- LANDING PAGE (FULL RESTORED) ----
  return (
    <>
      <Navbar />

      {/* HERO */}
      <section className="hero-section" id="home">
        {slides.map((slide, index) => (<div key={index} className={`hero-slide ${index === currentSlide ? 'active' : ''}`} style={{backgroundImage: `url(${slide})`}}></div>))}
        <div className="hero-overlay"></div>
        <div className="container hero-content text-center">
          <h1>Better Car Care.<br/><span>Smarter Maintenance.</span></h1>
          <p className="hero-description mx-auto">Find trusted mechanic workshops, book professional maintenance. Zero commission marketplace.</p>
          <form className="hero-search-box mx-auto mt-5" onSubmit={(e) => e.preventDefault()}>
            <input type="text" placeholder="Location (e.g. Inglewood, CA)" />
            <select><option>Any Specialization</option><option>Engine Repair</option><option>Electrical</option><option>Toyota / Lexus</option><option>German Cars</option></select>
            <select><option>Any Rating</option><option>4+ Stars</option><option>4.5+ Stars</option></select>
            <button type="submit" className="btn btn-primary px-5"><i className="bi bi-search me-2"></i>Search</button>
          </form>
        </div>
      </section>

      {/* WORKSHOPS ARCHIVE — TOP 10 ACTIVE + HIGH RATING + MOST LIKED */}
      <section className="workshops-archive">
        <div className="container">
          <div className="archive-head">
            <div>
              <span className="archive-tag">
                <i className="bi bi-patch-check-fill me-1"></i>
                TOP RATED • VERIFIED • ACTIVE SUBSCRIPTION
              </span>
              <h2>Reliable Mechanics<br />Near You</h2>
            </div>
            <p className="archive-desc">
              Top {workshopsData.length} verified workshops with active subscriptions, highest ratings and most likes from customers. BAR licensed where required.
            </p>
          </div>

          {workshopsLoading ? (
            <div style={{ padding: 40, textAlign: "center", fontWeight: 700, color: "#6B7A90" }}>
              Loading top-rated workshops…
            </div>
          ) : workshopsData.length === 0 ? (
            <div style={{ background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 18, padding: 40, textAlign: "center" }}>
              <h4 style={{ fontWeight: 900 }}>No top-rated workshops yet</h4>
              <p style={{ color: "#6B7A90" }}>Check back soon — workshops need an active subscription and 4.0★+ to appear here.</p>
            </div>
          ) : (
            <>
              <div className="archive-list">
                {pagedShops.map((shop, i) => (
                  <div className="archive-row" key={shop.id}>
                    <div className="archive-index">0{archivePage * perPage + i + 1}</div>
                    <div className="archive-thumb-wrap">
                      <div className="archive-thumb" style={{ backgroundImage: `url(${shop.image})` }}></div>
                      <div className="archive-rating-float"><i className="bi bi-star-fill me-1"></i>{shop.rating}</div>
                    </div>
                    <div className="archive-main">
                      <h3 className="archive-name">{shop.name}</h3>
                      <div className="archive-meta">
                        <span className="archive-loc"><i className="bi bi-geo-alt-fill me-1"></i>{shop.location}</span>
                        <span className="archive-rating"><span className="dot"></span> {shop.rating} • {shop.reviewsCount} reviews • {shop.likes} likes • Verified</span>
                      </div>
                      <div className="archive-expertise">{shop.expertise.map(tag => <span key={tag} className="exp-pill">{tag}</span>)}</div>
                    </div>
                    <div className="archive-action">
                      <button className="archive-btn" onClick={() => navToAuth("owner")}>Book <i className="bi bi-arrow-right ms-1"></i></button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="archive-pagination">
                <div className="pag-info">
                  {workshopsData.length === 0 ? 0 : archivePage * perPage + 1} — {Math.min((archivePage + 1) * perPage, workshopsData.length)} / {workshopsData.length} top workshops
                </div>
                <div className="pag-controls">
                  <button className="pag-btn" disabled={archivePage === 0} onClick={() => setArchivePage(p => Math.max(0, p - 1))}><i className="bi bi-arrow-left me-1"></i>Prev</button>
                  <div className="pag-dots">
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button key={idx} className={`pag-dot ${idx === archivePage ? 'active' : ''}`} onClick={() => setArchivePage(idx)} aria-label={`Page ${idx + 1}`} />
                    ))}
                  </div>
                  <button className="pag-btn" disabled={archivePage === totalPages - 1} onClick={() => setArchivePage(p => Math.min(totalPages - 1, p + 1))}>Next <i className="bi bi-arrow-right ms-1"></i></button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testimonial-redesign">
        <div className="container">
          <div className="testi-head"><div><span className="section-tag"><i className="bi bi-star-fill me-1"></i>REVIEWS • TRUSTED BY 2,400+ OWNERS</span><h2>Real fixes.<br/>Real owners.</h2></div><p>Not paid reviews. Verified bookings from LA, Inglewood, Torrance.</p></div>
          <div className="testi-grid">
            <div className="testi-card featured">
              <div className="quote-mark"><i className="bi bi-quote"></i></div>
              <div className="stars"><i className="bi bi-star-fill"></i><i className="bi bi-star-fill"></i><i className="bi bi-star-fill"></i><i className="bi bi-star-fill"></i><i className="bi bi-star-fill"></i></div>
              <h4>AutoVille completely changed how I manage my car. The home service feature saved me when my alternator died on La Brea at night.</h4>
              <div className="testi-author"><div className="avatar">D</div><div><strong>David O.</strong><span>Inglewood, CA • Toyota Camry</span></div><div className="verified"><i className="bi bi-patch-check-fill me-1"></i>Verified</div></div>
            </div>
            <div className="testi-card">
              <div className="stars"><i className="bi bi-star-fill"></i><i className="bi bi-star-fill"></i><i className="bi bi-star-fill"></i><i className="bi bi-star-fill"></i><i className="bi bi-star-fill"></i></div>
              <h4>Finding an honest mechanic used to be a nightmare. The ratings here are accurate - 62% pass rate is real.</h4>
              <div className="testi-author"><div className="avatar">S</div><div><strong>Sarah M.</strong><span>Torrance, CA • Honda Accord</span></div><div className="verified"><i className="bi bi-patch-check-fill me-1"></i>Verified</div></div>
            </div>
            <div className="testi-card">
              <div className="stars"><i className="bi bi-star-fill"></i><i className="bi bi-star-fill"></i><i className="bi bi-star-fill"></i><i className="bi bi-star-fill"></i><i className="bi bi-star-fill"></i></div>
              <h4>Booked Meisterwerk for my GLK service. Price was exactly what was quoted. No hidden fees.</h4>
              <div className="testi-author"><div className="avatar" style={{background:'#FF5722'}}>T</div><div><strong>Tunde A.</strong><span>Beverly Hills, CA • Mercedes GLK</span></div><div className="verified"><i className="bi bi-patch-check-fill me-1"></i>Verified</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing-redesign" id="pricing">
        <div className="container">
          <div className="pricing-head">
            <div><span className="section-tag"><i className="bi bi-tag me-1"></i>FOR WORKSHOPS • NO COMMISSION</span><h2>Pricing built for<br/>real garages.</h2></div>
            <p>Pay once to be discovered. We don't take 20% per job. Keep 100%. Cancel anytime per California ARL.</p>
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
              </ul>
              <button className="price-btn outline" onClick={() => navToAuth("workshop")}><i className="bi bi-gift me-1"></i>Start Free Trial</button>
              <span className="price-note">No credit card • 7 days</span>
            </div>
            <div className="price-card">
              <div className="price-top"><h4>Monthly</h4><span className="price-duration">Billed monthly</span></div>
              <div className="price-value"><span className="curr">$</span>40<span className="per">/month</span></div>
              <p className="price-desc">For small garages starting online.</p>
              <ul className="price-features">
                <li><i className="bi bi-check2"></i> Unlimited leads</li>
                <li><i className="bi bi-check2"></i> Verified badge</li>
                <li><i className="bi bi-check2"></i> Booking management</li>
                <li><i className="bi bi-check2"></i> Priority support</li>
              </ul>
              <button className="price-btn" onClick={() => navToAuth("workshop")}>Go Monthly</button>
              <span className="price-note">Cancel anytime • ARL compliant</span>
            </div>
            <div className="price-card popular">
              <div className="popular-badge"><i className="bi bi-star-fill me-1"></i>MOST POPULAR • SAVE 17%</div>
              <div className="price-top"><h4>Quarterly</h4><span className="price-duration">3 Months • Best value</span></div>
              <div className="price-value"><span className="curr">$</span>100<span className="per">/quarter</span></div>
              <p className="price-desc">Most workshops choose this to grow fast.</p>
              <ul className="price-features">
                <li><i className="bi bi-check2"></i> Unlimited leads</li>
                <li><i className="bi bi-check2"></i> Top search placement</li>
                <li><i className="bi bi-check2"></i> WhatsApp integration</li>
                <li><i className="bi bi-check2"></i> Monthly growth report</li>
                <li><i className="bi bi-check2"></i> Cancel anytime</li>
              </ul>
              <button className="price-btn primary" onClick={() => navToAuth("workshop")}>Go Quarterly <i className="bi bi-arrow-right ms-1"></i></button>
              <span className="price-note">That's $33.3 / month</span>
            </div>
            <div className="price-card">
              <div className="price-top"><h4>Annual</h4><span className="price-duration">12 Months</span></div>
              <div className="price-value"><span className="curr">$</span>300<span className="per">/year</span></div>
              <p className="price-desc">For established shops that want to dominate LA and US.</p>
              <ul className="price-features">
                <li><i className="bi bi-check2"></i> Everything in Quarterly</li>
                <li><i className="bi bi-check2"></i> Homepage featured slot</li>
                <li><i className="bi bi-check2"></i> Dedicated manager</li>
                <li><i className="bi bi-check2"></i> Free shop photoshoot</li>
              </ul>
              <button className="price-btn" onClick={() => navToAuth("workshop")}>Go Annual</button>
              <span className="price-note">Save 37% vs monthly • $25/mo</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-manual">
        <div className="container">
          <div className="faq-layout">
            <div className="faq-left"><span className="section-tag"><i className="bi bi-question-circle me-1"></i>SUPPORT • COMMON QUESTIONS</span><h2>Got<br/>questions?<br/>We have<br/>answers.</h2></div>
            <div className="faq-right">{faqData.map((item, idx) => (<div key={idx} className={`faq-item ${faqOpen === idx ? 'open' : ''}`} onClick={() => setFaqOpen(faqOpen === idx ? -1 : idx)}><div className="faq-item-head"><span className="faq-num">0{idx + 1}</span><h4 className="faq-q">{item.q}</h4><span className="faq-icon">{faqOpen === idx ? '−' : '+'}</span></div><div className="faq-a-wrap"><p className="faq-a">{item.a}</p></div></div>))}</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section section-padding text-center">
        <div className="container">
          <h2>Ready to Experience Smarter Car Care?</h2>
          <p className="text-white mx-auto mt-3 mb-5" style={{maxWidth: '600px'}}>Join thousands of vehicle owners and professional workshops. Inglewood, LA, Torrance, Long Beach - AutoVille product of Ayinde Technologies.</p>
          <div className="d-flex justify-content-center gap-3 flex-wrap">
            <button className="btn btn-light text-primary btn-lg" onClick={() => navToAuth("owner")}><i className="bi bi-person me-2"></i>Join as Owner</button>
            <button className="btn btn-outline-light btn-lg" onClick={() => navToAuth("workshop")}><i className="bi bi-tools me-2"></i>Register Workshop</button>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}