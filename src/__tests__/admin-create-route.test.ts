import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks de Supabase ──────────────────────────────────────────────────────
const mockGetUser = vi.fn()
const mockShop = vi.fn()
const mockService = vi.fn()
const mockWorker = vi.fn()
const mockConflict = vi.fn()
const mockInsertResult = vi.fn()
const insertSpy = vi.fn(() => ({ select: () => ({ single: mockInsertResult }) }))

// Builder encadenable: select/eq/not/lt/gt/limit devuelven el mismo objeto;
// single/maybeSingle resuelven con el terminal configurado por tabla.
function chain(terminal: () => any) {
  const c: any = {
    select: () => c,
    eq: () => c,
    not: () => c,
    lt: () => c,
    gt: () => c,
    limit: () => c,
    single: () => terminal(),
    maybeSingle: () => terminal(),
  }
  return c
}

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({ auth: { getUser: mockGetUser } }),
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'barbershops') return chain(mockShop)
      if (table === 'services') return chain(mockService)
      if (table === 'workers') return chain(mockWorker)
      if (table === 'appointments') return { ...chain(mockConflict), insert: insertSpy }
      return chain(() => ({ data: null, error: null }))
    },
  }),
}))

// Importar después del mock
import { POST } from '@/app/api/appointments/admin-create/route'

const validBody = {
  barbershop_id: 'shop-1',
  worker_id: 'worker-1',
  service_id: 'svc-1',
  client_name: 'Juan',
  starts_at: '2026-07-20T10:00:00-04:00',
  ends_at: '2026-07-20T11:00:00-04:00',
}

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/appointments/admin-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/appointments/admin-create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Defaults: todo válido; cada test sobreescribe lo que necesite.
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockShop.mockResolvedValue({ data: { id: 'shop-1' }, error: null })
    mockService.mockResolvedValue({ data: { id: 'svc-1', price: 7000 }, error: null })
    mockWorker.mockResolvedValue({ data: { id: 'worker-1' }, error: null })
    mockConflict.mockResolvedValue({ data: null, error: null })
    mockInsertResult.mockResolvedValue({ data: { id: 'new-id' }, error: null })
  })

  it('retorna 400 si faltan campos requeridos', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('retorna 401 si no hay sesión', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('retorna 403 si el usuario no es admin de la barbería', async () => {
    mockShop.mockResolvedValue({ data: null, error: null })
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  it('retorna 400 si el servicio no existe en la barbería', async () => {
    mockService.mockResolvedValue({ data: null, error: null })
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/servicio/i)
  })

  it('retorna 400 si el barbero no está disponible', async () => {
    mockWorker.mockResolvedValue({ data: null, error: null })
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(400)
    expect((await res.json()).message).toMatch(/barbero/i)
  })

  it('retorna 409 si el horario ya está ocupado', async () => {
    mockConflict.mockResolvedValue({ data: { id: 'other' }, error: null })
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(409)
  })

  it('crea la cita como confirmed y calcula el total desde la DB', async () => {
    const res = await POST(makeRequest({ ...validBody, status: 'confirmed', total_amount: 999999 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('new-id')
    expect(body.status).toBe('confirmed')

    // El total insertado proviene del precio real del servicio, no del cliente.
    const insertedRow = insertSpy.mock.calls[0][0]
    expect(insertedRow.total_amount).toBe(7000)
    expect(insertedRow.status).toBe('confirmed')
    // Teléfono omitido → cadena vacía (columna NOT NULL).
    expect(insertedRow.client_phone).toBe('')
  })

  it('respeta el estado pending_payment cuando se solicita', async () => {
    const res = await POST(makeRequest({ ...validBody, status: 'pending_payment' }))
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('pending_payment')
    expect(insertSpy.mock.calls[0][0].status).toBe('pending_payment')
  })
})
