import { useEffect } from "react";
import { getStoredAdmin, verifyAdminSession, clearAdminSession } from "../utils/adminAuth.js";

// Keeps listening to dashboard + all admin pages.
// If not logged in -> bounce to landing. Listens to:
// - mount / route change, - localStorage change (another tab logout),
// - tab focus / visibility, - 30s interval verify with backend, - storage event
export function useAdminGuard(changeView){
  useEffect(()=>{
    var stopped = false;

    async function checkAndBounce(reason){
      if(stopped) return;
      var local = getStoredAdmin();
      if(!local){
        clearAdminSession();
        if(changeView) changeView("landing");
        else { window.history.pushState({}, "", "/"); window.location.reload(); }
        return;
      }
      var ok = await verifyAdminSession();
      if(!ok && !stopped){
        clearAdminSession();
        if(changeView) changeView("landing");
        else { window.history.pushState({}, "", "/"); window.location.reload(); }
      }
    }

    // 1. Immediate check on mount
    checkAndBounce("mount");

    // 2. Listen to storage - if another tab clears autoville_admin, bounce instantly
    function onStorage(e){
      if(e.key === "autoville_admin" || e.key === null){
        if(!getStoredAdmin()){
          clearAdminSession();
          if(changeView) changeView("landing");
          else { window.history.pushState({}, "", "/"); window.location.reload(); }
        }
      }
    }
    window.addEventListener("storage", onStorage);

    // 3. Listen to focus / visibility - check when user comes back to tab
    function onFocus(){ checkAndBounce("focus"); }
    function onVisibility(){
      if(!document.hidden) checkAndBounce("visibility");
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    // 4. Listen to route changes inside dashboard (popstate)
    function onPop(){ checkAndBounce("popstate"); }
    window.addEventListener("popstate", onPop);

    // 5. Interval - every 30s verify with backend
    var interval = setInterval(()=> checkAndBounce("interval"), 30000);

    return ()=>{
      stopped = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("popstate", onPop);
      clearInterval(interval);
    };
  },[changeView]);
}