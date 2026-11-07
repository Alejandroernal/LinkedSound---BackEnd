import { query, pool } from './config/db.js'
import { hashPassword } from './utils/password.js'

const GENRES = [
  { name: 'Synthwave', slug: 'synthwave' },
  { name: 'Electronic', slug: 'electronic' },
  { name: 'Dark Pop', slug: 'dark-pop' },
  { name: 'Hip Hop', slug: 'hip-hop' },
  { name: 'Indie', slug: 'indie' },
  { name: 'Tech House', slug: 'tech-house' },
  { name: 'Ambient', slug: 'ambient' },
  { name: 'Jazz', slug: 'jazz' },
  { name: 'R&B', slug: 'r-and-b' },
  { name: 'Rock', slug: 'rock' },
  { name: 'Drum & Bass', slug: 'drum-and-bass' },
  { name: 'Lo-Fi', slug: 'lo-fi' },
  { name: 'Cyberpunk', slug: 'cyberpunk' },
  { name: 'Industrial', slug: 'industrial' },
  { name: 'Hyperpop', slug: 'hyperpop' },
  { name: 'Techno', slug: 'techno' },
  { name: 'Trap Metal', slug: 'trap-metal' },
  { name: 'Vocal', slug: 'vocal' },
  { name: 'ModularSynth', slug: 'modularsynth' },
  { name: 'Alt Pop', slug: 'alt-pop' },
  { name: 'Live', slug: 'live' },
]

const ROLES = [
  { name: 'Artista', description: 'Musicos, cantantes, interpretes y bandas musicales.' },
  { name: 'Productor', description: 'Productores musicales, beatmakers e ingenieros de sonido.' },
  { name: 'Administrador', description: 'Personal administrativo y moderador de la plataforma.' },
]

const USER_STATUSES = [
  { name: 'Active', description: 'Usuario activo con acceso completo.' },
  { name: 'Suspended', description: 'Usuario suspendido temporalmente por moderacion.' },
  { name: 'Pending Approval', description: 'Cuenta en espera de revision inicial.' },
  { name: 'Banned', description: 'Cuenta inhabilitada de forma permanente.' },
]

const EVENT_STATUSES = [
  { name: 'Active', description: 'Evento publicado y proximo a realizarse.' },
  { name: 'Finished', description: 'Evento que ha concluido su fecha de presentacion.' },
  { name: 'Cancelled', description: 'Evento cancelado por el organizador.' },
  { name: 'Suspended', description: 'Evento suspendido por moderacion.' },
]

const EVENT_TYPES = [
  { name: 'Live Session', description: 'Sesiones en vivo, streamings o sets de estudio.' },
  { name: 'Concierto', description: 'Presentaciones en salas de conciertos o clubes.' },
  { name: 'Festival', description: 'Festivales multidisciplinarios o con multiples artistas.' },
  { name: 'DJ Set', description: 'Presentaciones de DJ o sets de mezcla continua.' },
  { name: 'Acústico', description: 'Formatos desenchufados e intimistas.' },
  { name: 'Jam Session', description: 'Encuentros de improvisacion y colaboracion espontanea.' },
]

const REPORT_STATUSES = [
  { name: 'Pending', description: 'Reporte ingresado en espera de evaluacion por moderacion.' },
  { name: 'Under Review', description: 'Reporte en proceso de investigacion.' },
  { name: 'Resolved', description: 'Reporte evaluado con accion correctiva.' },
  { name: 'Dismissed', description: 'Reporte desestimado con explicacion justificada.' },
]

async function seed() {
  console.log('Iniciando sincronizacion basica de base de datos nativa en PostgreSQL...')

  // 1. Roles
  for (const r of ROLES) {
    await query(`
      INSERT INTO "Role" (id, name, description, "createdAt")
      VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;
    `, [r.name, r.description])
  }
  console.log('Catalogo de Roles sincronizado.')

  // 2. Estados de usuario
  for (const st of USER_STATUSES) {
    await query(`
      INSERT INTO "UserStatus" (id, name, description, "createdAt")
      VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;
    `, [st.name, st.description])
  }

  // 3. Estados de eventos
  for (const st of EVENT_STATUSES) {
    await query(`
      INSERT INTO "EventStatus" (id, name, description, "createdAt")
      VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;
    `, [st.name, st.description])
  }

  // 4. Tipos de evento
  for (const et of EVENT_TYPES) {
    await query(`
      INSERT INTO "EventType" (id, name, description, "createdAt")
      VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;
    `, [et.name, et.description])
  }

  // 5. Estados de reportes
  for (const st of REPORT_STATUSES) {
    await query(`
      INSERT INTO "ReportStatus" (id, name, description, "createdAt")
      VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;
    `, [st.name, st.description])
  }
  console.log('Catalogos de Estados y Tipos sincronizados.')

  // 6. Generos musicales con slugs
  for (const genre of GENRES) {
    await query(`
      INSERT INTO "Genre" (id, name, slug, "createdAt")
      VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug;
    `, [genre.name, genre.slug])
  }
  console.log(`Catalogo de ${GENRES.length} generos sincronizado con slugs.`)

  // 7. Administrador inicial
  const adminEmail = 'admin@linkedsound.app'
  const adminRes = await query(`SELECT id FROM "User" WHERE email = $1 LIMIT 1;`, [adminEmail])
  const roleRes = await query(`SELECT id FROM "Role" WHERE name = 'Administrador' LIMIT 1;`)
  const statusRes = await query(`SELECT id FROM "UserStatus" WHERE name = 'Active' LIMIT 1;`)

  const adminRoleId = roleRes.rows[0]?.id
  const activeStatusId = statusRes.rows[0]?.id

  if (adminRes.rows.length === 0) {
    const hashedPassword = await hashPassword('adminpassword123')
    const locRes = await query(`
      INSERT INTO "Location" (id, name, "formattedAddress", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'LinkedSound Central', 'LinkedSound HQ', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id;
    `)
    const locId = locRes.rows[0].id

    const newAdmin = await query(`
      INSERT INTO "User" (
        id, email, password, "firstName", "lastName", nickname, role, "accountRole",
        description, "locationId", "statusId", "reportsCount", "createdAt", "updatedAt"
      )
      VALUES (
        gen_random_uuid(), $1, $2, 'Admin', 'LinkedSound', 'Admin', 'Artista', 'Administrador',
        'Administrador general de la plataforma LinkedSound.', $3, $4, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING id;
    `, [adminEmail, hashedPassword, locId, activeStatusId])

    if (adminRoleId) {
      await query(`
        INSERT INTO "UserRole" ("userId", "roleId", "assignedAt")
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING;
      `, [newAdmin.rows[0].id, adminRoleId])
    }
    console.log('Usuario Administrador inicial verificado en PostgreSQL.')
  } else {
    const adminId = adminRes.rows[0].id
    if (adminRoleId) {
      await query(`
        INSERT INTO "UserRole" ("userId", "roleId", "assignedAt")
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING;
      `, [adminId, adminRoleId])
    }
    console.log('El usuario Administrador ya existe en PostgreSQL.')
  }

  console.log('Sincronizacion completada con exito.')
}

seed()
  .catch((e) => {
    console.error('Error durante la sincronizacion:', e)
  })
  .finally(async () => {
    await pool.end()
  })
