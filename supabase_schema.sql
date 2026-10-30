-- ==============================================================================
-- LinkedSound - Script DDL Completo y Actualizado para Supabase (PostgreSQL)
-- Modelo Relacional Normalizado con UUIDs nativos, PostGIS, VARCHAR(n),
-- TIMESTAMPTZ, Catalogos de Estado y Tipos, Restricciones Canonicas y Roles N:M.
-- ==============================================================================

-- 1. Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ==============================================================================
-- 2. Limpieza de Esquema Previo (Permite re-ejecucion limpia sin conflictos
--    con tablas antiguas que tenian IDs de tipo TEXT o carecian de columnas nuevas)
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'UserReport') THEN
        EXECUTE 'DROP VIEW "UserReport" CASCADE';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'UserReport') THEN
        EXECUTE 'DROP TABLE "UserReport" CASCADE';
    END IF;
END $$;

DROP TABLE IF EXISTS "Notification" CASCADE;
DROP TABLE IF EXISTS "UserActivityLog" CASCADE;
DROP TABLE IF EXISTS "Report" CASCADE;
DROP TABLE IF EXISTS "Message" CASCADE;
DROP TABLE IF EXISTS "Conversation" CASCADE;
DROP TABLE IF EXISTS "Match" CASCADE;
DROP TABLE IF EXISTS "Interaction" CASCADE;
DROP TABLE IF EXISTS "TrackGenre" CASCADE;
DROP TABLE IF EXISTS "Track" CASCADE;
DROP TABLE IF EXISTS "EventGenre" CASCADE;
DROP TABLE IF EXISTS "Event" CASCADE;
DROP TABLE IF EXISTS "ProfileGenre" CASCADE;
DROP TABLE IF EXISTS "Genre" CASCADE;
DROP TABLE IF EXISTS "UserRole" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
DROP TABLE IF EXISTS "Location" CASCADE;
DROP TABLE IF EXISTS "ReportStatus" CASCADE;
DROP TABLE IF EXISTS "EventType" CASCADE;
DROP TABLE IF EXISTS "EventStatus" CASCADE;
DROP TABLE IF EXISTS "UserStatus" CASCADE;
DROP TABLE IF EXISTS "Role" CASCADE;

-- ==============================================================================
-- 3. Tablas de Catalogo Base y Estados Normalizados
-- ==============================================================================

-- Catalogo de Roles de Usuario (Artista, Productor, Administrador)
CREATE TABLE "Role" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) UNIQUE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Catalogo de Estados de Usuario (Active, Suspended, Pending Approval, Banned)
CREATE TABLE "UserStatus" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) UNIQUE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Catalogo de Estados de Evento (Active, Finished, Cancelled, Suspended)
CREATE TABLE "EventStatus" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) UNIQUE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Catalogo de Tipos de Evento (Live Session, Concierto, Festival, DJ Set, Acustico, Jam Session)
CREATE TABLE "EventType" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) UNIQUE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Catalogo de Estados de Reporte (Pending, Resolved, Dismissed, Under Review)
CREATE TABLE "ReportStatus" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) UNIQUE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 4. Entidad de Ubicaciones y Georreferenciacion con PostGIS
-- ==============================================================================
CREATE TABLE "Location" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(150),
    "formattedAddress" VARCHAR(255) NOT NULL,
    "country" VARCHAR(100),
    "province" VARCHAR(100),
    "city" VARCHAR(100),
    "streetAddress" VARCHAR(150),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geo_point" GEOGRAPHY(Point, 4326),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

-- ==============================================================================
-- 5. Entidad de Usuarios y Perfiles
-- ==============================================================================
CREATE TABLE "User" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "nickname" VARCHAR(50) UNIQUE NOT NULL,
    "profileImage" TEXT,
    "role" VARCHAR(50) DEFAULT 'Artista',
    "description" TEXT,
    "soundcloudUrl" VARCHAR(255),
    "spotifyUrl" VARCHAR(255),
    "instagramUrl" VARCHAR(255),
    "soundcloudHandle" VARCHAR(100),
    "locationId" UUID,
    "statusId" UUID,
    "status" VARCHAR(50) NOT NULL DEFAULT 'Active',
    "reportsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "UserStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "User_status_fkey" FOREIGN KEY ("status") REFERENCES "UserStatus"("name") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE OR REPLACE FUNCTION sync_user_status()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW."statusId" IS NOT NULL THEN
            SELECT "name" INTO NEW."status" FROM "UserStatus" WHERE "id" = NEW."statusId";
        ELSIF NEW."status" IS NOT NULL THEN
            SELECT "id" INTO NEW."statusId" FROM "UserStatus" WHERE "name" = NEW."status";
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW."statusId" IS DISTINCT FROM OLD."statusId" AND NEW."statusId" IS NOT NULL THEN
            SELECT "name" INTO NEW."status" FROM "UserStatus" WHERE "id" = NEW."statusId";
        ELSIF NEW."status" IS DISTINCT FROM OLD."status" AND NEW."status" IS NOT NULL THEN
            SELECT "id" INTO NEW."statusId" FROM "UserStatus" WHERE "name" = NEW."status";
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_sync_user_status" ON "User";
CREATE TRIGGER "trg_sync_user_status"
BEFORE INSERT OR UPDATE OF "status", "statusId" ON "User"
FOR EACH ROW
EXECUTE FUNCTION sync_user_status();

-- Tabla asociativa N:M Usuario <-> Roles (Permite ser Productor, Artista o Ambos)
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId", "roleId"),
    CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ==============================================================================
-- 6. Generos Musicales y Mapeos N:M
-- ==============================================================================
CREATE TABLE "Genre" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) UNIQUE NOT NULL,
    "slug" VARCHAR(60) UNIQUE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

-- Tabla intermedia N:M User <-> Genre
CREATE TABLE "ProfileGenre" (
    "userId" UUID NOT NULL,
    "genreId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileGenre_pkey" PRIMARY KEY ("userId", "genreId"),
    CONSTRAINT "ProfileGenre_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProfileGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ==============================================================================
-- 7. Eventos Musicales
-- ==============================================================================
CREATE TABLE "Event" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "title" VARCHAR(100) NOT NULL,
    "nickname" VARCHAR(100) NOT NULL,
    "eventTypeId" UUID,
    "eventDate" DATE NOT NULL,
    "eventTime" TIME WITHOUT TIME ZONE,
    "venue" VARCHAR(100),
    "ticketUrl" VARCHAR(500),
    "description" TEXT,
    "profileImage" TEXT,
    "locationId" UUID,
    "statusId" UUID,
    "status" VARCHAR(50) NOT NULL DEFAULT 'Active',
    "reportsCount" INTEGER NOT NULL DEFAULT 0,
    "soundcloudUrl" VARCHAR(255),
    "spotifyUrl" VARCHAR(255),
    "instagramUrl" VARCHAR(255),
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "EventType"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "EventStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_status_fkey" FOREIGN KEY ("status") REFERENCES "EventStatus"("name") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE OR REPLACE FUNCTION sync_event_status()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW."statusId" IS NOT NULL THEN
            SELECT "name" INTO NEW."status" FROM "EventStatus" WHERE "id" = NEW."statusId";
        ELSIF NEW."status" IS NOT NULL THEN
            SELECT "id" INTO NEW."statusId" FROM "EventStatus" WHERE "name" = NEW."status";
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW."statusId" IS DISTINCT FROM OLD."statusId" AND NEW."statusId" IS NOT NULL THEN
            SELECT "name" INTO NEW."status" FROM "EventStatus" WHERE "id" = NEW."statusId";
        ELSIF NEW."status" IS DISTINCT FROM OLD."status" AND NEW."status" IS NOT NULL THEN
            SELECT "id" INTO NEW."statusId" FROM "EventStatus" WHERE "name" = NEW."status";
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_sync_event_status" ON "Event";
CREATE TRIGGER "trg_sync_event_status"
BEFORE INSERT OR UPDATE OF "status", "statusId" ON "Event"
FOR EACH ROW
EXECUTE FUNCTION sync_event_status();

-- Tabla intermedia N:M Event <-> Genre
CREATE TABLE "EventGenre" (
    "eventId" UUID NOT NULL,
    "genreId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventGenre_pkey" PRIMARY KEY ("eventId", "genreId"),
    CONSTRAINT "EventGenre_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ==============================================================================
-- 8. Pistas de Audio (Tracks) y Relacion con Generos
-- ==============================================================================
CREATE TABLE "Track" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "title" VARCHAR(150) NOT NULL,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "duration" VARCHAR(10) NOT NULL DEFAULT '0:00',
    "genreId" UUID,
    "audioUrl" VARCHAR(500),
    "soundcloudLink" VARCHAR(500),
    "userId" UUID,
    "eventId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Track_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Track_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Track_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Tabla intermedia N:M Track <-> Genre para soporte multi-genero
CREATE TABLE "TrackGenre" (
    "trackId" UUID NOT NULL,
    "genreId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackGenre_pkey" PRIMARY KEY ("trackId", "genreId"),
    CONSTRAINT "TrackGenre_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrackGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ==============================================================================
-- 9. Interacciones (Likes y Pases con Restriccion Anti-duplicados)
-- ==============================================================================
CREATE TABLE "Interaction" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "senderId" UUID NOT NULL,
    "receiverId" UUID NOT NULL,
    "isLike" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Interaction_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Interaction_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Interaction_not_self_check" CHECK ("senderId" <> "receiverId"),
    CONSTRAINT "Interaction_sender_receiver_unique" UNIQUE ("senderId", "receiverId")
);

-- ==============================================================================
-- 10. Emparejamientos (Matches con Restriccion Canonica Bidireccional)
-- ==============================================================================
CREATE TABLE "Match" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user1Id" UUID NOT NULL,
    "user2Id" UUID NOT NULL,
    "affinityPercent" VARCHAR(10),
    "matchedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Match_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_canonical_users_check" CHECK ("user1Id" < "user2Id"),
    CONSTRAINT "Match_user1_user2_unique" UNIQUE ("user1Id", "user2Id")
);

-- ==============================================================================
-- 11. Conversaciones Privadas (Con Restriccion Canonica)
-- ==============================================================================
CREATE TABLE "Conversation" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user1Id" UUID NOT NULL,
    "user2Id" UUID NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Conversation_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Conversation_canonical_users_check" CHECK ("user1Id" < "user2Id"),
    CONSTRAINT "Conversation_user1_user2_unique" UNIQUE ("user1Id", "user2Id")
);

-- ==============================================================================
-- 12. Mensajes (Texto opcional cuando se envian adjuntos)
-- ==============================================================================
CREATE TABLE "Message" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "conversationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "text" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMPTZ,
    "attachmentUrl" VARCHAR(500),
    "attachmentType" VARCHAR(50),
    "attachmentName" VARCHAR(255),
    "attachmentSize" VARCHAR(50),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_content_not_empty_check" CHECK ("text" IS NOT NULL OR "attachmentUrl" IS NOT NULL)
);

-- ==============================================================================
-- 13. Reportes y Moderacion (Report - Usuarios o Eventos)
-- ==============================================================================
CREATE TABLE "Report" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "reporterUserId" UUID NOT NULL,
    "reportedUserId" UUID,
    "reportedEventId" UUID,
    "reason" VARCHAR(100) NOT NULL,
    "details" TEXT NOT NULL,
    "statusId" UUID,
    "status" VARCHAR(50) NOT NULL DEFAULT 'Pending',
    "severity" VARCHAR(20) NOT NULL DEFAULT 'Medium',
    "origin" VARCHAR(50) NOT NULL DEFAULT 'Discovery',
    "targetType" VARCHAR(20) NOT NULL DEFAULT 'Perfil',
    "adminComment" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Report_reportedEventId_fkey" FOREIGN KEY ("reportedEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Report_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "ReportStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_status_fkey" FOREIGN KEY ("status") REFERENCES "ReportStatus"("name") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_target_mutually_exclusive_check" CHECK (
        ("reportedUserId" IS NOT NULL AND "reportedEventId" IS NULL) OR
        ("reportedUserId" IS NULL AND "reportedEventId" IS NOT NULL)
    ),
    CONSTRAINT "Report_admin_comment_required_check" CHECK (
        "status" NOT IN ('Resolved', 'Dismissed') OR
        ("adminComment" IS NOT NULL AND length(trim("adminComment")) > 0)
    )
);

CREATE OR REPLACE FUNCTION sync_report_status()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW."statusId" IS NOT NULL THEN
            SELECT "name" INTO NEW."status" FROM "ReportStatus" WHERE "id" = NEW."statusId";
        ELSIF NEW."status" IS NOT NULL THEN
            SELECT "id" INTO NEW."statusId" FROM "ReportStatus" WHERE "name" = NEW."status";
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW."statusId" IS DISTINCT FROM OLD."statusId" AND NEW."statusId" IS NOT NULL THEN
            SELECT "name" INTO NEW."status" FROM "ReportStatus" WHERE "id" = NEW."statusId";
        ELSIF NEW."status" IS DISTINCT FROM OLD."status" AND NEW."status" IS NOT NULL THEN
            SELECT "id" INTO NEW."statusId" FROM "ReportStatus" WHERE "name" = NEW."status";
        END IF;
    END IF;

    IF NEW."reportedEventId" IS NOT NULL THEN
        NEW."targetType" := 'Evento';
    ELSE
        NEW."targetType" := 'Perfil';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_sync_report_status" ON "Report";
CREATE TRIGGER "trg_sync_report_status"
BEFORE INSERT OR UPDATE OF "status", "statusId", "reportedUserId", "reportedEventId" ON "Report"
FOR EACH ROW
EXECUTE FUNCTION sync_report_status();

-- Vista de compatibilidad retroactiva para consultas que apunten a UserReport
CREATE OR REPLACE VIEW "UserReport" AS
SELECT
    "id",
    "reporterUserId",
    "reportedUserId",
    "reportedEventId",
    "reason",
    "details",
    "statusId",
    "status",
    "severity",
    "origin",
    "targetType",
    "adminComment",
    "createdAt"
FROM "Report";

-- ==============================================================================
-- 14. Auditoria y Logs de Actividad (Tipo INET para IP)
-- ==============================================================================
CREATE TABLE "UserActivityLog" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "action" VARCHAR(255) NOT NULL,
    "ip" INET NOT NULL DEFAULT '127.0.0.1'::inet,
    "device" VARCHAR(255) NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ==============================================================================
-- 15. Notificaciones de Usuario
-- ==============================================================================
CREATE TABLE "Notification" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMPTZ,
    "type" VARCHAR(50) NOT NULL,
    "linkPage" VARCHAR(100),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ==============================================================================
-- 16. Indices de Alto Rendimiento
-- ==============================================================================
CREATE INDEX "Location_geo_point_idx" ON "Location" USING GIST ("geo_point");
CREATE INDEX "Location_city_province_idx" ON "Location"("city", "province");

CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");
CREATE INDEX "ProfileGenre_genreId_idx" ON "ProfileGenre"("genreId");
CREATE INDEX "EventGenre_genreId_idx" ON "EventGenre"("genreId");
CREATE INDEX "TrackGenre_genreId_idx" ON "TrackGenre"("genreId");

CREATE INDEX "User_statusId_idx" ON "User"("statusId");
CREATE INDEX "User_locationId_idx" ON "User"("locationId");
CREATE INDEX "Event_ownerId_idx" ON "Event"("ownerId");
CREATE INDEX "Event_eventTypeId_idx" ON "Event"("eventTypeId");
CREATE INDEX "Event_statusId_idx" ON "Event"("statusId");
CREATE INDEX "Event_locationId_idx" ON "Event"("locationId");
CREATE INDEX "Event_date_idx" ON "Event"("eventDate");

CREATE INDEX "Track_userId_idx" ON "Track"("userId");
CREATE INDEX "Track_eventId_idx" ON "Track"("eventId");
CREATE INDEX "Track_genreId_idx" ON "Track"("genreId");

CREATE INDEX "Interaction_senderId_idx" ON "Interaction"("senderId");
CREATE INDEX "Interaction_receiverId_idx" ON "Interaction"("receiverId");

CREATE INDEX "Match_user1Id_idx" ON "Match"("user1Id");
CREATE INDEX "Match_user2Id_idx" ON "Match"("user2Id");

CREATE INDEX "Conversation_user1Id_idx" ON "Conversation"("user1Id");
CREATE INDEX "Conversation_user2Id_idx" ON "Conversation"("user2Id");

CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

CREATE INDEX "Report_reporterUserId_idx" ON "Report"("reporterUserId");
CREATE INDEX "Report_reportedUserId_idx" ON "Report"("reportedUserId");
CREATE INDEX "Report_reportedEventId_idx" ON "Report"("reportedEventId");
CREATE INDEX "Report_statusId_idx" ON "Report"("statusId");

CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX "UserActivityLog_userId_idx" ON "UserActivityLog"("userId");

-- ==============================================================================
-- 17. Insercion de Catalogos Iniciales
-- ==============================================================================

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
    ('Resolved', 'Reporte evaluado con accion correctiva y justificacion administrativa.'),
    ('Dismissed', 'Reporte desestimado con explicacion justificada del moderador.')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "Genre" ("name", "slug", "description")
VALUES
    ('Synthwave', 'synthwave', 'Musica electronica retro-futurista inspirada en los anos 80.'),
    ('Electronic', 'electronic', 'Producciones electronicas generales y sintesis sonora.'),
    ('Dark Pop', 'dark-pop', 'Pop alternativo con tematicas oscuras e instrumentacion densa.'),
    ('Hip Hop', 'hip-hop', 'Ritmos urbanos, boom bap, trap y beats contemporaneos.'),
    ('Indie', 'indie', 'Producciones musicales independientes de diversos estilos.'),
    ('Tech House', 'tech-house', 'Subgenero de musica house con elementos y ritmos de techno.'),
    ('Ambient', 'ambient', 'Musica ambiental y atmosferas sonoras envolventes.'),
    ('Jazz', 'jazz', 'Armonias complejas, improvisacion y ensambles acusticos.'),
    ('R&B', 'r-and-b', 'Rhythm and Blues con produccion vocal moderna.'),
    ('Rock', 'rock', 'Guitarras electricas, baterias acusticas y distorsion.'),
    ('Drum & Bass', 'drum-and-bass', 'Ritmos rapidos sincopados entre 160 y 180 BPM.'),
    ('Lo-Fi', 'lo-fi', 'Estetica de baja fidelidad relajante con vinilo y cintas.'),
    ('Cyberpunk', 'cyberpunk', 'Diseno sonoro futurista y sintetizadores distorsionados.'),
    ('Industrial', 'industrial', 'Sonidos mecanicos y texturas agresivas de sintetizador.'),
    ('Hyperpop', 'hyperpop', 'Pop maximalista y acelerado con autotune experimental.'),
    ('Techno', 'techno', 'Ritmos 4x4 hipnoticos y contundentes para clubbing.'),
    ('Trap Metal', 'trap-metal', 'Fusion de ritmos 808 de trap con guitarras y gritos de metal.'),
    ('Vocal', 'vocal', 'Enfoque en arreglos y ejecucion vocal.'),
    ('ModularSynth', 'modularsynth', 'Sintesis modular analoga y generativa en tiempo real.'),
    ('Alt Pop', 'alt-pop', 'Pop alternativo vanguardista.'),
    ('Live', 'live', 'Presentaciones y grabaciones directas en vivo.')
ON CONFLICT ("name") DO UPDATE SET "slug" = EXCLUDED."slug";
