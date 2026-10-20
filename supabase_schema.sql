-- ==========================================================
-- LinkedSound - Script DDL Completo para Supabase (PostgreSQL)
-- Genera las 13 tablas relacionales con sus restricciones e indices
-- ==========================================================

-- Habilitar extension pgcrypto para generacion de UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabla: User (Perfiles de Usuarios)
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "email" TEXT UNIQUE NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nickname" TEXT UNIQUE NOT NULL,
    "profileImage" TEXT,
    "role" TEXT NOT NULL DEFAULT 'Artista',
    "description" TEXT,
    "soundcloudUrl" TEXT,
    "spotifyUrl" TEXT,
    "instagramUrl" TEXT,
    "soundcloudHandle" TEXT,
    "location" TEXT NOT NULL,
    "country" TEXT,
    "province" TEXT,
    "city" TEXT,
    "streetAddress" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "reportsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla: Genre (Catalogo de Generos Musicales)
CREATE TABLE IF NOT EXISTS "Genre" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name" TEXT UNIQUE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla: ProfileGenre (Clase Intermedia N:M User - Genre)
CREATE TABLE IF NOT EXISTS "ProfileGenre" (
    "userId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileGenre_pkey" PRIMARY KEY ("userId", "genreId"),
    CONSTRAINT "ProfileGenre_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProfileGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 4. Tabla: Event (Eventos Musicales)
CREATE TABLE IF NOT EXISTS "Event" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "title" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "eventDate" TEXT NOT NULL,
    "eventTime" TEXT,
    "venue" TEXT,
    "ticketUrl" TEXT,
    "isFinished" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "profileImage" TEXT,
    "location" TEXT NOT NULL,
    "country" TEXT,
    "province" TEXT,
    "city" TEXT,
    "streetAddress" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "reportsCount" INTEGER NOT NULL DEFAULT 0,
    "soundcloudUrl" TEXT,
    "spotifyUrl" TEXT,
    "instagramUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 5. Tabla: EventGenre (Clase Intermedia N:M Event - Genre)
CREATE TABLE IF NOT EXISTS "EventGenre" (
    "eventId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventGenre_pkey" PRIMARY KEY ("eventId", "genreId"),
    CONSTRAINT "EventGenre_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 6. Tabla: Track (Pistas de Audio)
CREATE TABLE IF NOT EXISTS "Track" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "title" TEXT NOT NULL,
    "plays" TEXT NOT NULL DEFAULT '0',
    "duration" TEXT NOT NULL DEFAULT '0:00',
    "genre" TEXT,
    "audioUrl" TEXT,
    "soundcloudLink" TEXT,
    "userId" TEXT,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Track_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Track_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 7. Tabla: Interaction (Likes y Pases)
CREATE TABLE IF NOT EXISTS "Interaction" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "isLike" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Interaction_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Interaction_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Interaction_sender_receiver_unique" UNIQUE ("senderId", "receiverId")
);

-- 8. Tabla: Match (Emparejamientos)
CREATE TABLE IF NOT EXISTS "Match" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "user1Id" TEXT NOT NULL,
    "user2Id" TEXT NOT NULL,
    "affinityPercent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Match_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_user1_user2_unique" UNIQUE ("user1Id", "user2Id")
);

-- 9. Tabla: Conversation (Salas de Chat Privadas)
CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "user1Id" TEXT NOT NULL,
    "user2Id" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Conversation_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Conversation_user1_user2_unique" UNIQUE ("user1Id", "user2Id")
);

-- 10. Tabla: Message (Mensajes)
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "attachmentUrl" TEXT,
    "attachmentType" TEXT,
    "attachmentName" TEXT,
    "attachmentSize" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 11. Tabla: UserReport (Denuncias y Moderacion)
CREATE TABLE IF NOT EXISTS "UserReport" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "reporterUserId" TEXT NOT NULL,
    "reportedUserId" TEXT,
    "reportedEventId" TEXT,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "severity" TEXT NOT NULL DEFAULT 'Medium',
    "origin" TEXT NOT NULL DEFAULT 'Discovery',
    "targetType" TEXT NOT NULL,
    "adminComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserReport_reportedEventId_fkey" FOREIGN KEY ("reportedEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 12. Tabla: UserActivityLog (Auditoria y Actividad)
CREATE TABLE IF NOT EXISTS "UserActivityLog" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 13. Tabla: Notification (Notificaciones)
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL,
    "linkPage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ==========================================================
-- Indices para optimizacion de consultas frecuentes
-- ==========================================================
CREATE INDEX IF NOT EXISTS "ProfileGenre_genreId_idx" ON "ProfileGenre"("genreId");
CREATE INDEX IF NOT EXISTS "EventGenre_genreId_idx" ON "EventGenre"("genreId");
CREATE INDEX IF NOT EXISTS "Event_ownerId_idx" ON "Event"("ownerId");
CREATE INDEX IF NOT EXISTS "Track_userId_idx" ON "Track"("userId");
CREATE INDEX IF NOT EXISTS "Track_eventId_idx" ON "Track"("eventId");
CREATE INDEX IF NOT EXISTS "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "UserActivityLog_userId_idx" ON "UserActivityLog"("userId");
