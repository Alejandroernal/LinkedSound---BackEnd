import type { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { uploadBase64ToCloudinary } from '../services/upload.service.js'

export const getEvents = async (req: Request, res: Response) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        genres: {
          include: {
            genre: true,
          },
        },
        owner: {
          select: {
            id: true,
            nickname: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImage: true,
            location: true,
          },
        },
        tracks: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const formatted = events.map((ev) => ({
      id: ev.id,
      title: ev.title,
      nickname: ev.nickname || ev.title,
      role: ev.role || 'Evento',
      eventDate: ev.eventDate,
      eventTime: ev.eventTime || '22:00',
      venue: ev.venue || 'Venue Principal',
      ticketUrl: ev.ticketUrl || null,
      isFinished: ev.isFinished,
      description: ev.description || '',
      profileImage:
        ev.profileImage ||
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80',
      location: ev.location,
      country: ev.country || '',
      province: ev.province || '',
      city: ev.city || '',
      streetAddress: ev.streetAddress || '',
      latitude: ev.latitude,
      longitude: ev.longitude,
      status: ev.status,
      reportsCount: ev.reportsCount,
      soundcloudUrl: ev.soundcloudUrl || '',
      spotifyUrl: ev.spotifyUrl || '',
      instagramUrl: ev.instagramUrl || '',
      interestGenres: ev.genres.map((g) => g.genre.name),
      tags: ev.genres.map((g) => g.genre.name),
      isProfile: false,
      itemRole: 'Evento',
      badge: 'Evento',
      match: '100%',
      owner: ev.owner ? `${ev.owner.firstName} ${ev.owner.lastName}`.trim() || ev.owner.nickname : 'Organizador',
      ownerId: ev.ownerId,
      ownerNickname: ev.owner?.nickname || '',
      tracks: ev.tracks,
      createdAt: ev.createdAt,
      updatedAt: ev.updatedAt,
    }))

    return res.status(200).json({
      success: true,
      events: formatted,
    })
  } catch (error: any) {
    console.error('Error al obtener eventos:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al consultar los eventos en la base de datos.',
      error: error.message,
    })
  }
}

export const createEvent = async (req: Request, res: Response) => {
  try {
    const {
      title,
      nickname,
      role,
      eventDate,
      eventTime,
      venue,
      ticketUrl,
      description,
      profileImage,
      location,
      country,
      province,
      city,
      streetAddress,
      latitude,
      longitude,
      interestGenres,
      soundcloudUrl,
      spotifyUrl,
      instagramUrl,
    } = req.body

    if (!title || !location || !eventDate) {
      return res.status(400).json({
        success: false,
        message: 'Título, ubicación y fecha son campos obligatorios.',
      })
    }

    const trimmedTitle = String(title).trim()
    if (trimmedTitle.length < 3 || trimmedTitle.length > 80) {
      return res.status(400).json({
        success: false,
        message: 'El título del evento debe tener entre 3 y 80 caracteres.',
      })
    }

    // Validar año de 4 dígitos en fecha
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(String(eventDate).trim())) {
      return res.status(400).json({
        success: false,
        message: 'La fecha del evento debe tener un formato válido con año de 4 dígitos (AAAA-MM-DD).',
      })
    }
    const yearNumber = parseInt(String(eventDate).trim().split('-')[0], 10)
    const currentYear = new Date().getFullYear()
    if (isNaN(yearNumber) || yearNumber < currentYear || yearNumber > 2099) {
      return res.status(400).json({
        success: false,
        message: `El año del evento debe ser de 4 dígitos entre ${currentYear} y 2099.`,
      })
    }

    // Identificar el organizador / usuario creador
    let ownerId = (req as any).user?.id

    if (!ownerId) {
      const fallbackUser = await prisma.user.findFirst({
        where: { status: 'Active' },
      })
      if (!fallbackUser) {
        return res.status(400).json({
          success: false,
          message: 'No se encontró un usuario organizador para asociar el evento.',
        })
      }
      ownerId = fallbackUser.id
    }

    // Procesar imagen si viene en base64 o URL
    let finalProfileImage: string | null = null
    if (profileImage && typeof profileImage === 'string' && profileImage.trim()) {
      const trimmedImage = profileImage.trim()
      if (trimmedImage.startsWith('data:image/')) {
        finalProfileImage = await uploadBase64ToCloudinary(trimmedImage, 'linkedsound/events')
      } else if (trimmedImage.startsWith('http://') || trimmedImage.startsWith('https://')) {
        finalProfileImage = trimmedImage
      } else {
        return res.status(400).json({
          success: false,
          message: 'El formato de la imagen no es válido. Debe ser una imagen o URL válida.',
        })
      }
    }

    const finalTicketUrl = ticketUrl && typeof ticketUrl === 'string' && ticketUrl.trim()
      ? ticketUrl.trim()
      : null

    const createdEvent = await prisma.event.create({
      data: {
        title: trimmedTitle,
        nickname: (nickname ? String(nickname).trim() : trimmedTitle),
        role: (role ? String(role).trim() : 'Evento Live').slice(0, 50),
        eventDate: String(eventDate).trim(),
        eventTime: (eventTime ? String(eventTime).trim() : '22:00').slice(0, 8),
        venue: venue ? String(venue).trim().slice(0, 60) : null,
        ticketUrl: finalTicketUrl,
        description: description ? String(description).trim().slice(0, 500) : null,
        profileImage: finalProfileImage,
        location: String(location).trim(),
        country: country ? String(country).trim().slice(0, 60) : null,
        province: province ? String(province).trim().slice(0, 60) : null,
        city: city ? String(city).trim().slice(0, 60) : null,
        streetAddress: streetAddress ? String(streetAddress).trim().slice(0, 80) : null,
        latitude: typeof latitude === 'number' ? latitude : null,
        longitude: typeof longitude === 'number' ? longitude : null,
        soundcloudUrl: soundcloudUrl ? String(soundcloudUrl).trim() : null,
        spotifyUrl: spotifyUrl ? String(spotifyUrl).trim() : null,
        instagramUrl: instagramUrl ? String(instagramUrl).trim() : null,
        ownerId,
      },
    })

    // Conectar géneros si se suministraron
    if (Array.isArray(interestGenres) && interestGenres.length > 0) {
      for (const genreName of interestGenres) {
        const trimmed = String(genreName).trim()
        if (!trimmed) continue
        const genreRecord = await prisma.genre.upsert({
          where: { name: trimmed },
          update: {},
          create: { name: trimmed },
        })

        await prisma.eventGenre.create({
          data: {
            eventId: createdEvent.id,
            genreId: genreRecord.id,
          },
        }).catch(() => {})
      }
    }

    // Registrar log de actividad
    await prisma.userActivityLog.create({
      data: {
        userId: ownerId,
        action: `Creó el evento "${createdEvent.title}" para la fecha ${createdEvent.eventDate}`,
        ip: req.ip || '127.0.0.1',
        device: (req.headers['user-agent'] as string) || 'Web Browser',
        module: 'Explorer',
      },
    }).catch(() => {})

    return res.status(201).json({
      success: true,
      message: 'Evento creado exitosamente en la base de datos.',
      event: createdEvent,
    })
  } catch (error: any) {
    console.error('Error al crear evento:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al registrar el evento en la base de datos.',
      error: error.message,
    })
  }
}

export const updateEvent = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)

    const existing = await prisma.event.findUnique({
      where: { id },
      include: { genres: true },
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Evento no encontrado.',
      })
    }

    // Verificar ventana de edición de 24 horas desde createdAt
    const createdAtTime = new Date(existing.createdAt).getTime()
    const nowTime = Date.now()
    const hoursElapsed = (nowTime - createdAtTime) / (1000 * 60 * 60)

    if (hoursElapsed > 24) {
      return res.status(403).json({
        success: false,
        message: 'El plazo de modificación de 24 horas para este evento ha expirado. No es posible realizar cambios.',
      })
    }

    // Verificar permisos de usuario
    const userId = (req as any).user?.id
    const userRole = (req as any).user?.role
    if (userId && existing.ownerId !== userId && userRole !== 'Administrador') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para modificar este evento.',
      })
    }

    const {
      title,
      nickname,
      role,
      eventDate,
      eventTime,
      venue,
      ticketUrl,
      description,
      profileImage,
      location,
      country,
      province,
      city,
      streetAddress,
      latitude,
      longitude,
      interestGenres,
    } = req.body

    const updateData: any = {}

    if (title !== undefined) {
      const trimmedTitle = String(title).trim()
      if (trimmedTitle.length < 3 || trimmedTitle.length > 80) {
        return res.status(400).json({
          success: false,
          message: 'El título del evento debe tener entre 3 y 80 caracteres.',
        })
      }
      updateData.title = trimmedTitle
      updateData.nickname = nickname ? String(nickname).trim() : trimmedTitle
    }

    if (eventDate !== undefined) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(String(eventDate).trim())) {
        return res.status(400).json({
          success: false,
          message: 'La fecha del evento debe tener un formato válido con año de 4 dígitos (AAAA-MM-DD).',
        })
      }
      const yearNumber = parseInt(String(eventDate).trim().split('-')[0], 10)
      const currentYear = new Date().getFullYear()
      if (isNaN(yearNumber) || yearNumber < currentYear || yearNumber > 2099) {
        return res.status(400).json({
          success: false,
          message: `El año del evento debe ser de 4 dígitos entre ${currentYear} y 2099.`,
        })
      }
      updateData.eventDate = String(eventDate).trim()
    }

    if (role !== undefined) updateData.role = String(role).trim().slice(0, 50)
    if (eventTime !== undefined) updateData.eventTime = String(eventTime).trim().slice(0, 8)
    if (venue !== undefined) updateData.venue = venue ? String(venue).trim().slice(0, 60) : null
    if (ticketUrl !== undefined) {
      updateData.ticketUrl = ticketUrl && typeof ticketUrl === 'string' && ticketUrl.trim()
        ? ticketUrl.trim()
        : null
    }
    if (description !== undefined) {
      updateData.description = description ? String(description).trim().slice(0, 500) : null
    }
    if (location !== undefined) updateData.location = String(location).trim()
    if (country !== undefined) updateData.country = country ? String(country).trim().slice(0, 60) : null
    if (province !== undefined) updateData.province = province ? String(province).trim().slice(0, 60) : null
    if (city !== undefined) updateData.city = city ? String(city).trim().slice(0, 60) : null
    if (streetAddress !== undefined) updateData.streetAddress = streetAddress ? String(streetAddress).trim().slice(0, 80) : null
    if (typeof latitude === 'number') updateData.latitude = latitude
    if (typeof longitude === 'number') updateData.longitude = longitude

    if (profileImage !== undefined) {
      if (profileImage && typeof profileImage === 'string' && profileImage.trim()) {
        const trimmedImage = profileImage.trim()
        if (trimmedImage.startsWith('data:image/')) {
          updateData.profileImage = await uploadBase64ToCloudinary(trimmedImage, 'linkedsound/events')
        } else if (trimmedImage.startsWith('http://') || trimmedImage.startsWith('https://')) {
          updateData.profileImage = trimmedImage
        } else {
          return res.status(400).json({
            success: false,
            message: 'El formato de la imagen no es válido. Debe ser una imagen o URL válida.',
          })
        }
      } else {
        updateData.profileImage = null
      }
    }

    const updated = await prisma.event.update({
      where: { id },
      data: updateData,
      include: {
        genres: {
          include: {
            genre: true,
          },
        },
        owner: {
          select: {
            id: true,
            nickname: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    // Actualizar géneros si se enviaron
    if (Array.isArray(interestGenres)) {
      await prisma.eventGenre.deleteMany({
        where: { eventId: id },
      })

      for (const genreName of interestGenres) {
        const trimmed = String(genreName).trim()
        if (!trimmed) continue
        const genreRecord = await prisma.genre.upsert({
          where: { name: trimmed },
          update: {},
          create: { name: trimmed },
        })

        await prisma.eventGenre.create({
          data: {
            eventId: id,
            genreId: genreRecord.id,
          },
        }).catch(() => {})
      }
    }

    const activeUserId = userId || existing.ownerId
    await prisma.userActivityLog.create({
      data: {
        userId: activeUserId,
        action: `Modificó el evento "${updated.title}" dentro del plazo permitido`,
        ip: req.ip || '127.0.0.1',
        device: (req.headers['user-agent'] as string) || 'Web Browser',
        module: 'Explorer',
      },
    }).catch(() => {})

    return res.status(200).json({
      success: true,
      message: 'Evento actualizado exitosamente.',
      event: updated,
    })
  } catch (error: any) {
    console.error('Error al actualizar evento:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar el evento en la base de datos.',
      error: error.message,
    })
  }
}

export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)

    const existing = await prisma.event.findUnique({
      where: { id },
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Evento no encontrado.',
      })
    }

    await prisma.event.delete({
      where: { id },
    })

    const userId = (req as any).user?.id || existing.ownerId
    await prisma.userActivityLog.create({
      data: {
        userId,
        action: `Eliminó el evento "${existing.title}"`,
        ip: req.ip || '127.0.0.1',
        device: (req.headers['user-agent'] as string) || 'Web Browser',
        module: 'Explorer',
      },
    }).catch(() => {})

    return res.status(200).json({
      success: true,
      message: 'Evento eliminado correctamente.',
    })
  } catch (error: any) {
    console.error('Error al eliminar evento:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar el evento.',
      error: error.message,
    })
  }
}
