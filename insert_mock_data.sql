-- ==============================================================================
-- LinkedSound - Script de Carga de Datos Iniciales y Mock para Supabase
-- Totalmente compatible con el esquema normalizado (UUID hexadecimales validos,
-- PostGIS, VARCHAR(n), TIMESTAMPTZ, Roles N:M, Generos N:M, Tipos y Estados).
-- ==============================================================================

-- 1. Catalogo de Roles
INSERT INTO "Role" ("id", "name", "description")
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Artista', 'Musicos, vocalistas, interpretes y bandas musicales.'),
  ('00000000-0000-4000-8000-000000000002', 'Productor', 'Productores musicales, beatmakers e ingenieros de mezcla/mastering.'),
  ('00000000-0000-4000-8000-000000000003', 'Administrador', 'Personal con privilegios de gestion y moderacion de la plataforma.')
ON CONFLICT ("name") DO NOTHING;

-- 2. Catalogo de Estados de Usuario
INSERT INTO "UserStatus" ("id", "name", "description")
VALUES
  ('00000000-0000-4000-8000-000000000011', 'Active', 'Usuario activo con acceso completo.'),
  ('00000000-0000-4000-8000-000000000012', 'Suspended', 'Usuario suspendido temporalmente por moderacion.'),
  ('00000000-0000-4000-8000-000000000013', 'Pending Approval', 'Cuenta en espera de revision inicial.'),
  ('00000000-0000-4000-8000-000000000014', 'Banned', 'Cuenta inhabilitada de forma permanente.')
ON CONFLICT ("name") DO NOTHING;

-- 3. Catalogo de Estados de Evento
INSERT INTO "EventStatus" ("id", "name", "description")
VALUES
  ('00000000-0000-4000-8000-000000000021', 'Active', 'Evento publicado y proximo a realizarse.'),
  ('00000000-0000-4000-8000-000000000022', 'Finished', 'Evento que ha concluido su fecha de presentacion.'),
  ('00000000-0000-4000-8000-000000000023', 'Cancelled', 'Evento cancelado por el organizador.'),
  ('00000000-0000-4000-8000-000000000024', 'Suspended', 'Evento suspendido por moderacion.')
ON CONFLICT ("name") DO NOTHING;

-- 4. Catalogo de Tipos de Evento
INSERT INTO "EventType" ("id", "name", "description")
VALUES
  ('00000000-0000-4000-8000-000000000031', 'Live Session', 'Sesiones en vivo, streamings o sets de estudio.'),
  ('00000000-0000-4000-8000-000000000032', 'Concierto', 'Presentaciones en salas de conciertos o clubes.'),
  ('00000000-0000-4000-8000-000000000033', 'Festival', 'Festivales multidisciplinarios o con multiples artistas.'),
  ('00000000-0000-4000-8000-000000000034', 'DJ Set', 'Presentaciones de DJ o sets de mezcla continua.'),
  ('00000000-0000-4000-8000-000000000035', 'Acústico', 'Formatos desenchufados e intimistas.'),
  ('00000000-0000-4000-8000-000000000036', 'Jam Session', 'Encuentros de improvisacion y colaboracion espontanea.')
ON CONFLICT ("name") DO NOTHING;

-- 5. Catalogo de Estados de Reporte
INSERT INTO "ReportStatus" ("id", "name", "description")
VALUES
  ('00000000-0000-4000-8000-000000000041', 'Pending', 'Reporte ingresado en espera de evaluacion por moderacion.'),
  ('00000000-0000-4000-8000-000000000042', 'Under Review', 'Reporte en proceso de investigacion.'),
  ('00000000-0000-4000-8000-000000000043', 'Resolved', 'Reporte evaluado con accion correctiva y justificacion administrativa.'),
  ('00000000-0000-4000-8000-000000000044', 'Dismissed', 'Reporte desestimado con explicacion justificada del moderador.')
ON CONFLICT ("name") DO NOTHING;

-- 6. Catalogo de Generos Musicales con Slug normalizado y UUIDs hexadecimales validos
INSERT INTO "Genre" ("id", "name", "slug", "description")
VALUES
  ('c0000001-0000-4000-8000-000000000001', 'Synthwave', 'synthwave', 'Musica electronica retro-futurista inspirada en los anos 80'),
  ('c0000001-0000-4000-8000-000000000002', 'Electronic', 'electronic', 'Producciones electronicas generales y sintesis sonora'),
  ('c0000001-0000-4000-8000-000000000003', 'Dark Pop', 'dark-pop', 'Pop alternativo con tematicas oscuras e instrumentacion densa'),
  ('c0000001-0000-4000-8000-000000000004', 'Hip Hop', 'hip-hop', 'Ritmos urbanos, boom bap, trap y beats contemporaneos'),
  ('c0000001-0000-4000-8000-000000000005', 'Indie', 'indie', 'Producciones musicales independientes de diversos estilos'),
  ('c0000001-0000-4000-8000-000000000006', 'Tech House', 'tech-house', 'Subgenero de musica house con elementos y ritmos de techno'),
  ('c0000001-0000-4000-8000-000000000007', 'Ambient', 'ambient', 'Musica ambiental y atmosferas sonoras envolventes'),
  ('c0000001-0000-4000-8000-000000000008', 'Jazz', 'jazz', 'Armonias complejas, improvisacion y ensambles acusticos'),
  ('c0000001-0000-4000-8000-000000000009', 'R&B', 'r-and-b', 'Rhythm and Blues con produccion vocal moderna'),
  ('c0000001-0000-4000-8000-000000000010', 'Rock', 'rock', 'Guitarras electricas, baterias acusticas y distorsion'),
  ('c0000001-0000-4000-8000-000000000011', 'Drum & Bass', 'drum-and-bass', 'Ritmos rapidos sincopados entre 160 y 180 BPM'),
  ('c0000001-0000-4000-8000-000000000012', 'Lo-Fi', 'lo-fi', 'Estetica de baja fidelidad relajante con vinilo y cintas'),
  ('c0000001-0000-4000-8000-000000000013', 'Cyberpunk', 'cyberpunk', 'Diseno sonoro futurista y sintetizadores distorsionados'),
  ('c0000001-0000-4000-8000-000000000014', 'Industrial', 'industrial', 'Sonidos mecanicos y texturas agresivas de sintetizador'),
  ('c0000001-0000-4000-8000-000000000015', 'Hyperpop', 'hyperpop', 'Pop maximalista y acelerado con autotune experimental'),
  ('c0000001-0000-4000-8000-000000000016', 'Techno', 'techno', 'Ritmos 4x4 hipnoticos y contundentes para clubbing'),
  ('c0000001-0000-4000-8000-000000000017', 'Trap Metal', 'trap-metal', 'Fusion de ritmos 808 de trap con guitarras y gritos de metal'),
  ('c0000001-0000-4000-8000-000000000018', 'Vocal', 'vocal', 'Enfoque en arreglos y ejecucion vocal'),
  ('c0000001-0000-4000-8000-000000000019', 'ModularSynth', 'modularsynth', 'Sintesis modular analoga y generativa en tiempo real'),
  ('c0000001-0000-4000-8000-000000000020', 'Alt Pop', 'alt-pop', 'Pop alternativo vanguardista'),
  ('c0000001-0000-4000-8000-000000000021', 'Live', 'live', 'Presentaciones y grabaciones directas en vivo')
ON CONFLICT ("name") DO UPDATE SET "slug" = EXCLUDED."slug";

-- 7. Ubicaciones Normalizadas (Location con coordenadas y calculo de punto PostGIS)
INSERT INTO "Location" (
  "id", "name", "formattedAddress", "country", "province", "city", "streetAddress", "latitude", "longitude"
) VALUES
  ('b0000001-0001-4000-8000-000000000001', 'Kreuzberg Studio', 'Berlin, Germany', 'Alemania', 'Berlin', 'Berlin', 'Kreuzberg 42', 52.5200, 13.4050),
  ('b0000001-0001-4000-8000-000000000002', 'Montmartre Acoustic Room', 'Paris, France', 'Francia', 'Ile-de-France', 'Paris', 'Montmartre 15', 48.8566, 2.3522),
  ('b0000001-0001-4000-8000-000000000003', 'Palermo Sound Lab', 'Buenos Aires, Argentina', 'Argentina', 'Buenos Aires', 'Palermo', 'Av. Santa Fe 3400', -34.6037, -58.3816),
  ('b0000001-0001-4000-8000-000000000004', 'Shoreditch Beats', 'London, United Kingdom', 'Reino Unido', 'Inglaterra', 'Londres', 'Shoreditch High St', 51.5074, -0.1278),
  ('b0000001-0001-4000-8000-000000000005', 'Friedrichshain Synth Hub', 'Berlin, Germany', 'Alemania', 'Berlin', 'Berlin', 'Friedrichshain 88', 52.5200, 13.4050),
  ('b0000001-0001-4000-8000-000000000010', 'Tresor Club', 'Berlin, Germany', 'Alemania', 'Berlin', 'Berlin', 'Kopenicker Str. 70', 52.5200, 13.4050),
  ('b0000001-0001-4000-8000-000000000011', 'Le Rex Club', 'Paris, France', 'Francia', 'Ile-de-France', 'Paris', '5 Bd Poissonniere', 48.8566, 2.3522)
ON CONFLICT ("id") DO NOTHING;

-- 8. Usuarios de Prueba (Password: password123)
INSERT INTO "User" (
  "id", "email", "password", "firstName", "lastName", "nickname", "role",
  "profileImage", "description", "soundcloudUrl", "spotifyUrl",
  "instagramUrl", "soundcloudHandle", "locationId", "status", "reportsCount",
  "createdAt", "updatedAt"
) VALUES
  (
    'a0000001-0001-4000-8000-000000000001',
    'kylian@dictador.music',
    '$2b$10$Erb37tOPYE4a9REsJWqw6ui2byY3rKgwoz.5p0fn3NMWYE6eqMIhi',
    'Kylian',
    'Dictador',
    'Kylian Dictador',
    'Productor',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80',
    'Productor musical y diseno sonoro especializado en sintetizadores analogicos, atmosferas cinematograficas oscuras y ritmos industriales con distorsion armonica.',
    'https://soundcloud.com/kyliandictador',
    'https://open.spotify.com/artist/kyliandictador',
    'https://instagram.com/kyliandictador',
    'kyliandictador',
    'b0000001-0001-4000-8000-000000000001',
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
    'Artista',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=80',
    'Cantante y compositora de melodias etereas. Fusiono texturas electronicas minimalistas con letras intimistas sobre suenos lucidos y melancolia urbana.',
    'https://soundcloud.com/lunasol',
    'https://open.spotify.com/artist/lunasol',
    'https://instagram.com/lunasol',
    'lunasol',
    'b0000001-0001-4000-8000-000000000002',
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
    'Productor y Artista',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80',
    'Productor e ingeniero de mezcla y mastering. Experimentando con ritmos urbanos, sintesis modular y diseno de bajos pesados para producciones de alto impacto.',
    'https://soundcloud.com/facudoro',
    'https://open.spotify.com/artist/facudoro',
    'https://instagram.com/facudoro',
    'facudoro',
    'b0000001-0001-4000-8000-000000000003',
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
    'Productor',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=900&q=80',
    'DJ y beatmaker enfocado en ritmos hiper-sincopados, drum and bass underground y microhouse para clubes de vanguardia en Europa.',
    'https://soundcloud.com/alexvance',
    'https://open.spotify.com/artist/alexvance',
    'https://instagram.com/alexvance',
    'alexvance',
    'b0000001-0001-4000-8000-000000000004',
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
    'Artista',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80',
    'Tecladista y vocalista formada en musica clasica y sintetizadores modulares. Crea melodias envolventes con matices oscuros y bajos profundos.',
    'https://soundcloud.com/elenarostova',
    'https://open.spotify.com/artist/elenarostova',
    'https://instagram.com/elenarostova',
    'elenarostova',
    'b0000001-0001-4000-8000-000000000005',
    'Active',
    0,
    NOW(),
    NOW()
  )
ON CONFLICT ("email") DO NOTHING;

-- 9. Asignacion de Roles N:M a Usuarios (UserRole)
INSERT INTO "UserRole" ("userId", "roleId")
SELECT 'a0000001-0001-4000-8000-000000000001', id FROM "Role" WHERE name = 'Productor'
ON CONFLICT ("userId", "roleId") DO NOTHING;

INSERT INTO "UserRole" ("userId", "roleId")
SELECT 'a0000001-0001-4000-8000-000000000002', id FROM "Role" WHERE name = 'Artista'
ON CONFLICT ("userId", "roleId") DO NOTHING;

INSERT INTO "UserRole" ("userId", "roleId")
SELECT 'a0000001-0001-4000-8000-000000000003', id FROM "Role" WHERE name IN ('Productor', 'Artista')
ON CONFLICT ("userId", "roleId") DO NOTHING;

INSERT INTO "UserRole" ("userId", "roleId")
SELECT 'a0000001-0001-4000-8000-000000000004', id FROM "Role" WHERE name = 'Productor'
ON CONFLICT ("userId", "roleId") DO NOTHING;

INSERT INTO "UserRole" ("userId", "roleId")
SELECT 'a0000001-0001-4000-8000-000000000005', id FROM "Role" WHERE name = 'Artista'
ON CONFLICT ("userId", "roleId") DO NOTHING;

-- 10. Mapeo de Generos por Perfil (ProfileGenre)
INSERT INTO "ProfileGenre" ("userId", "genreId")
SELECT 'a0000001-0001-4000-8000-000000000001', id FROM "Genre" WHERE name IN ('Synthwave', 'Industrial', 'Cyberpunk')
ON CONFLICT ("userId", "genreId") DO NOTHING;

INSERT INTO "ProfileGenre" ("userId", "genreId")
SELECT 'a0000001-0001-4000-8000-000000000002', id FROM "Genre" WHERE name IN ('Electronic', 'Dark Pop', 'Ambient')
ON CONFLICT ("userId", "genreId") DO NOTHING;

INSERT INTO "ProfileGenre" ("userId", "genreId")
SELECT 'a0000001-0001-4000-8000-000000000003', id FROM "Genre" WHERE name IN ('Electronic', 'Tech House', 'Hip Hop')
ON CONFLICT ("userId", "genreId") DO NOTHING;

INSERT INTO "ProfileGenre" ("userId", "genreId")
SELECT 'a0000001-0001-4000-8000-000000000004', id FROM "Genre" WHERE name IN ('Drum & Bass', 'Electronic', 'Lo-Fi')
ON CONFLICT ("userId", "genreId") DO NOTHING;

INSERT INTO "ProfileGenre" ("userId", "genreId")
SELECT 'a0000001-0001-4000-8000-000000000005', id FROM "Genre" WHERE name IN ('Synthwave', 'Ambient', 'Electronic')
ON CONFLICT ("userId", "genreId") DO NOTHING;

-- 11. Pistas Musicales (Track con reproducciones enteras y FK a Genre)
INSERT INTO "Track" (
  "id", "title", "plays", "duration", "genreId", "soundcloudLink", "userId", "createdAt"
) VALUES
  (
    'd0000001-0001-4000-8000-000000000001',
    'Kylian Dictador - Neon Horizon',
    18200,
    '3:45',
    (SELECT id FROM "Genre" WHERE name = 'Synthwave' LIMIT 1),
    'https://soundcloud.com/kyliandictador/neon-horizon',
    'a0000001-0001-4000-8000-000000000001',
    NOW()
  ),
  (
    'd0000001-0001-4000-8000-000000000002',
    'Kylian Dictador - Cyberpunk Overdrive',
    24500,
    '4:10',
    (SELECT id FROM "Genre" WHERE name = 'Cyberpunk' LIMIT 1),
    'https://soundcloud.com/kyliandictador/cyberpunk-overdrive',
    'a0000001-0001-4000-8000-000000000001',
    NOW()
  ),
  (
    'd0000001-0001-4000-8000-000000000003',
    'Luna Sol - Midnight Echoes',
    42100,
    '3:28',
    (SELECT id FROM "Genre" WHERE name = 'Dark Pop' LIMIT 1),
    'https://soundcloud.com/lunasol/midnight-echoes',
    'a0000001-0001-4000-8000-000000000002',
    NOW()
  ),
  (
    'd0000001-0001-4000-8000-000000000004',
    'Luna Sol - Ethereal Dreams',
    31800,
    '4:02',
    (SELECT id FROM "Genre" WHERE name = 'Ambient' LIMIT 1),
    'https://soundcloud.com/lunasol/ethereal-dreams',
    'a0000001-0001-4000-8000-000000000002',
    NOW()
  ),
  (
    'd0000001-0001-4000-8000-000000000005',
    'Facu Doro - Buenos Aires Subterraneo',
    15600,
    '3:50',
    (SELECT id FROM "Genre" WHERE name = 'Tech House' LIMIT 1),
    'https://soundcloud.com/facudoro/buenos-aires-subterraneo',
    'a0000001-0001-4000-8000-000000000003',
    NOW()
  ),
  (
    'd0000001-0001-4000-8000-000000000006',
    'Alex Vance - Shoreditch Pulse',
    29400,
    '4:15',
    (SELECT id FROM "Genre" WHERE name = 'Drum & Bass' LIMIT 1),
    'https://soundcloud.com/alexvance/shoreditch-pulse',
    'a0000001-0001-4000-8000-000000000004',
    NOW()
  ),
  (
    'd0000001-0001-4000-8000-000000000007',
    'Elena Rostova - Nocturnal Shift',
    36700,
    '3:35',
    (SELECT id FROM "Genre" WHERE name = 'Synthwave' LIMIT 1),
    'https://soundcloud.com/elenarostova/nocturnal-shift',
    'a0000001-0001-4000-8000-000000000005',
    NOW()
  )
ON CONFLICT ("id") DO NOTHING;

-- Mapeo N:M TrackGenre
INSERT INTO "TrackGenre" ("trackId", "genreId")
SELECT 'd0000001-0001-4000-8000-000000000001', id FROM "Genre" WHERE name IN ('Synthwave', 'Electronic')
ON CONFLICT ("trackId", "genreId") DO NOTHING;

INSERT INTO "TrackGenre" ("trackId", "genreId")
SELECT 'd0000001-0001-4000-8000-000000000002', id FROM "Genre" WHERE name IN ('Cyberpunk', 'Industrial')
ON CONFLICT ("trackId", "genreId") DO NOTHING;

INSERT INTO "TrackGenre" ("trackId", "genreId")
SELECT 'd0000001-0001-4000-8000-000000000003', id FROM "Genre" WHERE name IN ('Dark Pop', 'Electronic')
ON CONFLICT ("trackId", "genreId") DO NOTHING;

-- 12. Eventos en Vivo (Event con DATE, TIME, Type, Status, sin Role ni isFinished)
INSERT INTO "Event" (
  "id", "title", "nickname", "eventTypeId", "eventDate", "eventTime", "venue",
  "ticketUrl", "description", "profileImage", "locationId",
  "status", "reportsCount", "soundcloudUrl", "spotifyUrl", "instagramUrl",
  "ownerId", "createdAt", "updatedAt"
) VALUES
  (
    'e0000001-0001-4000-8000-000000000001',
    'Berlin Club Night 2026',
    'Berlin Club Night',
    (SELECT id FROM "EventType" WHERE name = 'DJ Set' LIMIT 1),
    '2026-11-20',
    '23:00',
    'Tresor Club',
    'https://linkedsound.app/tickets/berlin-club-night',
    'Sesion nocturna de techno, sintetizadores modulares e iluminacion industrial con artistas internacionales.',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80',
    'b0000001-0001-4000-8000-000000000010',
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
    (SELECT id FROM "EventType" WHERE name = 'Concierto' LIMIT 1),
    '2026-12-05',
    '20:30',
    'Le Rex Club',
    'https://linkedsound.app/tickets/paris-underground',
    'Presentacion exclusiva de nuevos talentos de la escena independiente europea y francesa.',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=900&q=80',
    'b0000001-0001-4000-8000-000000000011',
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

-- 13. Mapeo de Generos por Evento (EventGenre)
INSERT INTO "EventGenre" ("eventId", "genreId")
SELECT 'e0000001-0001-4000-8000-000000000001', id FROM "Genre" WHERE name IN ('Techno', 'Synthwave', 'Industrial')
ON CONFLICT ("eventId", "genreId") DO NOTHING;

INSERT INTO "EventGenre" ("eventId", "genreId")
SELECT 'e0000001-0001-4000-8000-000000000002', id FROM "Genre" WHERE name IN ('Electronic', 'Dark Pop', 'Ambient')
ON CONFLICT ("eventId", "genreId") DO NOTHING;

-- 14. Reportes de Moderacion (Report con target mutuamente excluyente y regla de adminComment)
INSERT INTO "Report" (
  "id", "reporterUserId", "reportedUserId", "reportedEventId", "reason",
  "details", "status", "severity", "origin", "adminComment", "createdAt"
) VALUES
  (
    'f0000001-0001-4000-8000-000000000001',
    'a0000001-0001-4000-8000-000000000002',
    'a0000001-0001-4000-8000-000000000001',
    NULL,
    'Contenido inapropiado o explícito',
    'El perfil incluye pistas de audio con fragmentos de sample sin acreditar de otro usuario.',
    'Pending',
    'Medium',
    'Discovery',
    NULL,
    NOW()
  )
ON CONFLICT ("id") DO NOTHING;

-- 15. Registros de Auditoria (UserActivityLog con tipo INET)
INSERT INTO "UserActivityLog" (
  "id", "userId", "action", "ip", "device", "module", "createdAt"
) VALUES
  (
    '10000001-0001-4000-8000-000000000001',
    'a0000001-0001-4000-8000-000000000001',
    'Inicio de sesion exitoso',
    '185.220.101.5'::inet,
    'Desktop Chrome Windows',
    'Sistema',
    NOW() - INTERVAL '2 hours'
  ),
  (
    '10000001-0001-4000-8000-000000000002',
    'a0000001-0001-4000-8000-000000000002',
    'Actualizacion de enlaces de Soundcloud',
    '91.134.45.12'::inet,
    'Mobile Safari iOS',
    'Perfil',
    NOW() - INTERVAL '1 hour'
  ),
  (
    '10000001-0001-4000-8000-000000000003',
    'a0000001-0001-4000-8000-000000000003',
    'Creacion de nuevo track de audio',
    '190.18.23.44'::inet,
    'Desktop Firefox macOS',
    'Explorer',
    NOW() - INTERVAL '30 minutes'
  )
ON CONFLICT ("id") DO NOTHING;

-- 16. Conversaciones Privadas (Con orden canonico user1Id < user2Id)
INSERT INTO "Conversation" (
  "id", "user1Id", "user2Id", "pinned", "muted", "blocked", "createdAt", "updatedAt"
) VALUES
  (
    '20000001-0001-4000-8000-000000000001',
    'a0000001-0001-4000-8000-000000000001',
    'a0000001-0001-4000-8000-000000000002',
    false,
    false,
    false,
    NOW() - INTERVAL '1 day',
    NOW()
  )
ON CONFLICT ("user1Id", "user2Id") DO NOTHING;

-- 17. Mensajes de Chat (Con isRead y readAt)
INSERT INTO "Message" (
  "id", "conversationId", "senderId", "text", "isRead", "readAt", "createdAt"
) VALUES
  (
    '30000001-0001-4000-8000-000000000001',
    '20000001-0001-4000-8000-000000000001',
    'a0000001-0001-4000-8000-000000000001',
    'Hola Luna, escuche tus ultimos tracks en LinkedSound y me encanto la atmosfera. Te gustaria coordinar una sesion de produccion?',
    true,
    NOW() - INTERVAL '23 hours',
    NOW() - INTERVAL '1 day'
  ),
  (
    '30000001-0001-4000-8000-000000000002',
    '20000001-0001-4000-8000-000000000001',
    'a0000001-0001-4000-8000-000000000002',
    'Hola Kylian. Muchas gracias, tus lineas de bajo analogo suenan impecables. Te comparto un enlace de SoundCloud para que veas la referencia.',
    true,
    NOW() - INTERVAL '17 hours',
    NOW() - INTERVAL '18 hours'
  )
ON CONFLICT ("id") DO NOTHING;

-- 18. Notificaciones Iniciales (Con isRead y readAt)
INSERT INTO "Notification" (
  "id", "userId", "title", "message", "isRead", "readAt", "type", "linkPage", "createdAt"
) VALUES
  (
    '40000001-0001-4000-8000-000000000001',
    'a0000001-0001-4000-8000-000000000001',
    'Bienvenido a LinkedSound',
    'Explora nuevos productores y artistas en la seccion Discovery.',
    true,
    NOW() - INTERVAL '1 day',
    'system',
    'Discovery',
    NOW() - INTERVAL '2 days'
  )
ON CONFLICT ("id") DO NOTHING;
