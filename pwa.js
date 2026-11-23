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
      ensureNotificationPermission().then(() => this.syncNotification());
    },

    startRest(seconds) {
      const sec = Math.max(1, Number(seconds) || 90);
      localStorage.setItem("cmyb_rest_end", String(Date.now() + sec * 1000));
      ensureNotificationPermission().then(() => this.syncNotification());
    },

    clearRest() {
      localStorage.removeItem("cmyb_rest_end");
      if (localStorage.getItem("cmyb_workout_start")) {
        this.syncNotification();
      } else {
        postToSW({ type: "CLEAR_LIVE_TIMER" });
      }
    },

    stopAll() {
      localStorage.removeItem("cmyb_workout_start");
      localStorage.removeItem("cmyb_rest_end");
      postToSW({ type: "CLEAR_LIVE_TIMER" });
    },

    syncNotification() {
      if (!("Notification" in window) || Notification.permission !== "granted") return;

      const now = Date.now();
      const wStart = Number(localStorage.getItem("cmyb_workout_start") || 0);
      const rEnd = Number(localStorage.getItem("cmyb_rest_end") || 0);

      if (rEnd > 0 && rEnd <= now) {
        localStorage.removeItem("cmyb_rest_end");
      }

      const activeRestLeft = rEnd > now ? Math.ceil((rEnd - now) / 1000) : 0;
      if (!wStart && activeRestLeft <= 0) {
        postToSW({ type: "CLEAR_LIVE_TIMER" });
        return;
      }

      const elapsedMin = wStart ? Math.floor((now - wStart) / 60000) : 0;
      const title = activeRestLeft > 0
        ? `Rest Timer: ${activeRestLeft}s left`
        : `Workout Live • ${elapsedMin} min`;

      const body = activeRestLeft > 0
        ? `Workout elapsed: ${elapsedMin} min • Tap to open`
        : "Tracking your gym session • Tap to open";

      postToSW({ type: "SHOW_LIVE_TIMER", title, body });
    }
  };

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