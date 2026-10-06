-- ============================================================================
-- AUTOGEST PRO - ESQUEMA DE BASE DE DATOS SUPABASE (PostgreSQL)
-- ============================================================================

-- 1. TABLA: Clientes
CREATE TABLE IF NOT EXISTS public."Clientes" (
    id_cliente TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    telefono TEXT NOT NULL,
    email TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLA: Vehículos
CREATE TABLE IF NOT EXISTS public."Vehículos" (
    patente TEXT PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES public."Clientes"(id_cliente) ON DELETE RESTRICT ON UPDATE CASCADE,
    marca TEXT NOT NULL,
    modelo TEXT NOT NULL,
    anio INTEGER,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA: Servicios (Órdenes de Trabajo)
CREATE TABLE IF NOT EXISTS public."Servicios" (
    id_servicio TEXT PRIMARY KEY,
    patente TEXT NOT NULL REFERENCES public."Vehículos"(patente) ON DELETE RESTRICT ON UPDATE CASCADE,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    trabajo_realizado TEXT NOT NULL,
    kilometraje INTEGER NOT NULL,
    proximo_mantenimiento DATE NOT NULL,
    costo NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    estado_pago TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado_pago IN ('Pendiente', 'Pagado', 'MercadoPago')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLA: Stock (Insumos y Repuestos)
CREATE TABLE IF NOT EXISTS public."Stock" (
    id_producto TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 0,
    punto_reposicion INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ÍNDICES PARA BÚSQUEDAS RÁPIDAS
CREATE INDEX IF NOT EXISTS idx_vehiculos_cliente ON public."Vehículos"(id_cliente);
CREATE INDEX IF NOT EXISTS idx_servicios_patente ON public."Servicios"(patente);
CREATE INDEX IF NOT EXISTS idx_servicios_prox_mantenimiento ON public."Servicios"(proximo_mantenimiento);

-- Habilitar RLS (Row Level Security) con acceso público/anon para desarrollo
ALTER TABLE public."Clientes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Vehículos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Servicios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Stock" ENABLE ROW LEVEL SECURITY;

-- Políticas de Acceso (Lectura y Escritura para desarrollo)
CREATE POLICY "Permitir todo a anon en Clientes" ON public."Clientes" FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon en Vehículos" ON public."Vehículos" FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon en Servicios" ON public."Servicios" FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon en Stock" ON public."Stock" FOR ALL TO anon USING (true) WITH CHECK (true);
