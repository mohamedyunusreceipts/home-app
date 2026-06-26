/* Service worker for Web Push + notification clicks.
 *
 * Plain JS, no build step. Registered by components/shell/sw-register.tsx.
 *
 * Push payload shape (must match PushPayload in lib/notifications/push.ts):
 *   { title: string, body?: string, link?: string, tag?: string }
 */

self.addEventListener('push', function (event) {
  let payload = {}
  if (event.data) {
    try {
      payload = event.data.json()
    } catch {
      payload = { title: 'Home', body: event.data.text() }
    }
  }

  var title = payload.title || 'Home'
  var url = payload.link || '/'

  var options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag,
    data: { url: url },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  var targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        var targetPath = new URL(targetUrl, self.location.origin).pathname

        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i]
          var clientPath = new URL(client.url).pathname
          if (clientPath === targetPath && 'focus' in client) {
            return client.focus()
          }
        }

        // No matching tab open on that path; focus any existing window and
        // navigate it, or open a new one.
        for (var j = 0; j < clientList.length; j++) {
          var c = clientList[j]
          if ('focus' in c && 'navigate' in c) {
            return c.navigate(targetUrl).then(function (navigated) {
              return navigated && 'focus' in navigated ? navigated.focus() : undefined
            })
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }

        return undefined
      }),
  )
})
