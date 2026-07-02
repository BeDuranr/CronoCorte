-- ═══════════════════════════════════════════════════════════
-- CRONO CORTE — Schema completo de base de datos
-- Versión sincronizada con el código real (Mayo 2026)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
  full_name  VARCHAR(120),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- barbershops
-- ──────────────────────────────────────────────────────────
CREATE TABLE barbershops (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                VARCHAR(120) NOT NULL,
  slug                VARCHAR(80) UNIQUE NOT NULL,
  address             TEXT,
  phone               VARCHAR(30),
  logo_url            TEXT,
  description         TEXT,
  instagram           VARCHAR(80),                        -- handle sin @
  transfer_info       TEXT,                               -- texto libre con datos de transferencia
  -- Pago por WhatsApp
  payment_required    BOOLEAN DEFAULT FALSE,
  -- Configuración del agente de IA
  agent_enabled       BOOLEAN DEFAULT FALSE,
  agent_name          VARCHAR(60) DEFAULT 'Asistente',
  agent_tone          agent_tone DEFAULT 'relajado',
  agent_prompt_custom TEXT DEFAULT '',
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- workers
-- ──────────────────────────────────────────────────────────
CREATE TABLE workers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id  UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name           VARCHAR(120) NOT NULL,
  photo_url      TEXT,
  phone          VARCHAR(30),                             -- WhatsApp para notificaciones
  specialty      VARCHAR(120),                            -- texto libre (ej: "Degradados, Barba")
  calendar_token UUID UNIQUE DEFAULT uuid_generate_v4(),
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- services
-- ──────────────────────────────────────────────────────────
CREATE TABLE services (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id    UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name             VARCHAR(120) NOT NULL,
  description      TEXT,
  price            NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 60,           -- siempre en bloques de 60 min
  sort_order       INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT TRUE
);

-- ──────────────────────────────────────────────────────────
-- availability — disponibilidad semanal por barbería
-- Nota: es por barbershop_id, no por worker_id
-- ──────────────────────────────────────────────────────────
CREATE TABLE availability (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id  UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  day_of_week    SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  is_active      BOOLEAN DEFAULT TRUE,
  UNIQUE (barbershop_id, day_of_week)
);

-- ──────────────────────────────────────────────────────────
-- blocked_slots — ausencias o bloqueos específicos por barbero
-- ──────────────────────────────────────────────────────────
CREATE TABLE blocked_slots (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id   UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  starts_at   TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at     TIMESTAMP WITH TIME ZONE NOT NULL,
  reason      TEXT
);

-- ──────────────────────────────────────────────────────────
-- portfolio_photos
-- ──────────────────────────────────────────────────────────
CREATE TABLE portfolio_photos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id     UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  photo_url     TEXT NOT NULL,
  style_tags    TEXT[] DEFAULT '{}',
  face_shapes   TEXT[] DEFAULT '{}',
  hair_types    TEXT[] DEFAULT '{}',
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
  client_name           VARCHAR(120) NOT NULL,
  client_phone          VARCHAR(30) NOT NULL,
  -- Notas (servicios adicionales o comentarios del cliente)
  notes                 TEXT,
  -- IA
  recommended_style     VARCHAR(120),
  -- Tiempo
  starts_at             TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at               TIMESTAMP WITH TIME ZONE NOT NULL,
  -- Estado
  status                appointment_status DEFAULT 'pending_payment',
  -- Cancelación sin login
  cancel_token          VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  cancellation_reason   TEXT,
  -- Pago
  payment_receipt_url   TEXT,
  payment_amount        NUMERIC(10,2),
  payment_verified      BOOLEAN DEFAULT FALSE,
  -- Recordatorios
  reminder_24h_sent     BOOLEAN DEFAULT FALSE,
  reminder_1h_sent      BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- ÍNDICES — rendimiento en queries frecuentes
-- ──────────────────────────────────────────────────────────
CREATE INDEX idx_appointments_worker_starts   ON appointments(worker_id, starts_at);
CREATE INDEX idx_appointments_barbershop      ON appointments(barbershop_id, starts_at);
CREATE INDEX idx_appointments_client_phone    ON appointments(client_phone, status);
CREATE INDEX idx_appointments_status          ON appointments(status, starts_at);
CREATE INDEX idx_appointments_reminders       ON appointments(starts_at, status)
  WHERE reminder_24h_sent = FALSE OR reminder_1h_sent = FALSE;
CREATE INDEX idx_availability_barbershop      ON availability(barbershop_id);
CREATE INDEX idx_workers_barbershop           ON workers(barbershop_id);
CREATE INDEX idx_services_barbershop          ON services(barbershop_id, is_active);

-- ──────────────────────────────────────────────────────────
-- FUNCIÓN: crear perfil automáticamente al registrar usuario
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'admin'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ──────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────
ALTER TABLE barbershops       ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE services          ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability      ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_slots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_photos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles     ENABLE ROW LEVEL SECURITY;

-- user_profiles
CREATE POLICY "own profile" ON user_profiles
  FOR ALL USING (auth.uid() = id);

-- barbershops: admin gestiona la suya, lectura pública para la página de reserva
CREATE POLICY "admin owns barbershop" ON barbershops
  FOR ALL USING (admin_id = auth.uid());
CREATE POLICY "public read barbershop" ON barbershops
  FOR SELECT USING (TRUE);

-- workers: admin gestiona, worker se ve a sí mismo
-- El público usa la vista public_workers (no expone calendar_token ni phone)
CREATE POLICY "admin manages workers" ON workers
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE admin_id = auth.uid())
  );
CREATE POLICY "worker sees own record" ON workers
  FOR SELECT USING (user_id = auth.uid());

-- Vista pública con columnas seguras (sin calendar_token ni phone)
CREATE OR REPLACE VIEW public_workers AS
SELECT id, barbershop_id, name, specialty, avatar_url, is_active
FROM workers;
GRANT SELECT ON public_workers TO anon, authenticated;

-- services: admin gestiona, público lee activos
CREATE POLICY "admin manages services" ON services
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE admin_id = auth.uid())
  );
CREATE POLICY "public read active services" ON services
  FOR SELECT USING (is_active = TRUE);

-- availability: admin gestiona, público lee
CREATE POLICY "admin manages availability" ON availability
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE admin_id = auth.uid())
  );
CREATE POLICY "public read availability" ON availability
  FOR SELECT USING (TRUE);

-- blocked_slots: admin y worker gestionan
CREATE POLICY "admin manages blocked slots" ON blocked_slots
  FOR ALL USING (
    worker_id IN (
      SELECT id FROM workers WHERE barbershop_id IN (
        SELECT id FROM barbershops WHERE admin_id = auth.uid()
      )
    )
  );
CREATE POLICY "worker manages own blocked slots" ON blocked_slots
  FOR ALL USING (
    worker_id IN (SELECT id FROM workers WHERE user_id = auth.uid())
  );

-- appointments: admin ve todas las de su barbería, worker ve las suyas
CREATE POLICY "admin sees all appointments" ON appointments
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE admin_id = auth.uid())
  );
CREATE POLICY "worker sees own appointments" ON appointments
  FOR SELECT USING (
    worker_id IN (SELECT id FROM workers WHERE user_id = auth.uid())
  );
CREATE POLICY "worker updates own appointments" ON appointments
  FOR UPDATE USING (
    worker_id IN (SELECT id FROM workers WHERE user_id = auth.uid())
  );
-- Inserción pública — clientes sin login crean citas
CREATE POLICY "public insert appointment" ON appointments
  FOR INSERT WITH CHECK (TRUE);
-- portfolio: admin gestiona, público lee
CREATE POLICY "admin manages portfolio" ON portfolio_photos
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE admin_id = auth.uid())
  );
CREATE POLICY "public read portfolio" ON portfolio_photos
  FOR SELECT USING (TRUE);
