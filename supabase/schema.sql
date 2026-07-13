-- ═══════════════════════════════════════════════════════════
-- CRONO CORTE — Schema completo de base de datos
-- Snapshot fiel de la BD real, generado por introspección el 2026-07-13.
-- Fuente de verdad: la base de datos de producción (Supabase).
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- NOTA SOBRE DEUDA TÉCNICA (columnas legacy que siguen en la BD):
--   • workers.specialties (text[])  → legacy. El código usa workers.specialty (text).
--   • workers.photo_url (text)      → legacy. La vista pública expone workers.avatar_url.
--   • availability.is_active (bool) → legacy. El código usa availability.is_available.
--   • availability.barbershop_id    → conviven con availability.worker_id; hay policies
--                                     para ambos modelos (por barbería y por barbero).
--   Se dejan documentadas tal cual existen; su limpieza es una tarea aparte.
-- ═══════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- Extensiones
-- ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Requerida por el constraint anti-doble-reserva (EXCLUDE USING gist).
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ──────────────────────────────────────────────────────────
-- ENUM tipos
-- ──────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('admin', 'worker');
CREATE TYPE appointment_status AS ENUM (
  'pending_payment', 'confirmed', 'cancelled', 'completed'
);
CREATE TYPE agent_tone AS ENUM ('relajado', 'formal', 'juvenil');

-- ──────────────────────────────────────────────────────────
-- user_profiles — extiende auth.users
-- ──────────────────────────────────────────────────────────
CREATE TABLE user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       user_role NOT NULL DEFAULT 'admin',
  full_name  VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- barbershops
-- ──────────────────────────────────────────────────────────
CREATE TABLE barbershops (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id                    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                        VARCHAR NOT NULL,
  slug                        VARCHAR UNIQUE NOT NULL,
  address                     TEXT,
  phone                       VARCHAR,
  logo_url                    TEXT,
  description                 TEXT,
  instagram                   VARCHAR,                         -- handle sin @
  transfer_info               TEXT,                            -- texto libre con datos de transferencia
  schedule_config             JSONB DEFAULT '{}'::jsonb,
  -- Pago
  payment_required            BOOLEAN DEFAULT FALSE,
  payment_info                JSONB DEFAULT '{}'::jsonb,
  -- Presentación
  is_active                   BOOLEAN DEFAULT TRUE,
  accent_color                VARCHAR DEFAULT '#e63946',
  -- Reservas / cancelación / recordatorios
  cancel_policy               TEXT DEFAULT '2h',               -- 'libre' | '2h' | '24h'
  reminder_timings            TEXT[] DEFAULT '{24h}'::text[],  -- subconjunto de {'24h','2h'}
  whatsapp_template_confirmed TEXT,
  whatsapp_template_reminder  TEXT,
  -- Agente de IA
  agent_enabled               BOOLEAN DEFAULT TRUE,
  agent_name                  VARCHAR DEFAULT 'Asistente',
  agent_tone                  agent_tone DEFAULT 'relajado',
  agent_prompt_custom         TEXT DEFAULT '',
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- workers
-- ──────────────────────────────────────────────────────────
CREATE TABLE workers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id  UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL = barbero "sin cuenta"
  name           VARCHAR NOT NULL,
  phone          VARCHAR,                                     -- WhatsApp para notificaciones
  specialty      TEXT,                                        -- texto libre (ej: "Degradados, Barba")
  avatar_url     TEXT,                                        -- expuesta por la vista public_workers
  calendar_token UUID UNIQUE DEFAULT uuid_generate_v4(),
  is_active      BOOLEAN DEFAULT TRUE,
  -- Columnas legacy (ver nota del encabezado): no usadas por el código actual.
  photo_url      TEXT,
  specialties    TEXT[] DEFAULT '{}'::text[],
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- services
-- ──────────────────────────────────────────────────────────
CREATE TABLE services (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id    UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name             VARCHAR NOT NULL,
  description      TEXT,
  price            NUMERIC NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 30,               -- el booking usa bloques de 60 min
  is_active        BOOLEAN DEFAULT TRUE,
  sort_order       INTEGER DEFAULT 0
);

-- ──────────────────────────────────────────────────────────
-- availability — disponibilidad semanal
-- Nota: la BD tiene tanto worker_id como barbershop_id (conviven dos modelos).
-- ──────────────────────────────────────────────────────────
CREATE TABLE availability (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id     UUID REFERENCES workers(id) ON DELETE CASCADE,
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  is_available  BOOLEAN DEFAULT TRUE,
  is_active     BOOLEAN DEFAULT TRUE                          -- legacy (ver nota del encabezado)
);

-- ──────────────────────────────────────────────────────────
-- blocked_slots — ausencias o bloqueos específicos por barbero
-- ──────────────────────────────────────────────────────────
CREATE TABLE blocked_slots (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at   TIMESTAMPTZ NOT NULL,
  reason    TEXT
);

-- ──────────────────────────────────────────────────────────
-- portfolio_photos
-- ──────────────────────────────────────────────────────────
CREATE TABLE portfolio_photos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id     UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  photo_url     TEXT NOT NULL,
  style_tags    TEXT[] DEFAULT '{}'::text[],
  face_shapes   TEXT[] DEFAULT '{}'::text[],
  hair_types    TEXT[] DEFAULT '{}'::text[],
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- appointments
-- ──────────────────────────────────────────────────────────
CREATE TABLE appointments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id         UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  worker_id             UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  service_id            UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  -- Cliente (sin registro)
  client_name           VARCHAR NOT NULL,
  client_phone          VARCHAR NOT NULL,
  -- Notas (servicios adicionales o comentarios del cliente)
  notes                 TEXT,
  -- IA
  recommended_style     VARCHAR,
  -- Tiempo
  starts_at             TIMESTAMPTZ NOT NULL,
  ends_at               TIMESTAMPTZ NOT NULL,
  -- Estado (OJO: el default en BD es 'confirmed'; el código inserta el estado
  -- explícitamente vía service role, así que el default rara vez aplica)
  status                appointment_status DEFAULT 'confirmed',
  -- Reserva grupal: filas que comparten booking_group_id y total_amount
  booking_group_id      UUID,
  total_amount          NUMERIC,
  -- Cancelación sin login
  cancel_token          VARCHAR UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  cancellation_reason   TEXT,
  -- Pago
  payment_receipt_url   TEXT,
  payment_amount        NUMERIC,
  payment_verified      BOOLEAN DEFAULT FALSE,
  -- Recordatorios
  reminder_24h_sent     BOOLEAN DEFAULT FALSE,
  reminder_1h_sent      BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Anti-doble-reserva: un barbero no puede tener dos citas solapadas
-- (salvo canceladas). Requiere btree_gist.
ALTER TABLE appointments
  ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    worker_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status <> 'cancelled'::appointment_status);

-- ──────────────────────────────────────────────────────────
-- ÍNDICES — rendimiento en queries frecuentes
-- ──────────────────────────────────────────────────────────
CREATE INDEX idx_appointments_worker_starts ON appointments(worker_id, starts_at);
CREATE INDEX idx_appointments_barbershop    ON appointments(barbershop_id, starts_at);
CREATE INDEX idx_appointments_booking_group ON appointments(booking_group_id);
CREATE INDEX idx_appointments_reminders     ON appointments(starts_at, status)
  WHERE reminder_24h_sent = FALSE OR reminder_1h_sent = FALSE;
CREATE INDEX idx_availability_worker        ON availability(worker_id);
CREATE INDEX idx_workers_barbershop         ON workers(barbershop_id);
CREATE INDEX idx_services_barbershop        ON services(barbershop_id);

-- ──────────────────────────────────────────────────────────
-- FUNCIÓN: crear perfil automáticamente al registrar usuario
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'admin')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- La función solo debe ser invocable por el trigger (corre como DEFINER).
-- Se revoca EXECUTE a PUBLIC para que no sea llamable vía /rest/v1/rpc.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- ──────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────
ALTER TABLE barbershops      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE services         ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability     ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_slots    ENABLE ROW LEVEL SECURITY;  -- RLS ON sin policies: solo service role accede
ALTER TABLE appointments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles    ENABLE ROW LEVEL SECURITY;

-- ── user_profiles ──
CREATE POLICY "own profile" ON user_profiles
  FOR ALL USING (auth.uid() = id);

-- ── barbershops: admin gestiona la suya; lectura pública para la página de reserva ──
CREATE POLICY "admin owns barbershop" ON barbershops
  FOR ALL USING (admin_id = auth.uid());
CREATE POLICY "public read barbershop by slug" ON barbershops
  FOR SELECT USING (TRUE);

-- ── workers ──
-- El público NO lee la tabla directamente (a anon se le revocó SELECT a nivel
-- tabla y se le otorgó solo sobre columnas seguras — ver GRANTS abajo). Lee vía
-- la vista public_workers, que es security_invoker; por eso anon necesita esta
-- policy de SELECT limitada a barberos activos.
CREATE POLICY "admin manages workers" ON workers
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE admin_id = auth.uid())
  );
CREATE POLICY "worker sees own record" ON workers
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "anon reads active workers" ON workers
  FOR SELECT TO anon USING (is_active = TRUE);

-- ── services: admin gestiona; público lee activos ──
CREATE POLICY "admin manages services" ON services
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE admin_id = auth.uid())
  );
CREATE POLICY "public read active services" ON services
  FOR SELECT USING (is_active = TRUE);

-- ── availability: admin y worker gestionan; público lee ──
CREATE POLICY "admin manages availability" ON availability
  FOR ALL USING (
    worker_id IN (
      SELECT id FROM workers WHERE barbershop_id IN (
        SELECT id FROM barbershops WHERE admin_id = auth.uid()
      )
    )
  );
CREATE POLICY "admin manages barbershop availability" ON availability
  FOR ALL TO authenticated
  USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE admin_id = auth.uid())
  )
  WITH CHECK (
    barbershop_id IN (SELECT id FROM barbershops WHERE admin_id = auth.uid())
  );
CREATE POLICY "worker manages own availability" ON availability
  FOR ALL USING (
    worker_id IN (SELECT id FROM workers WHERE user_id = auth.uid())
  );
CREATE POLICY "public read availability" ON availability
  FOR SELECT USING (TRUE);

-- ── appointments: admin ve/gestiona las de su barbería; worker ve las suyas ──
-- NOTA: no hay policy de INSERT para anon/authenticated. El booking real corre
-- en /api/appointments/create con service role (bypasea RLS). Las policies
-- "public insert appointment" y "worker updates own appointments" fueron
-- eliminadas (ver migraciones 20260709).
CREATE POLICY "admin sees all appointments" ON appointments
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE admin_id = auth.uid())
  );
CREATE POLICY "worker sees own appointments" ON appointments
  FOR SELECT USING (
    worker_id IN (SELECT id FROM workers WHERE user_id = auth.uid())
  );

-- ── portfolio_photos: admin gestiona; público lee ──
CREATE POLICY "admin manages portfolio" ON portfolio_photos
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE admin_id = auth.uid())
  );
CREATE POLICY "public read portfolio" ON portfolio_photos
  FOR SELECT USING (TRUE);

-- ──────────────────────────────────────────────────────────
-- VISTA PÚBLICA — columnas seguras de workers (sin calendar_token ni phone)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public_workers AS
SELECT id, barbershop_id, name, specialty, avatar_url, is_active
FROM workers;
-- security_invoker: la vista corre con los permisos del que consulta (anon),
-- no del creador. Cierra el flag SECURITY DEFINER del advisor.
ALTER VIEW public_workers SET (security_invoker = on);
GRANT SELECT ON public_workers TO anon, authenticated;

-- ──────────────────────────────────────────────────────────
-- GRANTS específicos de seguridad (además de los defaults de Supabase)
-- ──────────────────────────────────────────────────────────
-- Crítico #2: anon NO puede leer la tabla workers completa (expondría
-- calendar_token y phone). Se revoca el SELECT de tabla y se otorga solo sobre
-- las columnas seguras que consume la vista public_workers.
REVOKE SELECT ON public.workers FROM anon;
GRANT SELECT (id, barbershop_id, name, specialty, avatar_url, is_active)
  ON public.workers TO anon;
