// Hosts opt in by publishing a public demo menu under kiosk/.
export async function offerDemoKiosk(container, { booking = false } = {}) {
  const doc = container.ownerDocument
  const win = doc.defaultView
  try {
    if (!win?.XRWebGLLayer || !await win.navigator.xr?.isSessionSupported('immersive-vr')) return
    const url = new URL('../kiosk/', import.meta.url)
    const menu = await win.fetch(new URL('menu.json', url), { method: 'HEAD' })
    if (!menu.ok || !menu.headers.get('content-type')?.includes('application/json') || !container.isConnected) return

    const link = doc.createElement('a')
    link.href = url.href
    link.className = booking ? 'store-button' : 'dyws-demo-shortcut'
    link.textContent = 'Try the VR kiosk'
    if (booking) {
      const callout = doc.createElement('p')
      callout.append(link)
      container.prepend(callout)
    } else {
      container.append(link)
    }
  } catch {
    // Capability checks and unavailable demo menus leave the storefront usable.
  }
}
