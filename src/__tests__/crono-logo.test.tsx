import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CronoLogo } from '@/components/crono-logo'

describe('CronoLogo', () => {
  it('renderiza las palabras "crono" y "corte"', () => {
    render(<CronoLogo />)
    expect(screen.getByText('crono')).toBeInTheDocument()
    expect(screen.getByText('corte')).toBeInTheDocument()
  })

  it('renderiza el separador "/" en rojo (brand-red)', () => {
    render(<CronoLogo />)
    const slash = screen.getByText('/')
    expect(slash).toBeInTheDocument()
    expect(slash.className).toContain('brand-red')
  })

  it('size="sm" no muestra el subtítulo', () => {
    render(<CronoLogo size="sm" />)
    expect(screen.queryByText(/agenda/i)).not.toBeInTheDocument()
  })

  it('size="md" muestra el subtítulo', () => {
    render(<CronoLogo size="md" />)
    expect(screen.getByText(/agenda/i)).toBeInTheDocument()
  })

  it('size="lg" muestra el subtítulo', () => {
    render(<CronoLogo size="lg" />)
    expect(screen.getByText(/agenda/i)).toBeInTheDocument()
  })

  it('size="lg" usa texto más grande que size="sm"', () => {
    const { rerender } = render(<CronoLogo size="sm" />)
    const smCrono = screen.getByText('crono')
    expect(smCrono.className).toContain('text-2xl')

    rerender(<CronoLogo size="lg" />)
    const lgCrono = screen.getByText('crono')
    expect(lgCrono.className).toContain('text-4xl')
  })

  it('el subtítulo menciona barberías', () => {
    render(<CronoLogo size="lg" />)
    expect(screen.getByText(/barber/i)).toBeInTheDocument()
  })
})
