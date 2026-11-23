(function () {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(console.error);
    });
  }

  async function ensureNotificationPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission !== "denied") {
      const res = await Notification.requestPermission();
      return res === "granted";
    }
    return false;
  }

  function postToSW(msg) {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(msg);
    }
  }

  window.BuddyLive = {
    startWorkout() {
      if (!localStorage.getItem("cmyb_workout_start")) {
        localStorage.setItem("cmyb_workout_start", String(Date.now()));
      }
      this.syncNotification();
    },

    startRest(seconds) {
      const endMs = Date.now() + Number(seconds || 60) * 1000;
      localStorage.setItem("cmyb_rest_end", String(endMs));
      ensureNotificationPermission().then((ok) => {
        if (ok) this.syncNotification();
      });
    },

    stopAll() {
      localStorage.removeItem("cmyb_workout_start");
      localStorage.removeItem("cmyb_rest_end");
      postToSW({ type: "CLEAR_LIVE_TIMER" });
    },

    syncNotification() {
      const now = Date.now();
      const wStart = Number(localStorage.getItem("cmyb_workout_start") || 0);
      const rEnd = Number(localStorage.getItem("cmyb_rest_end") || 0);

      if (!wStart && !rEnd) return;

      const elapsedMin = wStart ? Math.floor((now - wStart) / 60000) : 0;
      const restLeft = rEnd > now ? Math.ceil((rEnd - now) / 1000) : 0;

      const title = restLeft > 0
        ? `Rest Timer: ${restLeft}s left`
        : `Workout Live • ${elapsedMin} min`;

      const body = restLeft > 0
        ? `Session elapsed: ${elapsedMin} min • Tap to return`
        : "Tracking your gym session in background";

      postToSW({ type: "SHOW_LIVE_TIMER", title, body });
    }
  };

  // Sync every second while active + immediately when phone unlocks
  setInterval(() => window.BuddyLive.syncNotification(), 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) window.BuddyLive.syncNotification();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      const data = event.data || {};
      if (data.type === "NOTIFICATION_ACTION") {
        if (data.action === "add15") {
          const curEnd = Math.max(Date.now(), Number(localStorage.getItem("cmyb_rest_end") || Date.now()));
          localStorage.setItem("cmyb_rest_end", String(curEnd + 15000));
          window.BuddyLive.syncNotification();
        } else if (data.action === "stop") {
          window.BuddyLive.stopAll();
        }
      }
    });
  }
})();