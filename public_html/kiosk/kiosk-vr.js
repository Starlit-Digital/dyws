// The immersive display drives the same controls as the browser kiosk.
const width = 960
const height = 680
const halfWidth = 0.92
const halfHeight = halfWidth * height / width

export function prepareVR() {
  const gl = document.createElement('canvas').getContext('webgl', { xrCompatible: true })
  if (!gl) throw new Error('WebGL unavailable')
  const program = gl.createProgram()
  const shaders = [
    [gl.VERTEX_SHADER, `
      attribute vec2 point;
      uniform mat4 projection, view;
      uniform vec3 origin;
      varying vec2 uv;
      void main() {
        uv = vec2((point.x + 1.0) * 0.5, (1.0 - point.y) * 0.5);
        gl_Position = projection * view * vec4(origin + vec3(point * vec2(${halfWidth}, ${halfHeight}), 0.0), 1.0);
      }`],
    [gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform sampler2D screen;
      uniform vec2 cursor;
      varying vec2 uv;
      void main() {
        vec2 delta = (uv - cursor) * vec2(960.0, 680.0);
        float distanceToCursor = length(delta);
        gl_FragColor = distanceToCursor < 9.0
          ? (distanceToCursor < 5.0 ? vec4(1.0) : vec4(0.05, 0.04, 0.01, 1.0))
          : texture2D(screen, uv);
      }`],
  ]
  for (const [type, code] of shaders) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, code)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader))
    gl.attachShader(program, shader)
    gl.deleteShader(shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  gl.useProgram(program)
  const point = gl.getAttribLocation(program, 'point')
  gl.enableVertexAttribArray(point)
  gl.vertexAttribPointer(point, 2, gl.FLOAT, false, 0, 0)
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.clearColor(0.075, 0.06, 0.04, 1)
  return { gl, uniforms: Object.fromEntries(['projection', 'view', 'origin', 'cursor'].map(
    name => [name, gl.getUniformLocation(program, name)],
  )) }
}

export async function runVR(session, { gl, uniforms }, page) {
  await gl.makeXRCompatible()
  const space = await session.requestReferenceSpace('local')
  const layer = new XRWebGLLayer(session, gl)
  session.updateRenderState({ baseLayer: layer })
  const bitmap = document.createElement('canvas')
  bitmap.width = width
  bitmap.height = height
  const ctx = bitmap.getContext('2d')
  let origin
  let targets = []
  let view = 'menu'
  let form
  let offset = 0
  let dirty = true

  function navigate(next) {
    view = next
    offset = 0
  }

  function label(value, x, y, size = 24, color = '#fff6df', max = 850) {
    ctx.font = `600 ${size}px system-ui, sans-serif`
    ctx.fillStyle = color
    ctx.fillText(value.trim(), x, y, max)
  }

  function button(title, x, y, w, action, highlight = false) {
    ctx.fillStyle = highlight ? '#ffd044' : '#443822'
    ctx.fillRect(x, y, w, 48)
    label(title, x + 12, y + 32, 22, highlight ? '#211a0b' : '#fff6df', w - 24)
    targets.push({ x, y, w, action })
  }

  function draw() {
    targets = []
    ctx.fillStyle = '#211d17'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = '#ffd044'
    ctx.lineWidth = 5
    ctx.strokeRect(5, 5, width - 10, height - 10)
    label(page.querySelector('#business-name').textContent, 32, 51, 32, '#ffd044')
    button('Menu', 32, 76, 145, () => navigate('menu'), view === 'menu')
    button(page.querySelector('#cart-title').textContent, 188, 76, 190, () => navigate('cart'), view === 'cart')
    button('Exit VR', 790, 76, 138, () => { session.end().catch(console.error) })
    let rows = []
    let status = page.querySelector('#feedback').textContent || 'Aim at a button and pull the trigger.'
    if (view === 'menu') {
      label(page.querySelector('#menu-title').textContent, 32, 169, 28)
      const categories = [...page.querySelectorAll('#categories button')]
      const categoryWidth = 896 / categories.length
      categories.forEach((category, i) => button(category.textContent, 32 + i * categoryWidth, 185,
        categoryWidth - 8, () => { category.click(); offset = 0 }, category.getAttribute('aria-pressed') === 'true'))
      rows = [...page.querySelectorAll('#menu article')].map(card => {
        const control = card.querySelector('button')
        return [control.textContent, () => { form = card.querySelector('form'); navigate('options') }]
      })
    } else if (view === 'options') {
      label(form.closest('article').querySelector('h3').textContent, 32, 169, 28)
      for (const option of form.querySelectorAll('option')) {
        rows.push([`${option.closest('label').firstChild.textContent.trim()} · ${option.textContent}`, () => { option.selected = true }, option.selected])
      }
      for (const fieldset of form.querySelectorAll('fieldset')) {
        rows.push([fieldset.querySelector('legend').textContent])
        for (const choice of fieldset.querySelectorAll('input')) {
          rows.push([choice.labels[0].textContent, () => { choice.checked = !choice.checked }, choice.checked])
        }
      }
      button('Add to order', 32, 185, 240, () => {
        form.requestSubmit()
        if (!form.querySelector('.error').textContent) navigate('cart')
      }, true)
      status = form.querySelector('.error').textContent || 'Select your options, then add the item.'
    } else {
      const cart = page.querySelector('#cart')
      const finish = page.querySelector('#finish')
      label(page.querySelector('#cart-title').textContent, 32, 169, 28)
      label(cart.querySelector(':scope > strong')?.textContent || 'Your order is empty.', 32, 216)
      if (!finish.disabled) button(finish.textContent, 545, 185, 383, () => finish.click(), true)
      rows = [...cart.querySelectorAll('li')].flatMap(line => {
        const remove = line.querySelector('button')
        return [[line.querySelector('strong').textContent + ' · ' + line.querySelector('div + div').textContent],
          [line.querySelector('div').textContent || 'Standard'], ['Remove one', () => remove.click()]]
      })
    }
    const pageSize = 6
    offset = Math.min(offset, Math.max(0, Math.floor((rows.length - 1) / pageSize) * pageSize))
    rows.slice(offset, offset + pageSize).forEach(([title, action, selected], i) => {
      const y = 247 + i * 54
      if (action) button(title, 32, y, 896, action, selected)
      else label(title, 44, y + 32)
    })
    if (offset) button('Previous', 32, 579, 160, () => { offset -= pageSize })
    if (offset + pageSize < rows.length) button('Next', 768, 579, 160, () => { offset += pageSize })
    label(status, 32, 656, 22, '#ffd044')
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap)
  }

  function aim(frame, source) {
    if (!origin || !source) return null
    const matrix = frame.getPose(source.targetRaySpace, space)?.transform.matrix
    if (!matrix || matrix[10] <= 0.001) return null
    const distance = (matrix[14] - origin[2]) / matrix[10]
    if (distance < 0) return null
    return [
      (matrix[12] - matrix[8] * distance - origin[0] + halfWidth) / (2 * halfWidth),
      (origin[1] + halfHeight - matrix[13] + matrix[9] * distance) / (2 * halfHeight),
    ]
  }

  let preferredSource
  session.addEventListener('select', event => {
    preferredSource = event.inputSource
    const hit = aim(event.frame, event.inputSource)
    if (!hit) return
    const [x, y] = [hit[0] * width, hit[1] * height]
    const target = targets.find(target => x >= target.x && x <= target.x + target.w
      && y >= target.y && y <= target.y + 48)
    if (target) {
      target.action()
      dirty = true
    }
  })

  function frameLoop(time, frame) {
    session.requestAnimationFrame(frameLoop)
    const pose = frame.getViewerPose(space)
    if (!pose) return
    if (!origin) {
      const { x, y, z } = pose.transform.position
      origin = [x, y - 0.16, z - 1.6]
      gl.uniform3fv(uniforms.origin, origin)
    }
    if (dirty) {
      draw()
      dirty = false
    }
    const hit = aim(frame, preferredSource) ?? [...session.inputSources]
      .map(source => aim(frame, source))
      .find(point => point?.every(value => value >= 0 && value <= 1))
    gl.uniform2fv(uniforms.cursor, hit ?? [-1, -1])
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer)
    gl.clear(gl.COLOR_BUFFER_BIT)
    for (const eye of pose.views) {
      const viewport = layer.getViewport(eye)
      gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height)
      gl.uniformMatrix4fv(uniforms.projection, false, eye.projectionMatrix)
      gl.uniformMatrix4fv(uniforms.view, false, eye.transform.inverse.matrix)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
  }
  session.requestAnimationFrame(frameLoop)
}
