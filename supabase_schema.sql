-- ==============================================================================
-- LinkedSound - Script DDL Completo y Actualizado para Supabase (PostgreSQL)
-- Modelo Relacional Normalizado con VARCHAR(N), UUIDs nativos, PostGIS geography,
-- TIMESTAMPTZ, Catalogos de Estado y Tipos, Entidades Normalizadas de Imagen,
-- y Restricciones Canonicas CHECK / UNIQUE sin redundancias.
-- ==============================================================================

-- 1. Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ==============================================================================
-- 2. Limpieza de Esquema Previo
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
DROP TABLE IF EXISTS "MusicalKey" CASCADE;
DROP TABLE IF EXISTS "SnippetType" CASCADE;
DROP TABLE IF EXISTS "EventImage" CASCADE;
DROP TABLE IF EXISTS "Image" CASCADE;
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

-- Catalogo de Estados de Reporte (Pending, Under Review, Resolved, Dismissed)
CREATE TABLE "ReportStatus" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) UNIQUE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 4. Entidad de Ubicaciones y Georreferenciacion con PostGIS
-- Eliminadas redundancias (name, latitude, longitude); unificado en geo_point.
-- ==============================================================================
CREATE TABLE "Location" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "formattedAddress" VARCHAR(255) NOT NULL,
    "country" VARCHAR(100),
    "province" VARCHAR(100),
    "city" VARCHAR(100),
    "streetAddress" VARCHAR(150),
    "geo_point" GEOGRAPHY(Point, 4326),
    "srid" INTEGER DEFAULT 4326,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 5. Entidad de Usuarios y Perfiles
-- Normalizada: rol gestionado en UserRole; status gestionado exclusivamente por statusId.
-- ==============================================================================
CREATE TABLE "User" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "nickname" VARCHAR(50) UNIQUE NOT NULL,
    "profileImage" TEXT,
    "description" TEXT,
    "soundcloudUrl" VARCHAR(255),
    "spotifyUrl" VARCHAR(255),
    "soundcloudHandle" VARCHAR(100),
    "locationId" UUID,
    "statusId" UUID NOT NULL,
    "reportsCount" INTEGER NOT NULL DEFAULT 0,
    "accountRole" VARCHAR(50) NOT NULL DEFAULT 'Usuario',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "UserStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Tabla asociativa N:M Usuario <-> Roles
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
-- 7. Eventos Musicales e Imagenes Normalizadas
-- Normalizado: eliminada columna images (array); status gestionado por statusId.
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
    "statusId" UUID NOT NULL,
    "reportsCount" INTEGER NOT NULL DEFAULT 0,
    "soundcloudUrl" VARCHAR(255),
    "spotifyUrl" VARCHAR(255),
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "EventType"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "EventStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Entidad normalizada de Imagenes
CREATE TABLE "Image" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "url" VARCHAR(500) NOT NULL,
    "caption" VARCHAR(255),
    "fileSize" VARCHAR(50),
    "mimeType" VARCHAR(50),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabla intermedia N:M Event <-> Image con indicador de portada (isCover)
CREATE TABLE "EventImage" (
    "eventId" UUID NOT NULL,
    "imageId" UUID NOT NULL,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventImage_pkey" PRIMARY KEY ("eventId", "imageId"),
    CONSTRAINT "EventImage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventImage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
-- 8. Pistas de Audio (Tracks), SnippetTypes, MusicalKeys y Generos N:M
-- Normalizado: eliminada columna genreId de Track en favor de TrackGenre.
-- ==============================================================================
CREATE TABLE "SnippetType" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) UNIQUE NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "MusicalKey" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) UNIQUE NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Track" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "title" VARCHAR(150) NOT NULL,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "duration" VARCHAR(10) NOT NULL DEFAULT '0:00',
    "audioUrl" VARCHAR(500),
    "soundcloudLink" VARCHAR(500),
    "userId" UUID,
    "eventId" UUID,
    "format" VARCHAR(50),
    "snippetType" VARCHAR(50),
    "bpm" VARCHAR(50),
    "key" VARCHAR(50),
    "fileSize" VARCHAR(50),
    "order" INTEGER DEFAULT 0,
    "snippetTypeId" UUID,
    "musicalKeyId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Track_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Track_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Track_snippetTypeId_fkey" FOREIGN KEY ("snippetTypeId") REFERENCES "SnippetType"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Track_musicalKeyId_fkey" FOREIGN KEY ("musicalKeyId") REFERENCES "MusicalKey"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Tabla intermedia N:M Track <-> Genre
CREATE TABLE "TrackGenre" (
    "trackId" UUID NOT NULL,
    "genreId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackGenre_pkey" PRIMARY KEY ("trackId", "genreId"),
    CONSTRAINT "TrackGenre_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrackGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ==============================================================================
-- 9. Interacciones (Likes y Pases con Restricciones Canonicas)
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
-- 12. Mensajes (Texto opcional con adjuntos; readAt registrado)
-- ==============================================================================
CREATE TABLE "Message" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "conversationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "text" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMPTZ,
    "attachmentUrl" TEXT,
    "attachmentType" VARCHAR(50),
    "attachmentName" VARCHAR(255),
    "attachmentSize" VARCHAR(50),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_content_not_empty_check" CHECK ("text" IS NOT NULL OR "attachmentUrl" IS NOT NULL)
);

-- ==============================================================================
-- 13. Reportes y Moderacion
-- Normalizado: eliminados targetType y status redundant; CHECK de exclusion mutua.
-- ==============================================================================
CREATE TABLE "Report" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "reporterUserId" UUID NOT NULL,
    "reportedUserId" UUID,
    "reportedEventId" UUID,
    "reason" VARCHAR(100) NOT NULL,
    "details" TEXT NOT NULL,
    "statusId" UUID NOT NULL,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'Medium',
    "origin" VARCHAR(50) NOT NULL DEFAULT 'Discovery',
    "adminComment" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Report_reportedEventId_fkey" FOREIGN KEY ("reportedEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Report_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "ReportStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_target_mutually_exclusive_check" CHECK (
        ("reportedUserId" IS NOT NULL AND "reportedEventId" IS NULL) OR
        ("reportedUserId" IS NULL AND "reportedEventId" IS NOT NULL)
    ),
    CONSTRAINT "Report_admin_comment_required_check" CHECK (
        "adminComment" IS NULL OR length(trim("adminComment")) > 0
    )
);

-- ==============================================================================
-- 14. Auditoria y Logs de Actividad
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
-- Normalizado: readAt incluido para auditar fecha y hora de lectura.
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
-- 16. Indices de Rendimiento
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
CREATE INDEX "Track_snippetTypeId_idx" ON "Track"("snippetTypeId");
CREATE INDEX "Track_musicalKeyId_idx" ON "Track"("musicalKeyId");

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
    ('Resolved', 'Reporte evaluado con accion correctiva.'),
    ('Dismissed', 'Reporte desestimado con explicacion justificada.')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "SnippetType" ("name", "description", "order")
VALUES
    ('SOLO GUITARRA / LEAD', 'Solo instrumental o fraseo principal', 1),
    ('DROP / ESTRIBILLO', 'Punto de mayor energia ritmica y armonica', 2),
    ('INTRO / BUILD-UP', 'Introduccion o construccion sonora inicial', 3),
    ('BEAT / DRUM PATTERN', 'Base ritmica y percusion destacada', 4),
    ('VOCAL HOOK', 'Frase vocal o coro pegadizo', 5)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "MusicalKey" ("name", "description", "order")
VALUES
    ('C Major', 'Do Mayor (8B)', 1),
    ('A Minor', 'La Menor (8A)', 2),
    ('G Major', 'Sol Mayor (9B)', 3),
    ('E Minor', 'Mi Menor (9A)', 4),
    ('D Major', 'Re Mayor (10B)', 5),
    ('B Minor', 'Si Menor (10A)', 6),
    ('F Major', 'Fa Mayor (7B)', 7),
    ('D Minor', 'Re Menor (7A)', 8)
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
