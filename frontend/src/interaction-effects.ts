/** Small pointer-only accents for deliberate actions; never an indication of success. */
export function installInteractionEffects() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const forcedColors = window.matchMedia('(forced-colors: active)')
  const active = new Map<HTMLElement, Animation[]>()
  let lastBurst = -Infinity

  function clear() {
    for (const [element, animations] of active) {
      animations.forEach(animation => animation.cancel())
      element.remove()
    }
    active.clear()
  }

  function onClick(event: MouseEvent) {
    if (event.detail === 0 || document.hidden || reducedMotion.matches || forcedColors.matches) return
    if (!(event.target instanceof Element)) return
    const button = event.target.closest<HTMLButtonElement>('.primary-button, .assistant-starters button')
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true' || button.matches('.danger-button')) return
    if (typeof Element.prototype.animate !== 'function') return
    const now = performance.now()
    if (now - lastBurst < 240 || active.size >= 2) return
    lastBurst = now

    const burst = document.createElement('span')
    burst.className = 'action-bubbles'
    burst.setAttribute('aria-hidden', 'true')
    burst.style.left = `${event.clientX}px`
    burst.style.top = `${event.clientY}px`
    const animations: Animation[] = []
    // Six tiny bubbles, two simultaneous bursts at most. No frame loop or layout animation.
    for (let index = 0; index < 6; index++) {
      const bubble = document.createElement('span')
      bubble.className = 'action-bubble'
      const angle = index * Math.PI / 3 - Math.PI / 2
      const distance = index % 2 ? 25 : 34
      const x = Math.cos(angle) * distance
      const y = Math.sin(angle) * distance - 7
      burst.append(bubble)
      const animation = bubble.animate([
        { transform: 'translate(-50%, -50%) scale(.65)', opacity: 0 },
        { transform: `translate(calc(-50% + ${x * .55}px), calc(-50% + ${y * .55}px)) scale(1.1)`, opacity: .8, offset: .35 },
        { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(.8)`, opacity: 0 },
      ], { duration: 620 + index * 18, easing: 'cubic-bezier(.22,1,.36,1)' })
      animations.push(animation)
    }
    document.body.append(burst)
    active.set(burst, animations)
    void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      burst.remove()
      active.delete(burst)
    })
  }

  function onVisibilityChange() { if (document.hidden) clear() }
  document.addEventListener('click', onClick, { capture: true, passive: true })
  document.addEventListener('visibilitychange', onVisibilityChange)
  reducedMotion.addEventListener('change', clear)
  forcedColors.addEventListener('change', clear)
  return () => {
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    reducedMotion.removeEventListener('change', clear)
    forcedColors.removeEventListener('change', clear)
    clear()
  }
}
