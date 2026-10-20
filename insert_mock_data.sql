-- ==============================================================================
-- LinkedSound - Script de Carga de Datos Iniciales para Supabase PostgreSQL
-- ==============================================================================
-- Instrucciones de uso:
-- 1. Accede al panel de control de Supabase (https://supabase.com/dashboard)
-- 2. Selecciona tu proyecto
-- 3. Ve a la seccion 'SQL Editor'
-- 4. Pega y ejecuta este script completo
-- 
-- Todos los comandos utilizan ON CONFLICT DO NOTHING para evitar duplicados.
-- Contrasenas de los perfiles cargados: password123
-- ==============================================================================

-- 1. Catalogo de Generos Musicales
INSERT INTO "Genre" ("id", "name", "description", "createdAt")
VALUES
  ('g0000001-0000-4000-8000-000000000001', 'Synthwave', 'Musica electronica retro-futurista inspirada en los anos 80', NOW()),
  ('g0000001-0000-4000-8000-000000000002', 'Electronic', 'Producciones electronicas generales y sintesis sonora', NOW()),
  ('g0000001-0000-4000-8000-000000000003', 'Dark Pop', 'Pop alternativo con tematicas oscuras e instrumentacion densa', NOW()),
  ('g0000001-0000-4000-8000-000000000004', 'Hip Hop', 'Ritmos urbanos, boom bap, trap y beats contemporaneos', NOW()),
  ('g0000001-0000-4000-8000-000000000005', 'Indie', 'Producciones musicales independientes de diversos estilos', NOW()),
  ('g0000001-0000-4000-8000-000000000006', 'Tech House', 'Subgenero de musica house con elementos y ritmos de techno', NOW()),
  ('g0000001-0000-4000-8000-000000000007', 'Ambient', 'Musica ambiental y atmosferas sonoras envolventes', NOW()),
  ('g0000001-0000-4000-8000-000000000008', 'Jazz', 'Armonias complejas, improvisacion y ensambles acusticos', NOW()),
  ('g0000001-0000-4000-8000-000000000009', 'R&B', 'Rhythm and Blues con produccion vocal moderna', NOW()),
  ('g0000001-0000-4000-8000-00000000010', 'Rock', 'Guitarras electricas, baterias acusticas y distorsion', NOW()),
  ('g0000001-0000-4000-8000-00000000011', 'Drum & Bass', 'Ritmos rapidos sincopados entre 160 y 180 BPM', NOW()),
  ('g0000001-0000-4000-8000-00000000012', 'Lo-Fi', 'Estetica de baja fidelidad relajante con vinilo y cintas', NOW()),
  ('g0000001-0000-4000-8000-00000000013', 'Cyberpunk', 'Diseno sonoro futurista y sintetizadores distorsionados', NOW()),
  ('g0000001-0000-4000-8000-00000000014', 'Industrial', 'Sonidos mecanicos y texturas agresivas de sintetizador', NOW()),
  ('g0000001-0000-4000-8000-00000000015', 'Hyperpop', 'Pop maximalista y acelerado con autotune experimental', NOW()),
  ('g0000001-0000-4000-8000-00000000016', 'Techno', 'Ritmos 4x4 hipnoticos y contundentes para clubbing', NOW()),
  ('g0000001-0000-4000-8000-00000000017', 'Trap Metal', 'Fusion de ritmos 808 de trap con guitarras y gritos de metal', NOW()),
  ('g0000001-0000-4000-8000-00000000018', 'Vocal', 'Enfoque en arreglos y ejecucion vocal', NOW()),
  ('g0000001-0000-4000-8000-00000000019', 'ModularSynth', 'Sintesis modular analoga y generativa en tiempo real', NOW()),
  ('g0000001-0000-4000-8000-00000000020', 'Alt Pop', 'Pop alternativo vanguardista', NOW()),
  ('g0000001-0000-4000-8000-00000000021', 'Live', 'Presentaciones y grabaciones directas en vivo', NOW())
ON CONFLICT ("name") DO NOTHING;

-- 2. Usuarios y Creadores de la Plataforma (password: password123)
INSERT INTO "User" (
  "id", "email", "password", "firstName", "lastName", "nickname",
  "profileImage", "role", "description", "soundcloudUrl", "spotifyUrl",
  "instagramUrl", "soundcloudHandle", "location", "country", "province",
  "city", "streetAddress", "latitude", "longitude", "status", "reportsCount",
  "createdAt", "updatedAt"
) VALUES
  (
    'a0000001-0001-4000-8000-000000000001',
    'kylian@dictador.music',
    '$2b$10$Erb37tOPYE4a9REsJWqw6ui2byY3rKgwoz.5p0fn3NMWYE6eqMIhi',
    'Kylian',
    'Dictador',
    'Kylian Dictador',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80',
    'Productor',
    'Productor musical y diseno sonoro especializado en sintetizadores analogicos, atmosferas cinematograficas oscuras y ritmos industriales con distorsion armonica.',
    'https://soundcloud.com/kyliandictador',
    'https://open.spotify.com/artist/kyliandictador',
    'https://instagram.com/kyliandictador',
    'kyliandictador',
    'Berlin, Germany',
    'Alemania',
    'Berlin',
    'Berlin',
    'Kreuzberg 42',
    52.5200,
    13.4050,
    'Active',
    0,
    NOW(),
    NOW()
  ),
  (
    'a0000001-0001-4000-8000-000000000002',
    'luna@sol.music',
    '$2b$10$Erb37tOPYE4a9REsJWqw6ui2byY3rKgwoz.5p0fn3NMWYE6eqMIhi',
    'Luna',
    'Sol',
    'Luna Sol',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=80',
    'Artista',
    'Cantante y compositora de melodias etereas. Fusiono texturas electronicas minimalistas con letras intimistas sobre suenos lucidos y melancolia urbana.',
    'https://soundcloud.com/lunasol',
    'https://open.spotify.com/artist/lunasol',
    'https://instagram.com/lunasol',
    'lunasol',
    'Paris, France',
    'Francia',
    'Ile-de-France',
    'Paris',
    'Montmartre 15',
    48.8566,
    2.3522,
    'Active',
    0,
    NOW(),
    NOW()
  ),
  (
    'a0000001-0001-4000-8000-000000000003',
    'facundo@doro.music',
    '$2b$10$Erb37tOPYE4a9REsJWqw6ui2byY3rKgwoz.5p0fn3NMWYE6eqMIhi',
    'Facundo',
    'Doro',
    'Facu Doro',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80',
    'Productor',
    'Productor e ingeniero de mezcla y mastering. Experimentando con ritmos urbanos, sintesis modular y diseno de bajos pesados para producciones de alto impacto.',
    'https://soundcloud.com/facudoro',
    'https://open.spotify.com/artist/facudoro',
    'https://instagram.com/facudoro',
    'facudoro',
    'Buenos Aires, Argentina',
    'Argentina',
    'Buenos Aires',
    'Palermo',
    'Av. Santa Fe 3400',
    -34.6037,
    -58.3816,
    'Active',
    0,
    NOW(),
    NOW()
  ),
  (
    'a0000001-0001-4000-8000-000000000004',
    'alex@vance.music',
    '$2b$10$Erb37tOPYE4a9REsJWqw6ui2byY3rKgwoz.5p0fn3NMWYE6eqMIhi',
    'Alex',
    'Vance',
    'Alex Vance',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=900&q=80',
    'Productor',
    'DJ y beatmaker enfocado en ritmos hiper-sincopados, drum and bass underground y microhouse para clubes de vanguardia en Europa.',
    'https://soundcloud.com/alexvance',
    'https://open.spotify.com/artist/alexvance',
    'https://instagram.com/alexvance',
    'alexvance',
    'London, United Kingdom',
    'Reino Unido',
    'Inglaterra',
    'Londres',
    'Shoreditch High St',
    51.5074,
    -0.1278,
    'Active',
    0,
    NOW(),
    NOW()
  ),
  (
    'a0000001-0001-4000-8000-000000000005',
    'elena@rostova.music',
    '$2b$10$Erb37tOPYE4a9REsJWqw6ui2byY3rKgwoz.5p0fn3NMWYE6eqMIhi',
    'Elena',
    'Rostova',
    'Elena Rostova',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80',
    'Artista',
    'Tecladista y vocalista formada en musica clasica y sintetizadores modulares. Crea melodias envolventes con matices oscuros y bajos profundos.',
    'https://soundcloud.com/elenarostova',
    'https://open.spotify.com/artist/elenarostova',
    'https://instagram.com/elenarostova',
    'elenarostova',
    'Berlin, Germany',
    'Alemania',
    'Berlin',
    'Berlin',
    'Friedrichshain 88',
    52.5200,
    13.4050,
    'Active',
    0,
    NOW(),
    NOW()
  )
ON CONFLICT ("email") DO NOTHING;

-- 3. Mapeo de Generos por Perfil (ProfileGenre)
INSERT INTO "ProfileGenre" ("userId", "genreId", "createdAt")
SELECT 'a0000001-0001-4000-8000-000000000001', id, NOW() FROM "Genre" WHERE name IN ('Synthwave', 'Industrial', 'Cyberpunk')
ON CONFLICT ("userId", "genreId") DO NOTHING;

INSERT INTO "ProfileGenre" ("userId", "genreId", "createdAt")
SELECT 'a0000001-0001-4000-8000-000000000002', id, NOW() FROM "Genre" WHERE name IN ('Electronic', 'Dark Pop', 'Ambient')
ON CONFLICT ("userId", "genreId") DO NOTHING;

INSERT INTO "ProfileGenre" ("userId", "genreId", "createdAt")
SELECT 'a0000001-0001-4000-8000-000000000003', id, NOW() FROM "Genre" WHERE name IN ('Electronic', 'Tech House', 'Hip Hop')
ON CONFLICT ("userId", "genreId") DO NOTHING;

INSERT INTO "ProfileGenre" ("userId", "genreId", "createdAt")
SELECT 'a0000001-0001-4000-8000-000000000004', id, NOW() FROM "Genre" WHERE name IN ('Drum & Bass', 'Electronic', 'Lo-Fi')
ON CONFLICT ("userId", "genreId") DO NOTHING;

INSERT INTO "ProfileGenre" ("userId", "genreId", "createdAt")
SELECT 'a0000001-0001-4000-8000-000000000005', id, NOW() FROM "Genre" WHERE name IN ('Synthwave', 'Ambient', 'Electronic')
ON CONFLICT ("userId", "genreId") DO NOTHING;

-- 4. Pistas Musicales de Ejemplo por Creador (Track)
INSERT INTO "Track" (
  "id", "title", "plays", "duration", "genre", "soundcloudLink", "userId", "createdAt"
) VALUES
  (
    't0000001-0001-4000-8000-000000000001',
    'Kylian Dictador - Neon Horizon',
    '18.2k',
    '3:45',
    'Synthwave',
    'https://soundcloud.com/kyliandictador/neon-horizon',
    'a0000001-0001-4000-8000-000000000001',
    NOW()
  ),
  (
    't0000001-0001-4000-8000-000000000002',
    'Kylian Dictador - Cyberpunk Overdrive',
    '24.5k',
    '4:10',
    'Cyberpunk',
    'https://soundcloud.com/kyliandictador/cyberpunk-overdrive',
    'a0000001-0001-4000-8000-000000000001',
    NOW()
  ),
  (
    't0000001-0001-4000-8000-000000000003',
    'Luna Sol - Midnight Echoes',
    '42.1k',
    '3:28',
    'Dark Pop',
    'https://soundcloud.com/lunasol/midnight-echoes',
    'a0000001-0001-4000-8000-000000000002',
    NOW()
  ),
  (
    't0000001-0001-4000-8000-000000000004',
    'Luna Sol - Ethereal Dreams',
    '31.8k',
    '4:02',
    'Ambient',
    'https://soundcloud.com/lunasol/ethereal-dreams',
    'a0000001-0001-4000-8000-000000000002',
    NOW()
  ),
  (
    't0000001-0001-4000-8000-000000000005',
    'Facu Doro - Buenos Aires Subterraneo',
    '15.6k',
    '3:50',
    'Tech House',
    'https://soundcloud.com/facudoro/buenos-aires-subterraneo',
    'a0000001-0001-4000-8000-000000000003',
    NOW()
  ),
  (
    't0000001-0001-4000-8000-000000000006',
    'Alex Vance - Shoreditch Pulse',
    '29.4k',
    '4:15',
    'Drum & Bass',
    'https://soundcloud.com/alexvance/shoreditch-pulse',
    'a0000001-0001-4000-8000-000000000004',
    NOW()
  ),
  (
    't0000001-0001-4000-8000-000000000007',
    'Elena Rostova - Nocturnal Shift',
    '36.7k',
    '3:35',
    'Synthwave',
    'https://soundcloud.com/elenarostova/nocturnal-shift',
    'a0000001-0001-4000-8000-000000000005',
    NOW()
  )
ON CONFLICT ("id") DO NOTHING;

-- 5. Eventos en Vivo (Event)
INSERT INTO "Event" (
  "id", "title", "nickname", "role", "eventDate", "eventTime", "venue",
  "ticketUrl", "isFinished", "description", "profileImage", "location",
  "country", "province", "city", "streetAddress", "latitude", "longitude",
  "status", "reportsCount", "soundcloudUrl", "spotifyUrl", "instagramUrl",
  "ownerId", "createdAt", "updatedAt"
) VALUES
  (
    'e0000001-0001-4000-8000-000000000001',
    'Berlin Club Night 2026',
    'Berlin Club Night',
    'Evento Live',
    '2026-11-20',
    '23:00',
    'Tresor Club, Berlin',
    'https://linkedsound.app/tickets/berlin-club-night',
    false,
    'Sesion nocturna de techno, sintetizadores modulares e iluminacion industrial con artistas internacionales.',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80',
    'Berlin, Germany',
    'Alemania',
    'Berlin',
    'Berlin',
    'Kopenicker Str. 70',
    52.5200,
    13.4050,
    'Active',
    0,
    'https://soundcloud.com/berlinclubnight',
    'https://open.spotify.com/artist/berlinclubnight',
    'https://instagram.com/berlinclubnight',
    'a0000001-0001-4000-8000-000000000001',
    NOW(),
    NOW()
  ),
  (
    'e0000001-0001-4000-8000-000000000002',
    'Paris Underground Session',
    'Paris Underground',
    'Evento Acustico & Live',
    '2026-12-05',
    '20:30',
    'Le Rex Club, Paris',
    'https://linkedsound.app/tickets/paris-underground',
    false,
    'Presentacion exclusiva de nuevos talentos de la escena independiente europea y francesa.',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=900&q=80',
    'Paris, France',
    'Francia',
    'Ile-de-France',
    'Paris',
    '5 Bd Poissonniere',
    48.8566,
    2.3522,
    'Active',
    0,
    'https://soundcloud.com/parisunderground',
    'https://open.spotify.com/artist/parisunderground',
    'https://instagram.com/parisunderground',
    'a0000001-0001-4000-8000-000000000002',
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO NOTHING;

-- 6. Mapeo de Generos por Evento (EventGenre)
INSERT INTO "EventGenre" ("eventId", "genreId", "createdAt")
SELECT 'e0000001-0001-4000-8000-000000000001', id, NOW() FROM "Genre" WHERE name IN ('Techno', 'Synthwave', 'Industrial')
ON CONFLICT ("eventId", "genreId") DO NOTHING;

INSERT INTO "EventGenre" ("eventId", "genreId", "createdAt")
SELECT 'e0000001-0001-4000-8000-000000000002', id, NOW() FROM "Genre" WHERE name IN ('Electronic', 'Dark Pop', 'Ambient')
ON CONFLICT ("eventId", "genreId") DO NOTHING;

-- 7. Reporte de Moderacion de Ejemplo (UserReport)
INSERT INTO "UserReport" (
  "id", "reporterUserId", "reportedUserId", "reportedEventId", "reason",
  "details", "status", "severity", "origin", "targetType", "adminComment", "createdAt"
) VALUES
  (
    'r0000001-0001-4000-8000-000000000001',
    'a0000001-0001-4000-8000-000000000002',
    'a0000001-0001-4000-8000-000000000001',
    NULL,
    'Inappropriate Content',
    'El perfil incluye pistas de audio con fragmentos de sample sin acreditar de otro usuario.',
    'Pending',
    'Medium',
    'Discovery',
    'Perfil',
    NULL,
    NOW()
  )
ON CONFLICT ("id") DO NOTHING;

-- 8. Registros de Auditoria y Actividad (UserActivityLog)
INSERT INTO "UserActivityLog" (
  "id", "userId", "action", "ip", "device", "module", "createdAt"
) VALUES
  (
    'l0000001-0001-4000-8000-000000000001',
    'a0000001-0001-4000-8000-000000000001',
    'Inicio de sesion exitoso',
    '185.220.101.5',
    'Desktop Chrome Windows',
    'Sistema',
    NOW() - INTERVAL '2 hours'
  ),
  (
    'l0000001-0001-4000-8000-000000000002',
    'a0000001-0001-4000-8000-000000000002',
    'Actualizacion de enlaces de Soundcloud',
    '91.134.45.12',
    'Mobile Safari iOS',
    'Perfil',
    NOW() - INTERVAL '1 hour'
  ),
  (
    'l0000001-0001-4000-8000-000000000003',
    'a0000001-0001-4000-8000-000000000003',
    'Creacion de nuevo track de audio',
    '190.18.23.44',
    'Desktop Firefox macOS',
    'Explorer',
    NOW() - INTERVAL '30 minutes'
  )
ON CONFLICT ("id") DO NOTHING;

-- 9. Conversacion y Mensajes entre Creadores (Conversation & Message)
INSERT INTO "Conversation" (
  "id", "user1Id", "user2Id", "pinned", "muted", "blocked", "createdAt", "updatedAt"
) VALUES
  (
    'c0000001-0001-4000-8000-000000000001',
    'a0000001-0001-4000-8000-000000000001',
    'a0000001-0001-4000-8000-000000000002',
    false,
    false,
    false,
    NOW() - INTERVAL '1 day',
    NOW()
  )
ON CONFLICT ("user1Id", "user2Id") DO NOTHING;

INSERT INTO "Message" (
  "id", "conversationId", "senderId", "text", "read", "createdAt"
) VALUES
  (
    'm0000001-0001-4000-8000-000000000001',
    'c0000001-0001-4000-8000-000000000001',
    'a0000001-0001-4000-8000-000000000001',
    'Hola Luna, escuche tus ultimos tracks en LinkedSound y me encanto la atmosfera. Te gustaria coordinar una sesion de produccion?',
    true,
    NOW() - INTERVAL '1 day'
  ),
  (
    'm0000001-0001-4000-8000-000000000002',
    'c0000001-0001-4000-8000-000000000001',
    'a0000001-0001-4000-8000-000000000002',
    'Hola Kylian. Muchas gracias, tus lineas de bajo analogo suenan impecables. Te comparto un enlace de SoundCloud para que veas la referencia.',
    true,
    NOW() - INTERVAL '18 hours'
  )
ON CONFLICT ("id") DO NOTHING;
