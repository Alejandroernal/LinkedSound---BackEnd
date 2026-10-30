import { prisma } from './config/prisma.js'
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
  console.log('Iniciando sincronizacion basica de base de datos en Supabase...')

  // 1. Sincronizar roles
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    })
  }
  console.log('Catalogo de Roles sincronizado.')

  // 2. Sincronizar estados de usuario
  for (const st of USER_STATUSES) {
    await prisma.userStatus.upsert({
      where: { name: st.name },
      update: { description: st.description },
      create: st,
    })
  }

  // 3. Sincronizar estados de eventos
  for (const st of EVENT_STATUSES) {
    await prisma.eventStatus.upsert({
      where: { name: st.name },
      update: { description: st.description },
      create: st,
    })
  }

  // 4. Sincronizar tipos de evento
  for (const et of EVENT_TYPES) {
    await prisma.eventType.upsert({
      where: { name: et.name },
      update: { description: et.description },
      create: et,
    })
  }

  // 5. Sincronizar estados de reportes
  for (const st of REPORT_STATUSES) {
    await prisma.reportStatus.upsert({
      where: { name: st.name },
      update: { description: st.description },
      create: st,
    })
  }
  console.log('Catalogos de Estados y Tipos sincronizados.')

  // 6. Sincronizar catalogo de generos con slug
  for (const genre of GENRES) {
    await prisma.genre.upsert({
      where: { name: genre.name },
      update: { slug: genre.slug },
      create: genre,
    })
  }
  console.log(`Catalogo de ${GENRES.length} generos sincronizado con slugs.`)

  // 7. Verificar usuario Administrador inicial
  const adminEmail = 'admin@linkedsound.app'
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: { roles: true },
  })

  const adminRole = await prisma.role.findUnique({ where: { name: 'Administrador' } })
  const activeStatus = await prisma.userStatus.findUnique({ where: { name: 'Active' } })

  if (!existingAdmin) {
    const hashedPassword = await hashPassword('adminpassword123')
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'LinkedSound',
        nickname: 'Admin',
        role: 'Administrador',
        status: 'Active',
        ...(activeStatus ? { userStatus: { connect: { id: activeStatus.id } } } : {}),
        description: 'Administrador general de la plataforma LinkedSound.',
        location: {
          create: {
            name: 'LinkedSound Central',
            formattedAddress: 'LinkedSound HQ',
          },
        },
      },
    })

    if (adminRole) {
      await prisma.userRole.create({
        data: {
          userId: adminUser.id,
          roleId: adminRole.id,
        },
      }).catch(() => {})
    }
    console.log('Usuario Administrador inicial verificado en Supabase.')
  } else {
    if (adminRole && existingAdmin.roles.length === 0) {
      await prisma.userRole.create({
        data: {
          userId: existingAdmin.id,
          roleId: adminRole.id,
        },
      }).catch(() => {})
    }
    console.log('El usuario Administrador ya existe en Supabase.')
  }

  console.log('Sincronizacion completada con exito.')
}

seed()
  .catch((e) => {
    console.error('Error durante la sincronizacion:', e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
