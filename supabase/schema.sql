-- ═══════════════════════════════════════════════════════════
-- CRONO CORTE — Schema completo de base de datos
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

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
  phone               VARCHAR(20),
  logo_url            TEXT,
  description         TEXT,
  -- Horario general: {"mon":{"open":"09:00","close":"20:00","active":true}, ...}
  schedule_config     JSONB DEFAULT '{}',
  -- Pago por WhatsApp
  payment_required    BOOLEAN DEFAULT FALSE,
  payment_info        JSONB DEFAULT '{}', -- {banco, cuenta, titular, tipo}
  -- Configuración del agente de IA
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
  phone          VARCHAR(20),         -- WhatsApp para notificaciones
  specialties    TEXT[] DEFAULT '{}',
  calendar_token UUID UNIQUE DEFAULT uuid_generate_v4(),
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- services
-- ──────────────────────────────────────────────────────────
CREATE TABLE services (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name          VARCHAR(120) NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_min  INTEGER NOT NULL DEFAULT 30,
  is_active     BOOLEAN DEFAULT TRUE
);

-- ──────────────────────────────────────────────────────────
-- availability — disponibilidad semanal por barbero
-- ──────────────────────────────────────────────────────────
CREATE TABLE availability (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id    UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  UNIQUE (worker_id, day_of_week)
);

-- ──────────────────────────────────────────────────────────
-- blocked_slots — ausencias o bloqueos específicos
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
  client_phone          VARCHAR(20) NOT NULL,
  -- IA
  recommended_style     VARCHAR(120),
  -- Tiempo
  starts_at             TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at               TIMESTAMP WITH TIME ZONE NOT NULL,
  -- Estado
  status                appointment_status DEFAULT 'confirmed',
  -- Cancelación sin login
  cancel_token          VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
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
CREATE INDEX idx_appointments_worker_starts ON appointments(worker_id, starts_at);
CREATE INDEX idx_appointments_barbershop ON appointments(barbershop_id, starts_at);
CREATE INDEX idx_appointments_reminders ON appointments(starts_at, status)
  WHERE reminder_24h_sent = FALSE OR reminder_1h_sent = FALSE;
CREATE INDEX idx_availability_worker ON availability(worker_id);
CREATE INDEX idx_workers_barbershop ON workers(barbershop_id);
CREATE INDEX idx_services_barbershop ON services(barbershop_id);

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

-- user_profiles: cada usuario solo ve/edita el suyo
CREATE POLICY "own profile" ON user_profiles
  FOR ALL USING (auth.uid() = id);

-- barbershops: el admin ve y edita solo la suya
CREATE POLICY "admin owns barbershop" ON barbershops
  FOR ALL USING (admin_id = auth.uid());

-- Lectura pública de barbershops por slug (para la página pública)
CREATE POLICY "public read barbershop by slug" ON barbershops
  FOR SELECT USING (TRUE);

-- workers: el admin de la barbería los gestiona
CREATE POLICY "admin manages workers" ON workers
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE admin_id = auth.uid())
  );

-- Worker ve su propio registro
CREATE POLICY "worker sees own record" ON workers
  FOR SELECT USING (user_id = auth.uid());

-- Lectura pública de workers activos (para página de reserva)
CREATE POLICY "public read active workers" ON workers
  FOR SELECT USING (is_active = TRUE);

-- services: admin gestiona, público lee
CREATE POLICY "admin manages services" ON services
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE admin_id = auth.uid())
  );
CREATE POLICY "public read active services" ON services
  FOR SELECT USING (is_active = TRUE);

-- availability: admin y worker gestionan
CREATE POLICY "admin manages availability" ON availability
  FOR ALL USING (
    worker_id IN (
      SELECT id FROM workers WHERE barbershop_id IN (
        SELECT id FROM barbershops WHERE admin_id = auth.uid()
      )
    )
  );
CREATE POLICY "worker manages own availability" ON availability
  FOR ALL USING (
    worker_id IN (SELECT id FROM workers WHERE user_id = auth.uid())
  );
CREATE POLICY "public read availability" ON availability
  FOR SELECT USING (TRUE);

-- appointments: admin ve todas las de su barbería, worker ve las suyas
CREATE POLICY "admin sees all appointments" ON appointments
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE admin_id = auth.uid())
  );
CREATE POLICY "worker sees own appointments" ON appointments
  FOR SELECT USING (
    worker_id IN (SELECT id FROM workers WHERE user_id = auth.uid())
  );
-- Inserción pública (clientes sin login pueden crear citas)
CREATE POLICY "public insert appointment" ON appointments
  FOR INSERT WITH CHECK (TRUE);
-- Cancelación por token (UPDATE público)
CREATE POLICY "cancel by token" ON appointments
  FOR UPDATE USING (cancel_token = current_setting('app.cancel_token', TRUE));

-- portfolio: admin gestiona, público lee
CREATE POLICY "admin manages portfolio" ON portfolio_photos
  FOR ALL USING (
    barbershop_id IN (SELECT id FROM barbershops WHERE admin_id = auth.uid())
  );
CREATE POLICY "public read portfolio" ON portfolio_photos
  FOR SELECT USING (TRUE);
