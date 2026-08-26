'use client'

import { useEffect, useRef } from 'react'

// Ícono de éxito que se "dibuja" a sí mismo (círculo + check) con Anime.js.
// Import dinámico: solo se carga cuando el usuario llega a la pantalla de éxito.
export function SuccessCheck() {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    import('animejs').then(({ createTimeline, svg }) => {
      if (cancelled || !wrapRef.current) return
      const circle = wrapRef.current.querySelector<SVGCircleElement>('.success-check-circle')
      const check = wrapRef.current.querySelector<SVGPathElement>('.success-check-mark')
      const group = wrapRef.current.querySelector<SVGGElement>('.success-check-group')
      if (!circle || !check || !group) return

      createTimeline({ defaults: { ease: 'inOutQuad' } })
        .add(svg.createDrawable(circle), { draw: ['0 0', '0 1'] }, 0)
        .add(svg.createDrawable(check), { draw: ['0 0', '0 1'], ease: 'outQuad' }, 350)
        .add(group, {
          scale: [
            { to: 1.12, duration: 180, ease: 'outQuad' },
            { to: 1, duration: 320, ease: 'outElastic' },
          ],
        }, 620)
    })

    return () => { cancelled = true }
  }, [])

  return (
    <div ref={wrapRef} className="w-14 h-14 mx-auto mb-3">
      <svg viewBox="0 0 52 52" className="w-full h-full text-green-500">
        <g className="success-check-group" style={{ transformOrigin: '26px 26px' }}>
          <circle
            className="success-check-circle"
            cx="26" cy="26" r="24"
            fill="none" stroke="currentColor" strokeWidth="2.5"
          />
          <path
            className="success-check-mark"
            fill="none" stroke="currentColor" strokeWidth="3.5"
            strokeLinecap="round" strokeLinejoin="round"
            d="M14.1 27.2l7.1 7.2 16.7-16.8"
          />
        </g>
      </svg>
    </div>
  )
}
