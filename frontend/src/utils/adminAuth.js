const API = "http://127.0.0.1:5000/api";

// Delete ALL persistent data for admin
export function clearAdminSession(){
  // 1. localStorage
  ["autoville_admin","autoville_user","admin_profile","admin_active","admin_token"].forEach(k=> localStorage.removeItem(k));
  // 2. sessionStorage
  try{ sessionStorage.clear(); }catch(e){}
  // 3. Cookies - delete every cookie for this domain/path
  var cookies = document.cookie.split(";");
  for(var i=0;i<cookies.length;i++){
    var c = cookies[i];
    var eqPos = c.indexOf("=");
    var name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
    if(!name) continue;
    // delete for current path + root + parent paths
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/console";
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/console/dashboard";
  }
  // 4. Also explicitly expire known names
  ["autoville_admin","autoville_token","autoville_user","session"].forEach(n=>{
    document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });
}

export function getStoredAdmin(){
  try{
    var raw = localStorage.getItem("autoville_admin");
    if(!raw) return null;
    var parsed = JSON.parse(raw);
    if(!parsed || (!parsed.username && !parsed.email && !parsed.name && !parsed.full_name)) return null;
    return parsed;
  }catch(e){ return null; }
}

export function isAdminLoggedIn(){
  return !!getStoredAdmin();
}

// Ask backend if this admin still exists / session valid
export async function verifyAdminSession(){
  var admin = getStoredAdmin();
  if(!admin) return false;
  try{
    var res = await fetch(API + "/auth/verify/admin",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ username: admin.username || admin.email || admin.name || admin.full_name, email: admin.email || "" })
    });
    if(!res.ok) return false;
    var data = await res.json();
    return !!data.authenticated;
  }catch(e){
    // backend down -> don't kick out on network blip, only on missing local data
    // Return true so guard doesn't bounce on server restart; storage listener still protects
    return true;
  }
}

// Full logout: backend + clear + landing
export async function logoutAdmin(changeView){
  var admin = getStoredAdmin();
  try{
    await fetch(API + "/auth/logout/admin",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ username: admin?.username || admin?.email || "Admin" })
    });
  }catch(e){}
  clearAdminSession();
  if(changeView) changeView("landing");
  else { window.history.pushState({}, "", "/"); window.location.reload(); }
}