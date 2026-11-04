import { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { hashPassword, comparePassword } from '../utils/password.js'
import { generateToken } from '../utils/jwt.js'
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { uploadBase64ToCloudinary } from '../services/upload.service.js'

const toSlug = (str: string) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export const formatUserResponse = (user: any) => {
  if (!user) return null
  const { location, tracks, ...rest } = user
  const loc = typeof location === 'object' && location !== null ? location : {}
  const rawLoc = typeof location === 'string' ? location : ''

  const formattedTracks = Array.isArray(tracks)
    ? tracks.map((t: any) => ({
        id: t.id,
        title: t.title || 'Track Destacado',
        plays: typeof t.plays === 'number' ? `${t.plays.toLocaleString()} reproducciones` : String(t.plays || '0'),
        duration: t.duration || '0:30',
        genre: t.genre?.name || 'Destacado',
        audioUrl: t.audioUrl || '',
        soundcloudLink: t.soundcloudLink || '',
        format: t.format || 'MP3',
        snippetType: t.snippetType || 'Snippet Demo',
        bpm: t.bpm || '',
        key: t.key || '',
        fileSize: t.fileSize || '',
        order: typeof t.order === 'number' ? t.order : 0,
      }))
    : []

  return {
    ...rest,
    location: loc.formattedAddress || rawLoc || '',
    country: loc.country || user.country || '',
    province: loc.province || user.province || '',
    city: loc.city || user.city || '',
    streetAddress: loc.streetAddress || user.streetAddress || '',
    latitude: loc.latitude ?? user.latitude ?? null,
    longitude: loc.longitude ?? user.longitude ?? null,
    locationId: user.locationId || loc.id || null,
    locationData: typeof location === 'object' && location !== null ? location : null,
    interestGenres: Array.isArray(user.genres)
      ? user.genres.map((g: any) => g.genre?.name || g.name || g)
      : user.interestGenres || [],
    tracks: formattedTracks,
  }
}

export const register = async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      nickname,
      role,
      accountRole,
      location,
      country,
      province,
      city,
      streetAddress,
      latitude,
      longitude,
      interestGenres,
      description,
      soundcloudUrl,
      spotifyUrl,
      instagramUrl,
      profileImage,
      tracks,
      trackUrl,
    } = req.body

    if (!email || !password || !firstName || !lastName || !nickname || !location) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios para el registro',
      })
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { nickname }],
      },
    })

    if (existingUser) {
      const field = existingUser.email === email ? 'El correo electronico' : 'El nombre de usuario (nickname)'
      return res.status(409).json({
        success: false,
        message: `${field} ya se encuentra registrado`,
      })
    }

    const hashedPassword = await hashPassword(password)

    let finalProfileImage: string | undefined = undefined
    if (profileImage && typeof profileImage === 'string') {
      finalProfileImage = await uploadBase64ToCloudinary(profileImage, 'linkedsound/avatars')
    }

    const genreList = Array.isArray(interestGenres) ? interestGenres.filter((g: any) => typeof g === 'string' && g.trim().length > 0) : []

    const formattedAddress = String(location || [streetAddress, city, province, country].filter(Boolean).join(', ') || 'Sin especificar').trim()

    const createdLocation = await prisma.location.create({
      data: {
        formattedAddress,
        country: country ? String(country).trim() : null,
        province: province ? String(province).trim() : null,
        city: city ? String(city).trim() : null,
        streetAddress: streetAddress ? String(streetAddress).trim() : null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
    })

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        nickname,
        role: role || 'Artista',
        accountRole: 'Usuario',
        profileImage: finalProfileImage,
        locationId: createdLocation.id,
        description,
        soundcloudUrl,
        spotifyUrl,
        instagramUrl,
        genres: {
          create: genreList.map((genreName: string) => ({
            genre: {
              connectOrCreate: {
                where: { name: genreName.trim() },
                create: {
                  name: genreName.trim(),
                  slug: toSlug(genreName.trim()),
                },
              },
            },
          })),
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        nickname: true,
        role: true,
        accountRole: true,
        description: true,
        locationId: true,
        location: true,
        profileImage: true,
        soundcloudUrl: true,
        spotifyUrl: true,
        instagramUrl: true,
        soundcloudHandle: true,
        status: true,
        createdAt: true,
        genres: {
          select: {
            genre: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    // Guardar tracks de muestra subidos durante el registro (mínimo 1, máximo 5)
    const incomingTracks = Array.isArray(tracks) ? tracks : []
    const defaultGenre = await prisma.genre.findFirst({ select: { id: true } })
    if (incomingTracks.length > 0) {
      for (let i = 0; i < Math.min(incomingTracks.length, 5); i++) {
        const t = incomingTracks[i]
        await prisma.track.create({
          data: {
            title: (t.title || `Demo 0${i + 1}`).trim(),
            audioUrl: t.audioUrl || null,
            soundcloudLink: t.soundcloudLink || null,
            duration: t.duration || '0:30',
            format: t.format || (t.audioUrl?.toLowerCase().includes('.wav') ? 'WAV' : t.audioUrl?.toLowerCase().includes('.flac') ? 'FLAC' : 'MP3'),
            snippetType: t.snippetType || `0${i + 1} - DEMO EXCLUSIVA`,
            bpm: t.bpm || null,
            key: t.key || null,
            fileSize: t.fileSize || null,
            order: i,
            plays: typeof t.plays === 'number' ? t.plays : (Math.floor(Math.random() * 150) + 20),
            genreId: defaultGenre?.id || null,
            userId: newUser.id,
          },
        })
      }
    } else if (typeof trackUrl === 'string' && trackUrl.trim()) {
      await prisma.track.create({
        data: {
          title: `${newUser.nickname || 'Usuario'} - Track Destacado`,
          duration: 'SoundCloud',
          plays: 120,
          soundcloudLink: trackUrl.trim(),
          userId: newUser.id,
          genreId: defaultGenre?.id || null,
          order: 0,
        },
      })
    }

    const token = generateToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role || 'Artista',
      accountRole: newUser.accountRole || 'Usuario',
    })

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      user: formatUserResponse(newUser),
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error en el servidor al registrar el usuario',
      error: error.message,
    })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Debe ingresar email y contrasena',
      })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        location: true,
        tracks: {
          include: { genre: true },
          orderBy: { order: 'asc' },
        },
        genres: {
          select: {
            genre: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales invalidas',
      })
    }

    const isValidPassword = await comparePassword(password, user.password)
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales invalidas',
      })
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role || 'Artista',
      accountRole: user.accountRole || 'Usuario',
    })

    const { password: _, ...userWithoutPassword } = user

    res.status(200).json({
      success: true,
      message: 'Inicio de sesion exitoso',
      token,
      user: formatUserResponse(userWithoutPassword),
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error en el servidor al iniciar sesion',
      error: error.message,
    })
  }
}

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado',
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        nickname: true,
        profileImage: true,
        role: true,
        description: true,
        genres: {
          select: {
            genre: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        soundcloudUrl: true,
        spotifyUrl: true,
        instagramUrl: true,
        locationId: true,
        location: true,
        status: true,
        createdAt: true,
        tracks: {
          include: { genre: true },
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      })
    }

    res.status(200).json({
      success: true,
      user: formatUserResponse(user),
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener el perfil del usuario',
      error: error.message,
    })
  }
}

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado',
      })
    }

    const {
      firstName,
      lastName,
      nickname,
      role,
      accountRole,
      location,
      country,
      province,
      city,
      streetAddress,
      latitude,
      longitude,
      interestGenres,
      description,
      soundcloudUrl,
      spotifyUrl,
      instagramUrl,
      profileImage,
      tracks,
      trackUrl,
    } = req.body

    if (description !== undefined && description !== null && typeof description === 'string' && description.trim().length > 150) {
      return res.status(400).json({
        success: false,
        message: 'La descripcion debe tener como maximo 150 caracteres',
      })
    }

    if (spotifyUrl !== undefined && spotifyUrl !== null && typeof spotifyUrl === 'string' && spotifyUrl.trim()) {
      const lower = spotifyUrl.toLowerCase()
      if (!lower.includes('spotify.com')) {
        return res.status(400).json({
          success: false,
          message: 'El enlace de Spotify debe ser una URL valida de Spotify (debe contener spotify.com)',
        })
      }
    }

    if (instagramUrl !== undefined && instagramUrl !== null && typeof instagramUrl === 'string' && instagramUrl.trim()) {
      const lower = instagramUrl.toLowerCase()
      if (!lower.includes('instagram.com')) {
        return res.status(400).json({
          success: false,
          message: 'El enlace de Instagram debe ser una URL valida de Instagram (debe contener instagram.com)',
        })
      }
    }

    if (soundcloudUrl !== undefined && soundcloudUrl !== null && typeof soundcloudUrl === 'string' && soundcloudUrl.trim()) {
      const lower = soundcloudUrl.toLowerCase()
      if (!lower.includes('soundcloud.com')) {
        return res.status(400).json({
          success: false,
          message: 'El enlace de SoundCloud debe ser una URL valida de SoundCloud (debe contener soundcloud.com)',
        })
      }
    }

    let finalProfileImage: string | undefined = undefined
    if (profileImage && typeof profileImage === 'string') {
      finalProfileImage = await uploadBase64ToCloudinary(profileImage, 'linkedsound/avatars')
    }

    if (Array.isArray(interestGenres)) {
      await prisma.profileGenre.deleteMany({
        where: { userId: req.user.userId },
      })
    }

    const genreList = Array.isArray(interestGenres)
      ? interestGenres.filter((g: any) => typeof g === 'string' && g.trim().length > 0)
      : []

    // Gestionar la entidad Location normalizada si se envian datos de ubicacion
    const hasLocationData =
      location !== undefined ||
      country !== undefined ||
      province !== undefined ||
      city !== undefined ||
      streetAddress !== undefined ||
      latitude !== undefined ||
      longitude !== undefined

    if (hasLocationData) {
      const existingUser = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { locationId: true },
      })

      if (existingUser?.locationId) {
        await prisma.location.update({
          where: { id: existingUser.locationId },
          data: {
            ...(location !== undefined ? { formattedAddress: String(location).trim() } : {}),
            ...(country !== undefined ? { country: country ? String(country).trim() : null } : {}),
            ...(province !== undefined ? { province: province ? String(province).trim() : null } : {}),
            ...(city !== undefined ? { city: city ? String(city).trim() : null } : {}),
            ...(streetAddress !== undefined ? { streetAddress: streetAddress ? String(streetAddress).trim() : null } : {}),
            ...(latitude !== undefined ? { latitude: latitude ? parseFloat(latitude) : null } : {}),
            ...(longitude !== undefined ? { longitude: longitude ? parseFloat(longitude) : null } : {}),
          },
        })
      } else if (location || city || country) {
        const newLoc = await prisma.location.create({
          data: {
            formattedAddress: String(location || [streetAddress, city, province, country].filter(Boolean).join(', ') || 'Sin especificar').trim(),
            country: country ? String(country).trim() : null,
            province: province ? String(province).trim() : null,
            city: city ? String(city).trim() : null,
            streetAddress: streetAddress ? String(streetAddress).trim() : null,
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null,
          },
        })
        await prisma.user.update({
          where: { id: req.user.userId },
          data: { locationId: newLoc.id },
        })
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(nickname ? { nickname } : {}),
        ...(role && ['Productor', 'Artista', 'Productor y Artista'].includes(role) ? { role } : {}),
        ...(accountRole && ['Usuario', 'Administrador'].includes(accountRole) ? { accountRole } : {}),
        ...(description !== undefined ? { description: description ? String(description).trim() : null } : {}),
        ...(soundcloudUrl !== undefined ? { soundcloudUrl: soundcloudUrl ? String(soundcloudUrl).trim() : null } : {}),
        ...(spotifyUrl !== undefined ? { spotifyUrl: spotifyUrl ? String(spotifyUrl).trim() : null } : {}),
        ...(instagramUrl !== undefined ? { instagramUrl: instagramUrl ? String(instagramUrl).trim() : null } : {}),
        ...(finalProfileImage ? { profileImage: finalProfileImage } : {}),
        ...(Array.isArray(interestGenres)
          ? {
              genres: {
                create: genreList.map((genreName: string) => ({
                  genre: {
                    connectOrCreate: {
                      where: { name: genreName.trim() },
                      create: {
                        name: genreName.trim(),
                        slug: toSlug(genreName.trim()),
                      },
                    },
                  },
                })),
              },
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        nickname: true,
        role: true,
        accountRole: true,
        description: true,
        profileImage: true,
        genres: {
          select: {
            genre: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        soundcloudUrl: true,
        spotifyUrl: true,
        instagramUrl: true,
        locationId: true,
        location: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (accountRole && ['Usuario', 'Administrador'].includes(accountRole)) {
      const sysRole = await prisma.role.findUnique({ where: { name: accountRole } })
      if (sysRole) {
        await prisma.userRole.deleteMany({ where: { userId: req.user.userId } })
        await prisma.userRole.create({
          data: {
            userId: req.user.userId,
            roleId: sysRole.id,
          },
        })
      }
    }

    // Gestionar el guardado de Tracks de Muestra (Audio local o SoundCloud, 1 a 5 tracks)
    const defaultGenre = await prisma.genre.findFirst({ select: { id: true } })

    if (Array.isArray(tracks) && tracks.length > 0) {
      await prisma.track.deleteMany({
        where: { userId: req.user.userId },
      })

      for (let i = 0; i < Math.min(tracks.length, 5); i++) {
        const t = tracks[i]
        await prisma.track.create({
          data: {
            title: (t.title || `Demo 0${i + 1}`).trim(),
            audioUrl: t.audioUrl || null,
            soundcloudLink: t.soundcloudLink || null,
            duration: t.duration || '0:30',
            format: t.format || (t.audioUrl?.toLowerCase().includes('.wav') ? 'WAV' : t.audioUrl?.toLowerCase().includes('.flac') ? 'FLAC' : 'MP3'),
            snippetType: t.snippetType || `0${i + 1} - DEMO EXCLUSIVA`,
            bpm: t.bpm || null,
            key: t.key || null,
            fileSize: t.fileSize || null,
            order: i,
            plays: typeof t.plays === 'number' ? t.plays : (Math.floor(Math.random() * 150) + 20),
            genreId: defaultGenre?.id || null,
            userId: req.user.userId,
          },
        })
      }
    } else if (typeof trackUrl === 'string' && trackUrl.trim()) {
      const existingTrack = await prisma.track.findFirst({
        where: { userId: req.user.userId },
      })
      if (existingTrack) {
        await prisma.track.update({
          where: { id: existingTrack.id },
          data: {
            soundcloudLink: trackUrl.trim(),
            title: `${updatedUser.nickname || 'Usuario'} - Track Destacado`,
          },
        })
      } else {
        await prisma.track.create({
          data: {
            title: `${updatedUser.nickname || 'Usuario'} - Track Destacado`,
            plays: 120,
            duration: 'SoundCloud',
            genreId: defaultGenre?.id || null,
            soundcloudLink: trackUrl.trim(),
            userId: req.user.userId,
            order: 0,
          },
        })
      }
    }

    // Volver a consultar para incluir tracks en la respuesta
    const freshUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        nickname: true,
        role: true,
        accountRole: true,
        description: true,
        profileImage: true,
        genres: {
          select: {
            genre: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        soundcloudUrl: true,
        spotifyUrl: true,
        instagramUrl: true,
        locationId: true,
        location: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        tracks: {
          include: { genre: true },
          orderBy: { order: 'asc' },
        },
      },
    })

    res.status(200).json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: formatUserResponse(freshUser || updatedUser),
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el perfil',
      error: error.message,
    })
  }
}

export const getGenres = async (_req: Request, res: Response) => {
  try {
    const genres = await prisma.genre.findMany({
      orderBy: { name: 'asc' },
    })
    res.status(200).json({
      success: true,
      genres: genres.map((g: any) => g.name),
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener los generos',
      error: error.message,
    })
  }
}

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId
    const currentUserRole = req.user?.accountRole || req.user?.role
    const includeSelf = req.query.all === 'true' || currentUserRole === 'Administrador'

    const users = await prisma.user.findMany({
      where: currentUserId && !includeSelf ? { id: { not: currentUserId } } : undefined,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        nickname: true,
        role: true,
        accountRole: true,
        description: true,
        profileImage: true,
        locationId: true,
        location: true,
        status: true,
        reportsCount: true,
        soundcloudUrl: true,
        spotifyUrl: true,
        instagramUrl: true,
        createdAt: true,
        updatedAt: true,
        tracks: {
          include: { genre: true },
          orderBy: { order: 'asc' },
        },
        genres: {
          select: {
            genre: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.status(200).json({
      success: true,
      users: users.map(formatUserResponse),
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener los usuarios',
      error: error.message,
    })
  }
}
