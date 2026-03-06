import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'

// Inject precache manifest (Vite PWA replaces self.__WB_MANIFEST at build time)
precacheAndRoute(self.__WB_MANIFEST)

// Cache Google Fonts
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({ cacheName: 'google-fonts-cache', plugins: [] })
)

// ── Push notification handler ──────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return
  let data
  try { data = event.data.json() } catch { return }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-192.png',
      dir:     'rtl',
      lang:    'he',
      tag:     data.tag ?? 'baby-tracker',
      renotify: true,
      data:    { url: data.url ?? '/' },
    })
  )
})

// ── Notification click → open / focus app ─────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        const existing = list.find(c => c.url.includes(self.location.origin))
        if (existing && 'focus' in existing) return existing.focus()
        return clients.openWindow(url)
      })
  )
})
