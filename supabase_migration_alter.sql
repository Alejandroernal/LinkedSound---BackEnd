-- ==============================================================================
-- LinkedSound - Script de Migracion Incremental (ALTER) para Supabase
-- Aplica las correcciones sobre tablas existentes y corrige referencias camelCase
-- ==============================================================================

-- 1. Habilitar Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Crear Catalogos de Roles, Tipos y Estados si no existen
CREATE TABLE IF NOT EXISTS "Role" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) UNIQUE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "UserStatus" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) UNIQUE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "EventStatus" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) UNIQUE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "EventType" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) UNIQUE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ReportStatus" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) UNIQUE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Poblar Catalogos Iniciales
INSERT INTO "Role" ("name", "description")
VALUES
    ('Artista', 'Musicos, cantantes, interpretes y bandas musicales.'),
    ('Productor', 'Productores musicales, beatmakers e ingenieros de mezcla/mastering.'),
    ('Administrador', 'Personal con privilegios de gestion y moderacion de la plataforma.')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "UserStatus" ("name", "description")
VALUES
    ('Active', 'Usuario activo con acceso completo.'),
    ('Suspended', 'Usuario suspendido temporalmente por moderacion.'),
    ('Pending Approval', 'Cuenta en espera de revision inicial.'),
    ('Banned', 'Cuenta inhabilitada de forma permanente.')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "EventStatus" ("name", "description")
VALUES
    ('Active', 'Evento publicado y proximo a realizarse.'),
    ('Finished', 'Evento que ha concluido su fecha de presentacion.'),
    ('Cancelled', 'Evento cancelado por el organizador.'),
    ('Suspended', 'Evento suspendido por moderacion.')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "EventType" ("name", "description")
VALUES
    ('Live Session', 'Sesiones en vivo, streamings o sets de estudio.'),
    ('Concierto', 'Presentaciones en salas de conciertos o clubes.'),
    ('Festival', 'Festivales multidisciplinarios o con multiples artistas.'),
    ('DJ Set', 'Presentaciones de DJ o sets de mezcla continua.'),
    ('Acústico', 'Formatos desenchufados e intimistas.'),
    ('Jam Session', 'Encuentros de improvisacion y colaboracion espontanea.')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "ReportStatus" ("name", "description")
VALUES
    ('Pending', 'Reporte ingresado en espera de evaluacion por moderacion.'),
    ('Under Review', 'Reporte en proceso de investigacion.'),
    ('Resolved', 'Reporte evaluado con accion correctiva.'),
    ('Dismissed', 'Reporte desestimado con explicacion justificada.')
ON CONFLICT ("name") DO NOTHING;

-- 4. Modificaciones a la tabla Location: GeoPoint PostGIS e Indice Espacial
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Location' AND column_name = 'geo_point'
    ) THEN
        ALTER TABLE "Location" ADD COLUMN "geo_point" GEOGRAPHY(Point, 4326);
    END IF;
END $$;

UPDATE "Location"
SET "geo_point" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "geo_point" IS NULL;

CREATE OR REPLACE FUNCTION update_location_geo_point()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."latitude" IS NOT NULL AND NEW."longitude" IS NOT NULL THEN
        NEW."geo_point" := ST_SetSRID(ST_MakePoint(NEW."longitude", NEW."latitude"), 4326)::geography;
    ELSE
        NEW."geo_point" := NULL;
    END IF;
    IF NEW."name" IS NULL OR length(trim(NEW."name")) = 0 THEN
        NEW."name" := LEFT(NEW."formattedAddress", 150);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_update_location_geo_point" ON "Location";
CREATE TRIGGER "trg_update_location_geo_point"
BEFORE INSERT OR UPDATE OF "latitude", "longitude", "name", "formattedAddress" ON "Location"
FOR EACH ROW
EXECUTE FUNCTION update_location_geo_point();

CREATE INDEX IF NOT EXISTS "Location_geo_point_idx" ON "Location" USING GIST ("geo_point");

-- 5. Modificaciones a la tabla Genre: Agregar slug normalizado y asegurar UNIQUE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Genre' AND column_name = 'slug'
    ) THEN
        ALTER TABLE "Genre" ADD COLUMN "slug" VARCHAR(60);
        UPDATE "Genre" SET "slug" = lower(regexp_replace(regexp_replace(trim("name"), '[^a-zA-Z0-9\s-]', '', 'g'), '[\s-]+', '-', 'g')) WHERE "slug" IS NULL;
        ALTER TABLE "Genre" ALTER COLUMN "slug" SET NOT NULL;
        ALTER TABLE "Genre" ADD CONSTRAINT "Genre_slug_unique" UNIQUE ("slug");
    END IF;
END $$;

CREATE OR REPLACE FUNCTION set_genre_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."slug" IS NULL OR length(trim(NEW."slug")) = 0 THEN
        NEW."slug" := lower(regexp_replace(regexp_replace(trim(NEW."name"), '[^a-zA-Z0-9\s-]', '', 'g'), '[\s-]+', '-', 'g'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_set_genre_slug" ON "Genre";
CREATE TRIGGER "trg_set_genre_slug"
BEFORE INSERT OR UPDATE OF "name", "slug" ON "Genre"
FOR EACH ROW
EXECUTE FUNCTION set_genre_slug();
