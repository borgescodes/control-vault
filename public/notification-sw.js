self.addEventListener('notificationclick', (event) => {
  if (event.notification.tag !== 'control-vault-status') return

  event.notification.close()
  const homeUrl = new URL('/', self.location.origin).href

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clients) => {
        const existing = clients[0]
        if (existing) {
          if ('navigate' in existing && existing.url !== homeUrl) {
            try {
              await existing.navigate(homeUrl)
            } catch {
              // Focus the existing app even if navigation is unavailable.
            }
          }
          return existing.focus()
        }

        return self.clients.openWindow(homeUrl)
      }),
  )
})
