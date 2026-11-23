const CACHE_NAME = "cmyb-pwa-v1";
const ASSETS = [
  "/call-me-your-buddy/",
  "/call-me-your-buddy/index.html",
  "/call-me-your-buddy/manifest.json",
  "/call-me-your-buddy/pwa.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// Show or update live workout / rest notification
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SHOW_LIVE_TIMER") {
    self.registration.showNotification(data.title || "Call Me Your Buddy", {
      body: data.body || "Workout active",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      tag: "cmyb-live-timer",
      renotify: false,
      silent: true,
      ongoing: true,
      actions: [
        { action: "add15", title: "+15s Rest" },
        { action: "stop", title: "Finish" }
      ]
    });
  } else if (data.type === "CLEAR_LIVE_TIMER") {
    self.registration.getNotifications({ tag: "cmyb-live-timer" }).then((list) => {
      list.forEach((n) => n.close());
    });
  }
});

// Handle tapping notification or action buttons
self.addEventListener("notificationclick", (event) => {
  const action = event.action;
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: "NOTIFICATION_ACTION", action });
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("/call-me-your-buddy/");
      }
    })
  );
});