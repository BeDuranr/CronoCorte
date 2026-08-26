'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'

// En el server no hay DOM, así que useLayoutEffect cae a useEffect ahí
// (evita el warning de React sin perder el "sin parpadeo" en el cliente).
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

type RevealType = 'fade-up' | 'fade' | 'scale' | 'slide-up'

// Estilo inicial aplicado de forma imperativa (nunca vía props de React)
// para que un re-render del componente no lo pise una vez que Anime.js
// ya animó el elemento a su estado final.
function applyInitialStyle(el: HTMLElement, type: RevealType) {
  switch (type) {
    case 'fade-up':
      el.style.opacity = '0'
      el.style.transform = 'translateY(8px)'
      break
    case 'fade':
      el.style.opacity = '0'
      break
    case 'scale':
      el.style.opacity = '0'
      el.style.transform = 'scale(0.92)'
      break
    case 'slide-up':
      el.style.transform = 'translateY(100%)'
      break
  }
}

// Revela un único elemento al montar (o cuando cambia `watch`) con Anime.js.
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  type: RevealType,
  opts: { delay?: number; watch?: unknown[] } = {}
) {
  const ref = useRef<T>(null)
  const { delay = 0, watch = [] } = opts

  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    applyInitialStyle(el, type)
  }, watch) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let cancelled = false

    import('animejs').then(({ animate }) => {
      if (cancelled) return
      switch (type) {
        case 'fade-up':
          animate(el, { opacity: [0, 1], translateY: [8, 0], duration: 400, ease: 'outQuad', delay })
          break
        case 'fade':
          animate(el, { opacity: [0, 1], duration: 350, ease: 'outQuad', delay })
          break
        case 'scale':
          animate(el, { opacity: [0, 1], scale: [0.92, 1], duration: 250, ease: 'outQuad', delay })
          break
        case 'slide-up':
          animate(el, { translateY: ['100%', '0%'], duration: 320, ease: 'outQuad', delay })
          break
      }
    })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, watch)

  return ref
}

// Revela una lista de elementos hijos (marcados con `itemAttr`) en cascada.
export function useStaggerReveal<T extends HTMLElement = HTMLDivElement>(
  itemSelector: string,
  opts: { staggerMs?: number; watch?: unknown[] } = {}
) {
  const ref = useRef<T>(null)
  const { staggerMs = 40, watch = [] } = opts

  useIsoLayoutEffect(() => {
    const container = ref.current
    if (!container) return
    const items = container.querySelectorAll<HTMLElement>(itemSelector)
    items.forEach(el => applyInitialStyle(el, 'fade-up'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, watch)

  useEffect(() => {
    const container = ref.current
    if (!container) return
    let cancelled = false
    const items = Array.from(container.querySelectorAll<HTMLElement>(itemSelector))
    if (items.length === 0) return

    import('animejs').then(({ animate, stagger }) => {
      if (cancelled) return
      animate(items, {
        opacity: [0, 1],
        translateY: [8, 0],
        duration: 400,
        ease: 'outQuad',
        delay: stagger(staggerMs),
      })
    })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, watch)

  return ref
}
