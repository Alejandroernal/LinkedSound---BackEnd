import { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { hashPassword, comparePassword } from '../utils/password.js'
import { generateToken } from '../utils/jwt.js'
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { uploadBase64ToCloudinary } from '../services/upload.service.js'

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

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        nickname,
        role: role || 'Artista',
        profileImage: finalProfileImage,
        location,
        country,
        province,
        city,
        streetAddress,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        description,
        soundcloudUrl,
        spotifyUrl,
        instagramUrl,
        genres: {
          create: genreList.map((genreName: string) => ({
            genre: {
              connectOrCreate: {
                where: { name: genreName.trim() },
                create: { name: genreName.trim() },
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
        location: true,
        profileImage: true,
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

    const token = generateToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    })

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      user: newUser,
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
      role: user.role,
    })

    const { password: _, ...userWithoutPassword } = user

    res.status(200).json({
      success: true,
      message: 'Inicio de sesion exitoso',
      token,
      user: userWithoutPassword,
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
        location: true,
        country: true,
        province: true,
        city: true,
        streetAddress: true,
        latitude: true,
        longitude: true,
        status: true,
        createdAt: true,
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
      user: {
        ...user,
        interestGenres: user.genres.map((g: any) => g.genre.name),
      },
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
    } = req.body

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

    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(nickname ? { nickname } : {}),
        ...(role ? { role } : {}),
        ...(location ? { location } : {}),
        ...(country !== undefined ? { country } : {}),
        ...(province !== undefined ? { province } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(streetAddress !== undefined ? { streetAddress } : {}),
        ...(latitude !== undefined ? { latitude: latitude ? parseFloat(latitude) : null } : {}),
        ...(longitude !== undefined ? { longitude: longitude ? parseFloat(longitude) : null } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(soundcloudUrl !== undefined ? { soundcloudUrl } : {}),
        ...(spotifyUrl !== undefined ? { spotifyUrl } : {}),
        ...(instagramUrl !== undefined ? { instagramUrl } : {}),
        ...(finalProfileImage ? { profileImage: finalProfileImage } : {}),
        ...(Array.isArray(interestGenres)
          ? {
              genres: {
                create: genreList.map((genreName: string) => ({
                  genre: {
                    connectOrCreate: {
                      where: { name: genreName.trim() },
                      create: { name: genreName.trim() },
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
        soundcloudUrl: true,
        spotifyUrl: true,
        instagramUrl: true,
        location: true,
        country: true,
        province: true,
        city: true,
        streetAddress: true,
        latitude: true,
        longitude: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    res.status(200).json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: {
        ...updatedUser,
        interestGenres: updatedUser.genres.map((g: any) => g.genre.name),
      },
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
        location: true,
        country: true,
        province: true,
        city: true,
        streetAddress: true,
        latitude: true,
        longitude: true,
        status: true,
        reportsCount: true,
        soundcloudUrl: true,
        spotifyUrl: true,
        instagramUrl: true,
        createdAt: true,
        updatedAt: true,
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
      users: users.map((u: any) => ({
        ...u,
        interestGenres: u.genres.map((g: any) => g.genre.name),
      })),
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener los usuarios',
      error: error.message,
    })
  }
}
