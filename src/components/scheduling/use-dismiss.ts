import { useEffect, type RefObject } from 'react'

// Cierra un desplegable al hacer clic fuera de `ref` o al presionar Escape.
// Compartido por DatePicker y TimePicker.
export function useDismiss(ref: RefObject<HTMLElement>, open: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onDismiss()
    }
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss() }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [ref, open, onDismiss])
}
