import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mock de Supabase admin client ──────────────────────────────────────────
const mockSingle = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
      update: () => ({
        eq: mockUpdate,
      }),
    }),
  }),
}))

// Importar después del mock
import { POST } from '@/app/api/appointments/cancel/route'

// ── Helper: construir NextRequest con body JSON ────────────────────────────
function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/appointments/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────
describe('POST /api/appointments/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 400 si no se envía token', async () => {
    const req = makeRequest({})
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/token/i)
  })

  it('retorna 404 si el token no existe', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'No rows' } })

    const req = makeRequest({ token: 'token-inexistente' })
    const res = await POST(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.message).toMatch(/no encontrada/i)
  })

  it('retorna 400 si la cita ya fue cancelada', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: '1',
        status: 'cancelled',
        starts_at: new Date(Date.now() + 3600_000).toISOString(),
      },
      error: null,
    })

    const req = makeRequest({ token: 'token-valido' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/ya fue cancelada/i)
  })

  it('retorna 400 si la cita ya pasó', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: '2',
        status: 'confirmed',
        starts_at: new Date(Date.now() - 3600_000).toISOString(), // hace 1 hora
      },
      error: null,
    })

    const req = makeRequest({ token: 'token-pasado' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/ya pasó/i)
  })

  it('cancela correctamente una cita válida', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: '3',
        status: 'confirmed',
        starts_at: new Date(Date.now() + 3600_000).toISOString(), // en 1 hora
      },
      error: null,
    })
    mockUpdate.mockResolvedValue({ error: null })

    const req = makeRequest({ token: 'token-ok' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('retorna 500 si falla el update en Supabase', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: '4',
        status: 'confirmed',
        starts_at: new Date(Date.now() + 3600_000).toISOString(),
      },
      error: null,
    })
    mockUpdate.mockResolvedValue({ error: { message: 'DB error' } })

    const req = makeRequest({ token: 'token-error' })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
