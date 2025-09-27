const CACHE_NAME = 'cst-cache-v1';
const CORE = [
  './',
  './index.html',
  './world.html',
  './stopwatch.html',
  './alarms.html',
  './ai.html',
  './settings.html',
  './login.html',
  './register.html',
  './forgot.html',
  './reset.html',
  './profile.html',
  './admin.html',
  './styles.css',
  './script.js',
  './advanced.js',
  './world.js',
  './stopwatch.js',
  './settings.js',
  './guard.js',
  './auth.js',
  './ai.js',
  './manifest.webmanifest'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', (e)=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', (e)=>{
  const req = e.request;
  e.respondWith(
    caches.match(req).then(res => res || fetch(req).then(r=>{ const copy = r.clone(); caches.open(CACHE_NAME).then(c=>c.put(req, copy)).catch(()=>{}); return r; }).catch(()=>res))
  );
});
