import { prisma } from './config/prisma.js'
import { hashPassword } from './utils/password.js'

const GENRES = [
  'Synthwave',
  'Electronic',
  'Dark Pop',
  'Hip Hop',
  'Indie',
  'Tech House',
  'Ambient',
  'Jazz',
  'R&B',
  'Rock',
  'Drum & Bass',
  'Lo-Fi',
  'Cyberpunk',
  'Industrial',
  'Hyperpop',
  'Techno',
  'Trap Metal',
  'Vocal',
  'ModularSynth',
  'Alt Pop',
  'Live',
]

async function seed() {
  console.log('Iniciando sincronizacion basica de base de datos en Supabase...')

  // 1. Sincronizar catalogo de generos
  for (const name of GENRES) {
    await prisma.genre.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }
  console.log(`Catalogo de ${GENRES.length} generos sincronizado.`)

  // 2. Verificar usuario Administrador inicial
  const adminEmail = 'admin@linkedsound.app'
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  })

  if (!existingAdmin) {
    const hashedPassword = await hashPassword('adminpassword123')
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'LinkedSound',
        nickname: 'Admin',
        role: 'Administrador',
        location: 'LinkedSound HQ',
        status: 'Active',
        description: 'Administrador general de la plataforma LinkedSound.',
      },
    })
    console.log('Usuario Administrador inicial verificado en Supabase.')
  } else {
    console.log('El usuario Administrador ya existe en Supabase.')
  }

  console.log('Sincronizacion completada. No hay objetos de prueba ni usuarios dummy en el codigo.')
}

seed()
  .catch((e) => {
    console.error('Error durante la sincronizacion:', e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
