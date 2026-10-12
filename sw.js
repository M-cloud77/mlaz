/* ملاذ — Service Worker: يخلّي التطبيق يفتح بسرعة وبدون إنترنت. غيّر VERSION لما تحدّث الملفات. */
const VERSION = 'malaaz-v1';
const RUNTIME = 'malaaz-runtime-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== RUNTIME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (cache, req, res) => { if (res && res.ok && res.type !== 'opaque') caches.open(cache).then(c => c.put(req, res.clone())); return res; };

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;   // الصوت (Range) يعدّي مباشرة
  const url = new URL(req.url);

  // فتح الصفحة: نسخة جديدة من النت لو متاح، وإلا النسخة المحفوظة
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => { if (res.ok) caches.open(VERSION).then(c => c.put('./index.html', res.clone())); return res; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // ملفات التطبيق نفسه: من الكاش فورًا وتتحدّث في الخلفية
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => put(VERSION, req, res)).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // الخطوط: من الكاش وتتحدّث في الخلفية
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => put(RUNTIME, req, res)).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // نص السور ومواقيت الصلاة: من النت الأول، ولو مفيش نت من آخر نسخة محفوظة
  if (/^(api\.alquran\.cloud|api\.aladhan\.com)$/.test(url.hostname)) {
    e.respondWith(fetch(req).then(res => put(RUNTIME, req, res)).catch(() => caches.match(req)));
  }
  // أي حاجة تانية (الصوتيات، البحث...) تعدّي من غير تدخل
});
