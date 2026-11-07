const API = "http://127.0.0.1:5000/api";

export async function api(path, method = "GET", body = null) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : null,
  });
  return res.json();
}

// Admin
export const adminLogin = (email, password, pin) => api("/auth/login/admin", "POST", { email, password, pin });
export const getLogs = (offset = 0) => api(`/activity-logs?limit=12&offset=${offset}`);
export const getIncomes = (offset = 0) => api(`/admin/incomes?limit=10&offset=${offset}`);
export const getExpenditures = (offset = 0) => api(`/admin/expenditures?limit=10&offset=${offset}`);
export const getSubscriptions = () => api(`/subscriptions`);

// Workshop / Owner
export const ownerLogin = (email, password) => api("/auth/login/owner", "POST", { email, password });
export const workshopLogin = (email, password) => api("/auth/login/workshop", "POST", { email, password });
export const getBookings = (workshop_id) => api(`/bookings?workshop_id=${workshop_id}`);
export const getReviews = (workshop_id) => api(`/reviews?workshop_id=${workshop_id}`);