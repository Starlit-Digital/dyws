import { itemOrderCap, itemQuantity, resolveItem, restoreCart, totals } from '../dyws/cart.js'

const byId = id => document.getElementById(id)
const money = cents => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100)
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char])

try {
  const response = await fetch('./menu.json')
  if (!response.ok) throw new Error('Menu unavailable')
  start(await response.json())
} catch (error) {
  byId('menu').textContent = 'The demo menu could not load. Reload to try again.'
  console.error(error)
}

function start(catalog) {
  byId('business-name').textContent = catalog.businessName || 'DYWS Demo Kiosk'
  document.title = byId('business-name').textContent + ' · Demo Kiosk'
  if (catalog.serviceDemo) {
    byId('cart-title').textContent = 'Your selection'
    byId('finish').textContent = 'Complete demo selection'
    document.querySelector('footer').textContent = 'Fictional service selections. Book appointments from the storefront.'
  }
  const menu = byId('menu')
  const categories = byId('categories')
  const cart = byId('cart')
  const finish = byId('finish')
  const feedback = byId('feedback')
  let lines = []

  function showCategory(category) {
    byId('menu-title').textContent = category.name
    for (const button of categories.children) {
      button.setAttribute('aria-pressed', String(button.value === category.id))
    }
    menu.replaceChildren()
    for (const item of category.items.filter(item => item.active !== false)) {
      const card = document.createElement('article')
      const variants = item.variants ?? []
      const groups = item.optionGroups ?? []
      card.innerHTML = `<h3>${escape(item.name)}</h3><p>${escape(item.description)}</p>
        <button type="button" aria-expanded="false" aria-controls="options-${escape(item.id)}">
          Customize ${escape(item.name)} · ${money(item.price)}
        </button>
        <form hidden id="options-${escape(item.id)}">
          ${variants.length ? `<label>${escape(item.optionLabel || 'Size')} <select name="variant">${variants.map(option =>
            `<option value="${escape(option.id)}">${escape(option.name)} · ${money(option.price)}</option>`).join('')}</select></label>` : ''}
          ${groups.map(group => `<fieldset><legend>${escape(group.name)} · ${group.min === group.max ? group.max : `${group.min} to ${group.max}`} choices</legend>
            ${group.choices.map(choice => `<label><input type="checkbox" name="group-${escape(group.id)}" value="${escape(choice.id)}">
              ${escape(choice.name)}${choice.price ? ` (+${money(choice.price)})` : ''}</label>`).join('')}</fieldset>`).join('')}
          <button type="submit">Add to order</button>
          <p class="error" role="alert"></p>
        </form>`
      const toggle = card.querySelector('button')
      const form = card.querySelector('form')
      toggle.addEventListener('click', () => {
        form.hidden = !form.hidden
        toggle.setAttribute('aria-expanded', String(!form.hidden))
      })
      form.addEventListener('submit', event => {
        event.preventDefault()
        const data = new FormData(form)
        const selections = Object.fromEntries(groups.map(group => [group.id, data.getAll(`group-${group.id}`)]))
        const error = form.querySelector('.error')
        try {
          const line = resolveItem(catalog, item.id, data.get('variant') ?? '', selections)
          if (itemQuantity(lines, item.id) >= itemOrderCap(catalog)) {
            throw new Error(`Limit of ${itemOrderCap(catalog)} per item.`)
          }
          lines = restoreCart(catalog, [...lines, { ...line, quantity: 1 }])
          renderCart()
          feedback.textContent = `Added ${line.name}. Order total ${money(totals(lines, catalog.taxBasisPoints).total)}.`
          error.textContent = ''
          form.reset()
          form.hidden = true
          toggle.setAttribute('aria-expanded', 'false')
          toggle.focus()
        } catch (problem) {
          error.textContent = problem.message
        }
      })
      menu.append(card)
    }
  }

  function renderCart() {
    const { subtotal, tax, total } = totals(lines, catalog.taxBasisPoints)
    cart.innerHTML = lines.length ? `<ul>${lines.map(line => `<li>
      <strong>${line.quantity} × ${escape(line.name)}</strong>
      <div>${escape(line.option)}</div>
      <div>${money(line.quantity * line.price)}</div>
      <button type="button" aria-label="Remove one ${escape([line.name, line.option].filter(Boolean).join(', '))}">Remove one</button>
      </li>`).join('')}</ul>
      <div>Subtotal ${money(subtotal)}</div><div>GST ${money(tax)}</div><strong>Total ${money(total)}</strong>`
      : 'Your order is empty.'
    finish.disabled = !lines.length
    cart.querySelectorAll('button').forEach((button, index) => {
      button.addEventListener('click', () => {
        const name = lines[index].name
        lines[index].quantity--
        lines = lines.filter(line => line.quantity > 0)
        renderCart()
        byId('cart-title').focus()
        feedback.textContent = `Removed one ${name}.`
      })
    })
  }

  for (const category of catalog.categories) {
    const button = document.createElement('button')
    button.type = 'button'
    button.value = category.id
    button.textContent = category.name
    button.addEventListener('click', () => showCategory(category))
    categories.append(button)
  }
  showCategory(catalog.categories[0])
  finish.addEventListener('click', () => {
    const total = totals(lines, catalog.taxBasisPoints).total
    lines = []
    renderCart()
    byId('cart-title').focus()
    feedback.textContent = catalog.serviceDemo ? `Demo selection complete · ${money(total)}.` : `Demo pickup order complete · ${money(total)}.`
  })
  setupKiosk()
  setupVR()
}

function setupKiosk() {
  const canvas = byId('canvas')
  const ctx = canvas.getContext('2d')
  const mode = byId('mode')
  if (!ctx?.drawElementImage || !canvas.requestPaint || !('content' in HTMLCanvasElement.prototype)) {
    mode.textContent = 'Regular HTML view · Native kiosk rendering is unavailable in this browser.'
    return
  }

  const screen = byId('screen')
  const cabinet = byId('cabinet')
  const flat = byId('flat')
  const toggle = byId('switch')
  let active = false

  function show(kiosk) {
    active = kiosk
    cabinet.hidden = !kiosk
    flat.hidden = kiosk
    ;(kiosk ? canvas : flat).append(screen)
    toggle.textContent = kiosk ? 'Use regular HTML view' : 'Try 3D kiosk'
    mode.textContent = kiosk ? '3D kiosk · Native HTML in Canvas' : 'Regular HTML view'
    if (kiosk) canvas.requestPaint()
  }

  canvas.addEventListener('paint', () => {
    if (!active) return
    try {
      const height = screen.offsetHeight
      const width = screen.offsetWidth
      if (!width || !height) return
      canvas.style.height = `${height}px`
      const ratio = devicePixelRatio
      const pixelsWide = Math.round(width * ratio)
      const pixelsHigh = Math.round(height * ratio)
      if (canvas.width !== pixelsWide) canvas.width = pixelsWide
      if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh
      ctx.resetTransform()
      ctx.clearRect(0, 0, pixelsWide, pixelsHigh)
      ctx.drawElementImage(screen, 0, 0, pixelsWide, pixelsHigh)
    } catch (error) {
      console.error(error)
      show(false)
      toggle.hidden = true
      mode.textContent = 'Regular HTML view · The kiosk renderer could not start.'
    }
  })

  toggle.hidden = false
  toggle.addEventListener('click', () => show(!active))
  show(true)
}

async function setupVR() {
  const button = byId('enter-vr')
  const status = byId('vr-status')
  try {
    if (!navigator.xr || !window.XRWebGLLayer || !await navigator.xr.isSessionSupported('immersive-vr')) return
    const { runVR, prepareVR } = await import('./kiosk-vr.js')
    const graphics = prepareVR()
    button.hidden = false
    button.addEventListener('click', async () => {
      button.disabled = true
      status.hidden = true
      let session
      try {
        session = await navigator.xr.requestSession('immersive-vr')
        session.addEventListener('end', () => {
          button.disabled = false
          button.focus()
        }, { once: true })
        await runVR(session, graphics, document)
      } catch (error) {
        if (session) await session.end().catch(() => {})
        button.disabled = false
        status.textContent = 'VR could not start. You can try again or continue ordering here.'
        status.hidden = false
        console.error(error)
      }
    })
  } catch (error) {
    console.error('VR unavailable', error)
  }
}
