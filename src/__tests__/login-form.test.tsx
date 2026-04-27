import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Mocks ─────────────────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null,
          }),
        }),
      }),
    }),
  }),
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

import { LoginForm } from '@/app/(auth)/login/login-form'

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────
describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza los campos email y contraseña', () => {
    render(<LoginForm />)
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('renderiza el botón de iniciar sesión', () => {
    render(<LoginForm />)
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument()
  })

  it('el campo de contraseña comienza como type="password"', () => {
    render(<LoginForm />)
    const passwordInput = screen.getByPlaceholderText('••••••••')
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('el ojito cambia el tipo a text al hacer click', async () => {
    render(<LoginForm />)
    const passwordInput = screen.getByPlaceholderText('••••••••')
    const toggleBtn = screen.getByRole('button', { name: /mostrar contraseña/i })

    expect(passwordInput).toHaveAttribute('type', 'password')
    await userEvent.click(toggleBtn)
    expect(passwordInput).toHaveAttribute('type', 'text')
  })

  it('el ojito vuelve a password al hacer doble click', async () => {
    render(<LoginForm />)
    const passwordInput = screen.getByPlaceholderText('••••••••')
    const toggleBtn = screen.getByRole('button', { name: /mostrar contraseña/i })

    await userEvent.click(toggleBtn)
    expect(passwordInput).toHaveAttribute('type', 'text')

    await userEvent.click(screen.getByRole('button', { name: /ocultar contraseña/i }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('actualiza el valor del email al escribir', async () => {
    render(<LoginForm />)
    const emailInput = screen.getByPlaceholderText(/email/i)
    await userEvent.type(emailInput, 'test@example.com')
    expect(emailInput).toHaveValue('test@example.com')
  })

  it('actualiza el valor de la contraseña al escribir', async () => {
    render(<LoginForm />)
    const passwordInput = screen.getByPlaceholderText('••••••••')
    await userEvent.type(passwordInput, 'mi-clave-secreta')
    expect(passwordInput).toHaveValue('mi-clave-secreta')
  })
})
