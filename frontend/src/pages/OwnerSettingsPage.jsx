import { useState, useEffect } from "react";
import Swal from "sweetalert2";

const API = "http://127.0.0.1:5000/api";

function getOwner() {
  try {
    const raw = localStorage.getItem("autoville_user") || localStorage.getItem("autoville_owner") || "{}";
    return JSON.parse(raw);
  } catch { return {}; }
}
function getOwnerId() {
  const u = getOwner();
  return u.id || u.owner_id || u.user_id || u.ownerId || null;
}

export default function OwnerSettingsPage({ C, isDark }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "", address: "", city: "", state: "", zip: "", timezone: "Africa/Lagos", avatar: "",
  });
  const [notif, setNotif] = useState({
    booking_confirmations: true, tracking_updates: true, service_reminders: true, promos: false,
  });
  const [privacy, setPrivacy] = useState({ share_location: true, analytics: true });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);

  const load = async () => {
    const ownerId = getOwnerId();
    if (!ownerId) { setError("Please log in again to edit settings."); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      let data = null;
      // Try settings endpoint first
      let res = await fetch(`${API}/owners/${ownerId}/settings`);
      if (res.ok) data = await res.json().catch(() => ({}));
      if (!data || Object.keys(data).length === 0) {
        const dash = await fetch(`${API}/owners/${ownerId}/dashboard`);
        if (dash.ok) { const d = await dash.json().catch(() => ({})); data = d.owner || d.data || d; }
      }
      if (!data || Object.keys(data).length === 0) {
        const one = await fetch(`${API}/owners/${ownerId}`);
        if (one.ok) { const d = await one.json().catch(() => ({})); data = d.owner || d.data || d; }
      }
      // Fallback to localStorage user if backend has nothing yet
      const local = getOwner();
      const owner = { ...local, ...(data || {}) };
      const notifRaw = owner.notifications || owner.notification_settings || {};
      const privRaw = owner.privacy || owner.privacy_settings || {};
      setForm({
        full_name: owner.full_name || owner.name || "",
        phone: owner.phone || owner.whatsapp || "",
        email: owner.email || "",
        address: owner.address || owner.garage_address || owner.default_address || "",
        city: owner.city || "",
        state: owner.state || "",
        zip: owner.zip || owner.zip_code || owner.postal_code || "",
        timezone: owner.timezone || "Africa/Lagos",
        avatar: owner.avatar || owner.avatar_url || owner.profile_pic || "",
      });
      setNotif({
        booking_confirmations: notifRaw.booking_confirmations ?? notifRaw.bookingConfirmations ?? true,
        tracking_updates: notifRaw.tracking_updates ?? notifRaw.trackingUpdates ?? true,
        service_reminders: notifRaw.service_reminders ?? notifRaw.serviceReminders ?? true,
        promos: notifRaw.promos ?? notifRaw.promo ?? notifRaw.promos_from_favorites ?? false,
      });
      setPrivacy({
        share_location: privRaw.share_location ?? privRaw.shareLocation ?? true,
        analytics: privRaw.analytics ?? privRaw.analytics_crash ?? true,
      });
    } catch (e) {
      setError(e.message === "Failed to fetch" ? "Cannot reach backend at http://127.0.0.1:5000 — is 'py app.py' running?" : e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const saveProfile = async () => {
    const ownerId = getOwnerId();
    if (!form.full_name.trim() || !form.email.trim()) {
      Swal.fire("Missing fields", "Full name and email are required.", "warning");
      return;
    }
    if (!form.email.includes("@")) { Swal.fire("Invalid email", "Enter a valid email address.", "warning"); return; }
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name, name: form.full_name,
        phone: form.phone, email: form.email,
        address: form.address, city: form.city, state: form.state, zip: form.zip, zip_code: form.zip,
        timezone: form.timezone, avatar: form.avatar, avatar_url: form.avatar,
        notifications: notif, notification_settings: notif,
        privacy, privacy_settings: privacy,
      };
      let res = await fetch(`${API}/owners/${ownerId}/settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) res = await fetch(`${API}/owners/${ownerId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) res = await fetch(`${API}/owners/${ownerId}/profile`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
      // Keep localStorage in sync so dashboard header updates instantly
      try {
        const stored = JSON.parse(localStorage.getItem("autoville_user") || "{}");
        localStorage.setItem("autoville_user", JSON.stringify({ ...stored, ...payload, id: ownerId }));
      } catch {}
      Swal.fire("Saved!", "Your profile was updated.", "success");
    } catch (e) { Swal.fire("Could not save", e.message, "error"); }
    setSaving(false);
  };

  const savePrefs = async (nextNotif, nextPrivacy) => {
    const ownerId = getOwnerId();
    try {
      const payload = { notifications: nextNotif, notification_settings: nextNotif, privacy: nextPrivacy, privacy_settings: nextPrivacy };
      let res = await fetch(`${API}/owners/${ownerId}/settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) res = await fetch(`${API}/owners/${ownerId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      // Don't throw on prefs — toggles already updated locally, backend may not have settings table yet
    } catch {}
  };

  const toggleNotif = (key) => {
    const next = { ...notif, [key]: !notif[key] };
    setNotif(next);
    savePrefs(next, privacy);
  };
  const togglePrivacy = (key) => {
    const next = { ...privacy, [key]: !privacy[key] };
    setPrivacy(next);
    savePrefs(notif, next);
  };

  const changePassword = async () => {
    if (!pw.current || !pw.next || !pw.confirm) return Swal.fire("Missing fields", "Fill current, new and confirm password.", "warning");
    if (pw.next.length < 6) return Swal.fire("Too short", "New password must be at least 6 characters.", "warning");
    if (pw.next !== pw.confirm) return Swal.fire("Mismatch", "New password and confirm do not match.", "warning");
    const ownerId = getOwnerId();
    setPwSaving(true);
    try {
      let res = await fetch(`${API}/auth/change-password`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner_id: ownerId, user_id: ownerId, email: form.email, current_password: pw.current, new_password: pw.next }) });
      if (!res.ok) res = await fetch(`${API}/owners/${ownerId}/password`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current_password: pw.current, new_password: pw.next }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Password change failed (${res.status})`);
      Swal.fire("Password updated", "Use your new password next time you log in.", "success");
      setPw({ current: "", next: "", confirm: "" });
    } catch (e) { Swal.fire("Could not change password", e.message, "error"); }
    setPwSaving(false);
  };

  const deleteAccount = async () => {
    const confirm = await Swal.fire({
      title: "Delete account?",
      text: "This permanently deletes your profile, cars and history. This cannot be undone.",
      icon: "warning", showCancelButton: true, confirmButtonColor: "#991B1B", confirmButtonText: "Yes, delete my account", cancelButtonText: "Keep my account",
    });
    if (!confirm.isConfirmed) return;
    const ownerId = getOwnerId();
    try {
      let res = await fetch(`${API}/owners/${ownerId}`, { method: "DELETE" });
      if (!res.ok) res = await fetch(`${API}/auth/delete-account`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner_id: ownerId, email: form.email }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Delete failed (${res.status})`);
      localStorage.removeItem("autoville_user");
      localStorage.removeItem("autoville_owner");
      Swal.fire("Account deleted", "Your data deletion request was processed.", "success").then(() => { window.location.href = "/"; });
    } catch (e) { Swal.fire("Could not delete", e.message, "error"); }
  };

  const onAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, avatar: reader.result }));
    reader.readAsDataURL(file);
  };

  const cardBg = C?.card || "#fff";
  const cardBorder = C?.cardBorder || "#E2E8F0";
  const text = C?.text || "#0A192F";
  const muted = C?.muted || "#6B7A90";
  const soft = C?.soft || "#F8FAFC";

  const Toggle = ({ on, onClick }) => (
    <div className={`toggle ${on ? "on" : ""}`} onClick={onClick} style={{ flexShrink: 0 }}></div>
  );

  return (
    <>
      <style>{`
        .set-card{ background:${cardBg}; border:1.5px solid ${cardBorder}; border-radius:18px; padding:20px; }
        .set-row{ display:flex; justify-content:space-between; align-items:center; padding:16px 0; border-bottom:1px solid ${cardBorder}; gap:12px; }
        .set-row:last-child{ border-bottom:none; }
        .set-label{ font-weight:800; font-size:15px; color:${text}; }
        .set-sub{ font-size:13px; color:${muted}; font-weight:500; margin-top:2px; }
        .toggle{ width:48px; height:28px; border-radius:20px; background:#E2E8F0; position:relative; cursor:pointer; transition:.2s; border:1.5px solid ${cardBorder}; flex-shrink:0; }
        .toggle.on{ background:#0A192F; }
        .toggle::after{ content:""; position:absolute; width:20px; height:20px; background:#fff; border-radius:50%; top:2.5px; left:3px; transition:.2s; box-shadow:0 2px 6px rgba(0,0,0,0.15); }
        .toggle.on::after{ transform:translateX(20px); }
        .set-input{ height:46px; border-radius:12px; border:1.5px solid ${cardBorder}; background:${soft}; color:${text}; font-weight:600; font-size:14px; padding:0 14px; width:100%; }
      `}</style>

      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontWeight: 900, fontSize: '30px', color: text, margin: '0 0 6px' }}>Settings</h2>
        <p style={{ color: muted, fontSize: '15px', margin: 0, fontWeight: 500 }}>Manage profile, notifications and privacy</p>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#991B1B", borderRadius: 12, padding: 12, marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{error}</span>
          <button onClick={load} style={{ background: "#991B1B", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontWeight: 800, cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {loading ? <div style={{ padding: 40, textAlign: "center", color: muted, fontWeight: 700 }}>Loading settings…</div> : (
        <div className="row g-3">
          <div className="col-lg-7">
            <div className="set-card">
              <h5 style={{ fontWeight: 900, fontSize: '16px', color: text, margin: '0 0 14px' }}><i className="bi bi-person-circle me-2"></i>Profile • Vehicle Owner</h5>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundImage: `url(${form.avatar || "../img/usericon.png"})`, backgroundSize: "cover", backgroundPosition: "center", border: `2px solid ${cardBorder}`, flexShrink: 0 }}></div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: text }}>{form.full_name || "Owner"}</div>
                  <div style={{ fontSize: 12, color: muted }}>{form.email}</div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: text, cursor: "pointer", textDecoration: "underline" }}>
                    Change photo
                    <input type="file" accept="image/*" onChange={onAvatarFile} style={{ display: "none" }} />
                  </label>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div><div style={{ fontSize: '12px', fontWeight: 800, color: muted, marginBottom: '6px' }}>FULL NAME</div><input className="set-input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Full name" /></div>
                <div><div style={{ fontSize: '12px', fontWeight: 800, color: muted, marginBottom: '6px' }}>PHONE</div><input className="set-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+234 ..." /></div>
              </div>
              <div style={{ marginBottom: '14px' }}><div style={{ fontSize: '12px', fontWeight: 800, color: muted, marginBottom: '6px' }}>EMAIL</div><input className="set-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><div style={{ fontSize: '12px', fontWeight: 800, color: muted, marginBottom: '6px' }}>DEFAULT GARAGE ADDRESS</div><input className="set-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Street address" /></div>
                <div><div style={{ fontSize: '12px', fontWeight: 800, color: muted, marginBottom: '6px' }}>TIMEZONE</div>
                  <select className="set-input" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}>
                    <option value="Africa/Lagos">WAT • Lagos, NG</option>
                    <option value="America/Los_Angeles">PST • Los Angeles, CA</option>
                    <option value="America/New_York">EST • New York</option>
                    <option value="Europe/London">GMT • London</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div><div style={{ fontSize: '12px', fontWeight: 800, color: muted, marginBottom: '6px' }}>CITY</div><input className="set-input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="City" /></div>
                <div><div style={{ fontSize: '12px', fontWeight: 800, color: muted, marginBottom: '6px' }}>STATE</div><input className="set-input" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="State" /></div>
                <div><div style={{ fontSize: '12px', fontWeight: 800, color: muted, marginBottom: '6px' }}>ZIP</div><input className="set-input" value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} placeholder="ZIP" /></div>
              </div>
              <button onClick={saveProfile} disabled={saving} style={{ marginTop: '16px', width: '100%', height: '46px', borderRadius: '12px', background: text, color: '#fff', border: `1.5px solid ${text}`, fontWeight: 800, fontSize: '14px', cursor: "pointer" }}>{saving ? "Saving…" : "Save Profile"}</button>
            </div>

            <div className="set-card" style={{ marginTop: '14px' }}>
              <h5 style={{ fontWeight: 900, fontSize: '16px', color: text, margin: '0 0 8px' }}><i className="bi bi-bell-fill me-2" style={{ color: '#FF5722' }}></i>Notifications</h5>
              {[
                { key: "booking_confirmations", t: "Booking Confirmations", s: "Get SMS & email when shop confirms" },
                { key: "tracking_updates", t: "Live Tracking Updates", s: "Push when mechanic starts, parts ordered, ready" },
                { key: "service_reminders", t: "Service Reminders", s: "Oil, brake, inspection due reminders" },
                { key: "promos", t: "Promos from favorite shops", s: "Offers from your favorite shops" },
              ].map((n) => (
                <div key={n.key} className="set-row">
                  <div><div className="set-label">{n.t}</div><div className="set-sub">{n.s}</div></div>
                  <Toggle on={notif[n.key]} onClick={() => toggleNotif(n.key)} />
                </div>
              ))}
            </div>

            <div className="set-card" style={{ marginTop: '14px' }}>
              <h5 style={{ fontWeight: 900, fontSize: '16px', color: text, margin: '0 0 8px' }}><i className="bi bi-key-fill me-2"></i>Change Password</h5>
              <div style={{ display: "grid", gap: 10 }}>
                <input type="password" className="set-input" placeholder="Current password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} />
                <input type="password" className="set-input" placeholder="New password (min 6 chars)" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} />
                <input type="password" className="set-input" placeholder="Confirm new password" value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })} />
                <button onClick={changePassword} disabled={pwSaving} style={{ height: 46, borderRadius: 12, background: text, color: "#fff", border: `1.5px solid ${text}`, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>{pwSaving ? "Updating…" : "Update Password"}</button>
              </div>
            </div>
          </div>

          <div className="col-lg-5">
            <div className="set-card">
              <h5 style={{ fontWeight: 900, fontSize: '16px', color: text, margin: '0 0 8px' }}><i className="bi bi-shield-lock me-2"></i>Privacy & Data</h5>
              <div className="set-row"><div><div className="set-label">Share location with shops</div><div className="set-sub">Allow live ETA for tracking</div></div><Toggle on={privacy.share_location} onClick={() => togglePrivacy("share_location")} /></div>
              <div className="set-row"><div><div className="set-label">Analytics & Crash Reporting</div><div className="set-sub">Help improve AutoVille</div></div><Toggle on={privacy.analytics} onClick={() => togglePrivacy("analytics")} /></div>
              <div style={{ marginTop: '14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '12px', fontSize: '13px', color: '#92400E', fontWeight: 500, lineHeight: 1.5 }}>
                <i className="bi bi-info-circle me-1"></i> <b>Privacy:</b> You can request data deletion at any time. Contact support@ayindetechnologies.com
              </div>
            </div>

            <div className="set-card" style={{ marginTop: '14px', background: '#0A192F', borderColor: '#0A192F', color: '#fff' }}>
              <h5 style={{ fontWeight: 900, fontSize: '15px', margin: '0 0 10px', color: '#fff' }}><i className="bi bi-headset me-2"></i>Support • Ayinde Technologies</h5>
              <div style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6 }}>
                <div><i className="bi bi-telephone-fill me-2"></i>Peter • +1-201-534-2657</div>
                <div><i className="bi bi-envelope-fill me-2"></i>support@ayindetechnologies.com</div>
                <div><i className="bi bi-geo-alt-fill me-2"></i>112 S Market St, Ste 1008, Inglewood, CA 90301</div>
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                  <span style={{ background: 'rgba(255,255,255,0.12)', padding: '5px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>Verified Shops</span>
                  <span style={{ background: '#FFEB3B', color: '#000', padding: '5px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>AutoVille</span>
                </div>
              </div>
            </div>

            <div className="set-card" style={{ marginTop: '14px' }}>
              <h5 style={{ fontWeight: 900, fontSize: '15px', color: text, margin: '0 0 12px' }}><i className="bi bi-exclamation-triangle me-2" style={{ color: '#EF4444' }}></i>Danger Zone</h5>
              <button onClick={deleteAccount} style={{ width: '100%', height: '44px', borderRadius: '12px', border: '1.5px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', fontWeight: 800, fontSize: '13px', cursor: "pointer" }}>Delete Account • Data Deletion Request</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}