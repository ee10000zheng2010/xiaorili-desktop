const CACHE = "xiaorili-shell-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener("fetch", (event) => {
  if (event.request.method === "POST" && new URL(event.request.url).pathname.endsWith("/share-target")) {
    event.respondWith((async () => {
      const form = await event.request.formData();
      const image = form.get("image");
      if (image && typeof image.arrayBuffer === "function") {
        const cache = await caches.open("xiaorili-shared-image-v1");
        await cache.put("./__shared-image", new Response(image, { headers: { "Content-Type": image.type || "image/png" } }));
      }
      return Response.redirect(new URL("./?shared=1", event.request.url), 303);
    })());
    return;
  }
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).pathname.endsWith("/__shared-image")) {
    event.respondWith(caches.match("./__shared-image", { cacheName: "xiaorili-shared-image-v1" }).then((response) => response || new Response("", { status: 404 })));
    return;
  }
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html"))));
});
