/** Decorative confirmation only. Dispatch after a successful state change. */
const installed = Symbol.for('starlit.confirmed-interactions');
if (!document[installed]) {
  document[installed] = true;
  const timers = new WeakMap();
  document.addEventListener('ui:confirmed', event => {
    const target = event.composedPath()[0];
    if (!(target instanceof HTMLElement)) return;
    clearTimeout(timers.get(target));
    target.removeAttribute('data-ui-confirmed');
    // CSS variables cross shadow boundaries and reflect the site's motion setting.
    const duration = getComputedStyle(target).getPropertyValue('--starlit-confirm-time').trim();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || duration === '0s' || duration === '0ms') return;
    target.dataset.uiConfirmed = event.detail?.alternate ? 'b' : 'a';
    timers.set(target, setTimeout(() => {
      target.removeAttribute('data-ui-confirmed');
      timers.delete(target);
    }, 300));
  });
}
export function confirmInteraction(target) {
  if (target) target.dispatchEvent(new CustomEvent('ui:confirmed', {
    bubbles: true, composed: true,
    detail: {alternate: target.dataset.uiConfirmed === 'a'}
  }));
}
