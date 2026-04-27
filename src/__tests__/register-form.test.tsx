import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Mocks ─────────────────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: vi.fn().mockResolvedValue({
        data: { user: { id: 'new-user-1' } },
        error: null,
      }),
    },
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

import { RegisterForm } from '@/app/(auth)/register/register-form'

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────
describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza todos los campos del formulario', () => {
    render(<RegisterForm />)
    expect(screen.getByPlaceholderText(/benjamín/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/barber club/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/mínimo 8/i)).toBeInTheDocument()
  })

  it('muestra el botón de crear cuenta', () => {
    render(<RegisterForm />)
    expect(screen.getByRole('button', { name: /crear mi cuenta/i })).toBeInTheDocument()
  })

  it('muestra preview de URL al escribir nombre de barbería', async () => {
    render(<RegisterForm />)
    const shopInput = screen.getByPlaceholderText(/barber club/i)
    await userEvent.type(shopInput, 'Mi Barbería')
    expect(screen.getByText(/mi-barberia/)).toBeInTheDocument()
  })

  it('el preview de URL convierte acentos correctamente', async () => {
    render(<RegisterForm />)
    const shopInput = screen.getByPlaceholderText(/barber club/i)
    await userEvent.type(shopInput, 'Pérez & Club')
    expect(screen.getByText(/perez-club/)).toBeInTheDocument()
  })

  it('no muestra el preview de URL si el campo está vacío', () => {
    render(<RegisterForm />)
    expect(screen.queryByText(/cronocorte\.app\//)).not.toBeInTheDocument()
  })

  it('la contraseña comienza oculta (type=password)', () => {
    render(<RegisterForm />)
    const passwordInput = screen.getByPlaceholderText(/mínimo 8/i)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('el ojito revela la contraseña', async () => {
    render(<RegisterForm />)
    const passwordInput = screen.getByPlaceholderText(/mínimo 8/i)
    const toggleBtn = screen.getByRole('button', { name: /mostrar contraseña/i })

    await userEvent.click(toggleBtn)
    expect(passwordInput).toHaveAttribute('type', 'text')
  })

  it('el campo contraseña tiene minLength de 8', () => {
    render(<RegisterForm />)
    const passwordInput = screen.getByPlaceholderText(/mínimo 8/i)
    expect(passwordInput).toHaveAttribute('minLength', '8')
  })
})
