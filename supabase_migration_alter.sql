-- ==============================================================================
-- LinkedSound - Script de Migracion Incremental (ALTER) para Supabase
-- Aplica las correcciones de normalizacion sobre una base de datos existente:
-- 1. Elimina columnas redundantes (status, role, name, latitude, longitude, genreId, images, targetType)
-- 2. Asegura PostGIS geography en Location
-- 3. Crea Image y EventImage (con isCover)
-- 4. Aplica restricciones canónicas UNIQUE y CHECK
-- 5. Asegura readAt en Notification y VARCHAR(N) en campos alfanuméricos
-- ==============================================================================

-- 1. Habilitar Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Location: Unificar en geo_point y eliminar name, latitude, longitude
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'Location' AND column_name = 'geo_point'
    ) THEN
        ALTER TABLE "Location" ADD COLUMN "geo_point" GEOGRAPHY(Point, 4326);
    END IF;

    -- Si existen latitude y longitude, poblar geo_point antes de removerlos
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'Location' AND column_name = 'latitude'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'Location' AND column_name = 'longitude'
    ) THEN
        UPDATE "Location"
        SET "geo_point" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
        WHERE "geo_point" IS NULL AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL;
    END IF;

    -- Eliminar columnas redundantes en Location
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Location' AND column_name = 'name') THEN
        ALTER TABLE "Location" DROP COLUMN "name";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Location' AND column_name = 'latitude') THEN
        ALTER TABLE "Location" DROP COLUMN "latitude";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Location' AND column_name = 'longitude') THEN
        ALTER TABLE "Location" DROP COLUMN "longitude";
    END IF;
END $$;

-- 3. User: Eliminar columnas redundantes role y status
DO $$
BEGIN
    -- Asegurar que statusId tenga valor antes de eliminar status
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'status') THEN
        UPDATE "User" u
        SET "statusId" = s.id
        FROM "UserStatus" s
        WHERE u."statusId" IS NULL AND s.name = u."status";

        ALTER TABLE "User" DROP COLUMN "status";
    END IF;

    -- Si existia role, asegurar que UserRole este poblado
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'role') THEN
        INSERT INTO "UserRole" ("userId", "roleId", "assignedAt")
        SELECT u.id, r.id, CURRENT_TIMESTAMP
        FROM "User" u
        JOIN "Role" r ON r.name = u."role"
        ON CONFLICT DO NOTHING;

        ALTER TABLE "User" DROP COLUMN "role";
    END IF;

    -- Eliminar columna instagramUrl si estuviera presente
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'instagramUrl') THEN
        ALTER TABLE "User" DROP COLUMN "instagramUrl";
    END IF;
END $$;

-- 4. Event: Normalizar imagenes y status
DO $$
BEGIN
    -- Sincronizar statusId antes de eliminar status
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Event' AND column_name = 'status') THEN
        UPDATE "Event" e
        SET "statusId" = s.id
        FROM "EventStatus" s
        WHERE e."statusId" IS NULL AND s.name = e."status";

        ALTER TABLE "Event" DROP COLUMN "status";
    END IF;

    -- Eliminar array images de Event
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Event' AND column_name = 'images') THEN
        ALTER TABLE "Event" DROP COLUMN "images";
    END IF;

    -- Eliminar instagramUrl de Event
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Event' AND column_name = 'instagramUrl') THEN
        ALTER TABLE "Event" DROP COLUMN "instagramUrl";
    END IF;
END $$;

-- 5. Crear Image y EventImage si no existen
CREATE TABLE IF NOT EXISTS "Image" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "url" VARCHAR(500) NOT NULL,
    "caption" VARCHAR(255),
    "fileSize" VARCHAR(50),
    "mimeType" VARCHAR(50),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "EventImage" (
    "eventId" UUID NOT NULL,
    "imageId" UUID NOT NULL,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventImage_pkey" PRIMARY KEY ("eventId", "imageId"),
    CONSTRAINT "EventImage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventImage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 6. Track: Eliminar columna redundante genreId
DO $$
BEGIN
    -- Si existe genreId en Track, asegurar que este en TrackGenre antes de remover
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Track' AND column_name = 'genreId') THEN
        INSERT INTO "TrackGenre" ("trackId", "genreId", "createdAt")
        SELECT t.id, t."genreId", CURRENT_TIMESTAMP
        FROM "Track" t
        WHERE t."genreId" IS NOT NULL
        ON CONFLICT DO NOTHING;

        ALTER TABLE "Track" DROP COLUMN "genreId";
    END IF;
END $$;

-- 7. Report: Eliminar targetType y status; agregar CHECK mutuo
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Report' AND column_name = 'targetType') THEN
        ALTER TABLE "Report" DROP COLUMN "targetType";
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Report' AND column_name = 'status') THEN
        UPDATE "Report" r
        SET "statusId" = s.id
        FROM "ReportStatus" s
        WHERE r."statusId" IS NULL AND s.name = r."status";

        ALTER TABLE "Report" DROP COLUMN "status";
    END IF;

    -- Restriccion de exclusion mutua
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Report_target_mutually_exclusive_check') THEN
        ALTER TABLE "Report" ADD CONSTRAINT "Report_target_mutually_exclusive_check" CHECK (
            ("reportedUserId" IS NOT NULL AND "reportedEventId" IS NULL) OR
            ("reportedUserId" IS NULL AND "reportedEventId" IS NOT NULL)
        );
    END IF;
END $$;

-- 8. Notification: Agregar columna readAt si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'Notification' AND column_name = 'readAt'
    ) THEN
        ALTER TABLE "Notification" ADD COLUMN "readAt" TIMESTAMPTZ;
    END IF;
END $$;

-- 9. Match e Interaction: Restricciones canonicas CHECK y UNIQUE
DO $$
BEGIN
    -- Interaction
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Interaction_not_self_check') THEN
        ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_not_self_check" CHECK ("senderId" <> "receiverId");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Interaction_sender_receiver_unique') THEN
        ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_sender_receiver_unique" UNIQUE ("senderId", "receiverId");
    END IF;

    -- Match
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Match_canonical_users_check') THEN
        ALTER TABLE "Match" ADD CONSTRAINT "Match_canonical_users_check" CHECK ("user1Id" < "user2Id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Match_user1_user2_unique') THEN
        ALTER TABLE "Match" ADD CONSTRAINT "Match_user1_user2_unique" UNIQUE ("user1Id", "user2Id");
    END IF;
END $$;
