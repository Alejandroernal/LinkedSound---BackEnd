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
        duration: t.duration || 'SoundCloud',
        genre: t.genre?.name || 'Destacado',
        soundcloudLink: t.soundcloudLink || '',
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
    favoriteArtists: Array.isArray(user.favoriteArtists)
      ? user.favoriteArtists.map((fa: any) => ({
          id: fa.artist?.id || fa.id,
          spotifyId: fa.artist?.spotifyId || fa.spotifyId || '',
          name: fa.artist?.name || fa.name || '',
          imageUrl: fa.artist?.imageUrl || fa.imageUrl || null,
          spotifyUrl: fa.artist?.spotifyUrl || fa.spotifyUrl || '',
          genres: Array.isArray(fa.artist?.genres)
            ? fa.artist.genres
            : Array.isArray(fa.genres)
            ? fa.genres
            : [],
        }))
      : Array.isArray(user.favoriteArtists)
      ? user.favoriteArtists
      : [],
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
      favoriteArtists,
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
        favoriteArtists: {
          include: {
            artist: true,
          },
        },
      },
    })

    const token = generateToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role || 'Artista',
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
          orderBy: { createdAt: 'desc' },
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
        favoriteArtists: {
          include: {
            artist: true,
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
        favoriteArtists: {
          include: {
            artist: true,
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
          orderBy: { createdAt: 'desc' },
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
      favoriteArtists,
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
        ...(role ? { role } : {}),
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
        favoriteArtists: {
          include: {
            artist: true,
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

    // Gestionar el guardado del Track Destacado si se envió en tracks o trackUrl
    let extractedTrackUrl: string | null = null
    if (typeof trackUrl === 'string' && trackUrl.trim()) {
      extractedTrackUrl = trackUrl.trim()
    } else if (Array.isArray(tracks) && tracks.length > 0) {
      const customTrack = tracks.find((t: any) => t.soundcloudLink && typeof t.soundcloudLink === 'string' && t.soundcloudLink.trim())
      if (customTrack) {
        extractedTrackUrl = customTrack.soundcloudLink.trim()
      }
    }

    if (extractedTrackUrl) {
      const defaultGenre = await prisma.genre.findFirst({ select: { id: true } })
      const existingTrack = await prisma.track.findFirst({
        where: { userId: req.user.userId },
      })

      if (existingTrack) {
        await prisma.track.update({
          where: { id: existingTrack.id },
          data: {
            soundcloudLink: extractedTrackUrl,
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
            soundcloudLink: extractedTrackUrl,
            userId: req.user.userId,
          },
        })
      }
    }

    // Gestionar el guardado de Artistas Favoritos (Spotify)
    if (Array.isArray(favoriteArtists)) {
      await prisma.userFavoriteArtist.deleteMany({
        where: { userId: req.user.userId },
      })

      for (const item of favoriteArtists) {
        if (!item || !item.name || typeof item.name !== 'string' || !item.name.trim()) continue
        const artName = item.name.trim()
        const spotifyId = item.spotifyId ? String(item.spotifyId).trim() : null

        let artistRecord
        if (spotifyId) {
          artistRecord = await prisma.artist.upsert({
            where: { spotifyId },
            create: {
              spotifyId,
              name: artName,
              imageUrl: item.imageUrl || null,
              spotifyUrl: item.spotifyUrl || null,
              genres: Array.isArray(item.genres) ? item.genres : [],
            },
            update: {
              name: artName,
              ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
              ...(item.spotifyUrl ? { spotifyUrl: item.spotifyUrl } : {}),
              ...(Array.isArray(item.genres) && item.genres.length > 0 ? { genres: item.genres } : {}),
            },
          })
        } else {
          const existing = await prisma.artist.findFirst({
            where: { name: { equals: artName, mode: 'insensitive' } },
          })
          if (existing) {
            artistRecord = existing
          } else {
            artistRecord = await prisma.artist.create({
              data: {
                name: artName,
                imageUrl: item.imageUrl || null,
                spotifyUrl: item.spotifyUrl || null,
                genres: Array.isArray(item.genres) ? item.genres : [],
              },
            })
          }
        }

        if (artistRecord) {
          await prisma.userFavoriteArtist.create({
            data: {
              userId: req.user.userId,
              artistId: artistRecord.id,
            },
          })
        }
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
        favoriteArtists: {
          include: {
            artist: true,
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
          orderBy: { createdAt: 'desc' },
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
    const currentUserRole = req.user?.role
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
          orderBy: { createdAt: 'desc' },
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
