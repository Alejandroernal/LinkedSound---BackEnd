import type { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { uploadBase64ToCloudinary } from '../services/upload.service.js'

const toSlug = (str: string) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export const formatEventResponse = (ev: any) => {
  if (!ev) return null
  const loc = ev.location || {}
  const rawLoc = typeof ev.location === 'string' ? ev.location : ''

  const dateStr = ev.eventDate instanceof Date
    ? ev.eventDate.toISOString().split('T')[0]
    : String(ev.eventDate || '')

  return {
    id: ev.id,
    title: ev.title,
    nickname: ev.nickname || ev.title,
    role: ev.eventType?.name || ev.role || 'Evento Live',
    eventTypeId: ev.eventTypeId || null,
    eventDate: dateStr,
    eventTime: ev.eventTime || '22:00',
    venue: ev.venue || loc.name || 'Venue Principal',
    ticketUrl: ev.ticketUrl || null,
    isFinished: ev.status === 'Finished' || Boolean(ev.isFinished),
    description: ev.description || '',
    images: (() => {
      const relationalImages = Array.isArray(ev.eventImages) && ev.eventImages.length > 0
        ? ev.eventImages
            .slice()
            .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
            .map((ei: any) => ei.image?.url || ei.url)
            .filter(Boolean)
        : null
      return relationalImages && relationalImages.length > 0
        ? relationalImages
        : (Array.isArray(ev.images) && ev.images.length > 0
            ? ev.images
            : (ev.profileImage
                ? [ev.profileImage]
                : ['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80']))
    })(),
    profileImage:
      (Array.isArray(ev.eventImages) && ev.eventImages[0]?.image?.url) ||
      (Array.isArray(ev.images) && ev.images[0]) ||
      ev.profileImage ||
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80',
    location: loc.formattedAddress || rawLoc || '',
    country: loc.country || ev.country || '',
    province: loc.province || ev.province || '',
    city: loc.city || ev.city || '',
    streetAddress: loc.streetAddress || ev.streetAddress || '',
    latitude: loc.latitude ?? ev.latitude ?? null,
    longitude: loc.longitude ?? ev.longitude ?? null,
    locationId: ev.locationId || loc.id || null,
    locationData: typeof ev.location === 'object' && ev.location !== null ? ev.location : null,
    status: ev.status,
    reportsCount: ev.reportsCount,
    soundcloudUrl: ev.soundcloudUrl || '',
    spotifyUrl: ev.spotifyUrl || '',
    instagramUrl: ev.instagramUrl || '',
    interestGenres: Array.isArray(ev.genres)
      ? ev.genres.map((g: any) => g.genre?.name || g.name || g)
      : ev.interestGenres || [],
    tags: Array.isArray(ev.genres)
      ? ev.genres.map((g: any) => g.genre?.name || g.name || g)
      : ev.tags || [],
    isProfile: false,
    itemRole: 'Evento',
    badge: 'Evento',
    match: '100%',
    owner: ev.owner ? `${ev.owner.firstName} ${ev.owner.lastName}`.trim() || ev.owner.nickname : 'Organizador',
    ownerId: ev.ownerId,
    ownerNickname: ev.owner?.nickname || '',
    tracks: ev.tracks || [],
    createdAt: ev.createdAt,
    updatedAt: ev.updatedAt,
  }
}

export const getEvents = async (req: Request, res: Response) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        location: true,
        eventType: true,
        genres: {
          include: {
            genre: true,
          },
        },
        eventImages: {
          include: {
            image: true,
          },
          orderBy: {
            order: 'asc',
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
            locationId: true,
            location: true,
          },
        },
        tracks: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const formatted = events.map(formatEventResponse)

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
    if (trimmedTitle.length < 3 || trimmedTitle.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'El título del evento debe tener entre 3 y 50 caracteres para preservar el formato.',
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
    let ownerId: string | null = (req as any).user?.userId || (req as any).user?.id || null

    if (!ownerId && req.body.ownerId && typeof req.body.ownerId === 'string' && req.body.ownerId.trim()) {
      ownerId = req.body.ownerId.trim()
    }

    let verifiedOwner = ownerId
      ? await prisma.user.findUnique({
          where: { id: ownerId },
          select: { id: true, nickname: true, firstName: true, lastName: true },
        })
      : null

    if (!verifiedOwner && req.body.ownerEmail && typeof req.body.ownerEmail === 'string' && req.body.ownerEmail.trim()) {
      verifiedOwner = await prisma.user.findUnique({
        where: { email: req.body.ownerEmail.trim() },
        select: { id: true, nickname: true, firstName: true, lastName: true },
      })
    }

    if (!verifiedOwner && req.body.ownerNickname && typeof req.body.ownerNickname === 'string' && req.body.ownerNickname.trim()) {
      verifiedOwner = await prisma.user.findFirst({
        where: { nickname: { equals: req.body.ownerNickname.trim(), mode: 'insensitive' } },
        select: { id: true, nickname: true, firstName: true, lastName: true },
      })
    }

    if (verifiedOwner) {
      ownerId = verifiedOwner.id
    } else {
      const fallbackUser = await prisma.user.findFirst({
        where: { status: 'Active' },
        select: { id: true },
      })
      if (!fallbackUser) {
        return res.status(400).json({
          success: false,
          message: 'No se encontró un usuario organizador para asociar el evento.',
        })
      }
      ownerId = fallbackUser.id
    }

    // Procesar imágenes (mínimo 1, máximo 5)
    const rawImages: string[] = Array.isArray(req.body.images) && req.body.images.length > 0
      ? req.body.images.filter((img: any) => typeof img === 'string' && img.trim())
      : (profileImage && typeof profileImage === 'string' && profileImage.trim() ? [profileImage.trim()] : [])

    if (rawImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debes cargar al menos 1 imagen para el evento (mínimo 1, máximo 5).',
      })
    }

    if (rawImages.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'No puedes cargar más de 5 imágenes para el evento.',
      })
    }

    const finalImages: string[] = []
    for (const imgItem of rawImages) {
      const trimmed = imgItem.trim()
      if (trimmed.startsWith('data:image/')) {
        const uploaded = await uploadBase64ToCloudinary(trimmed, 'linkedsound/events')
        if (uploaded) finalImages.push(uploaded)
      } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        finalImages.push(trimmed)
      } else {
        return res.status(400).json({
          success: false,
          message: 'Uno o más formatos de imagen no son válidos. Debe ser una imagen local o URL válida.',
        })
      }
    }

    if (finalImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debes cargar al menos 1 imagen válida para el evento.',
      })
    }

    const finalTicketUrl = ticketUrl && typeof ticketUrl === 'string' && ticketUrl.trim()
      ? ticketUrl.trim()
      : null

    const createdLocation = await prisma.location.create({
      data: {
        name: venue ? String(venue).trim().slice(0, 40) : null,
        formattedAddress: String(location).trim(),
        country: country ? String(country).trim().slice(0, 60) : null,
        province: province ? String(province).trim().slice(0, 60) : null,
        city: city ? String(city).trim().slice(0, 60) : null,
        streetAddress: streetAddress ? String(streetAddress).trim().slice(0, 50) : null,
        latitude: typeof latitude === 'number' ? latitude : null,
        longitude: typeof longitude === 'number' ? longitude : null,
      },
    })

    let eventTypeId: string | null = null
    if (role && typeof role === 'string' && role.trim()) {
      const foundType = await prisma.eventType.findFirst({
        where: { name: { equals: role.trim(), mode: 'insensitive' } },
      })
      if (foundType) eventTypeId = foundType.id
    }

    const createdEvent = await prisma.event.create({
      data: {
        title: trimmedTitle,
        nickname: (nickname ? String(nickname).trim() : trimmedTitle),
        eventTypeId,
        eventDate: new Date(String(eventDate).trim() + 'T00:00:00Z'),
        eventTime: (eventTime ? String(eventTime).trim() : '22:00').slice(0, 8),
        venue: venue ? String(venue).trim().slice(0, 40) : null,
        ticketUrl: finalTicketUrl,
        description: description ? String(description).trim().slice(0, 250) : null,
        profileImage: finalImages[0],
        images: finalImages,
        locationId: createdLocation.id,
        soundcloudUrl: soundcloudUrl ? String(soundcloudUrl).trim() : null,
        spotifyUrl: spotifyUrl ? String(spotifyUrl).trim() : null,
        instagramUrl: instagramUrl ? String(instagramUrl).trim() : null,
        ownerId,
      },
      include: {
        location: true,
        eventType: true,
        genres: {
          include: {
            genre: true,
          },
        },
        eventImages: {
          include: {
            image: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        owner: true,
        tracks: true,
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
          create: { name: trimmed, slug: toSlug(trimmed) },
        })

        await prisma.eventGenre.create({
          data: {
            eventId: createdEvent.id,
            genreId: genreRecord.id,
          },
        }).catch(() => {})
      }
    }

    // Guardar imagenes en tablas Image y EventImage
    for (let i = 0; i < finalImages.length; i++) {
      const imgUrl = finalImages[i]
      const imgRecord = await prisma.image.create({
        data: { url: imgUrl },
      })
      await prisma.eventImage.create({
        data: {
          eventId: createdEvent.id,
          imageId: imgRecord.id,
          order: i,
        },
      }).catch(() => {})
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
      event: formatEventResponse(createdEvent),
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
    const tokenUserId = (req as any).user?.userId || (req as any).user?.id
    const userRole = (req as any).user?.accountRole || (req as any).user?.role
    const requestUserId = tokenUserId || req.body.ownerId || req.body.userId

    if (tokenUserId && existing.ownerId !== tokenUserId && userRole !== 'Administrador') {
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
      if (trimmedTitle.length < 3 || trimmedTitle.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'El título del evento debe tener entre 3 y 50 caracteres para preservar el formato.',
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
      updateData.eventDate = new Date(String(eventDate).trim() + 'T00:00:00Z')
    }

    if (role !== undefined) {
      const foundType = await prisma.eventType.findFirst({
        where: { name: { equals: String(role).trim(), mode: 'insensitive' } },
      })
      if (foundType) updateData.eventTypeId = foundType.id
    }
    if (eventTime !== undefined) updateData.eventTime = String(eventTime).trim().slice(0, 8)
    if (venue !== undefined) updateData.venue = venue ? String(venue).trim().slice(0, 40) : null
    if (ticketUrl !== undefined) {
      updateData.ticketUrl = ticketUrl && typeof ticketUrl === 'string' && ticketUrl.trim()
        ? ticketUrl.trim()
        : null
    }
    if (description !== undefined) {
      updateData.description = description ? String(description).trim().slice(0, 250) : null
    }
    const hasLocationData =
      location !== undefined ||
      country !== undefined ||
      province !== undefined ||
      city !== undefined ||
      streetAddress !== undefined ||
      latitude !== undefined ||
      longitude !== undefined ||
      venue !== undefined

    if (hasLocationData) {
      if (existing.locationId) {
        await prisma.location.update({
          where: { id: existing.locationId },
          data: {
            ...(venue !== undefined ? { name: venue ? String(venue).trim().slice(0, 40) : null } : {}),
            ...(location !== undefined ? { formattedAddress: String(location).trim() } : {}),
            ...(country !== undefined ? { country: country ? String(country).trim().slice(0, 60) : null } : {}),
            ...(province !== undefined ? { province: province ? String(province).trim().slice(0, 60) : null } : {}),
            ...(city !== undefined ? { city: city ? String(city).trim().slice(0, 60) : null } : {}),
            ...(streetAddress !== undefined ? { streetAddress: streetAddress ? String(streetAddress).trim().slice(0, 50) : null } : {}),
            ...(typeof latitude === 'number' ? { latitude } : {}),
            ...(typeof longitude === 'number' ? { longitude } : {}),
          },
        })
      } else if (location || city || country) {
        const newLoc = await prisma.location.create({
          data: {
            name: venue ? String(venue).trim().slice(0, 40) : null,
            formattedAddress: String(location || [streetAddress, city, province, country].filter(Boolean).join(', ') || 'Sin especificar').trim(),
            country: country ? String(country).trim().slice(0, 60) : null,
            province: province ? String(province).trim().slice(0, 60) : null,
            city: city ? String(city).trim().slice(0, 60) : null,
            streetAddress: streetAddress ? String(streetAddress).trim().slice(0, 50) : null,
            latitude: typeof latitude === 'number' ? latitude : null,
            longitude: typeof longitude === 'number' ? longitude : null,
          },
        })
        updateData.locationId = newLoc.id
      }
    }

    const hasImagesParam = req.body.images !== undefined || profileImage !== undefined
    if (hasImagesParam) {
      let rawImagesToUpdate: string[] = []
      if (Array.isArray(req.body.images)) {
        rawImagesToUpdate = req.body.images.filter((img: any) => typeof img === 'string' && img.trim())
      } else if (profileImage && typeof profileImage === 'string' && profileImage.trim()) {
        rawImagesToUpdate = [profileImage.trim()]
      }

      if (rawImagesToUpdate.length < 1) {
        return res.status(400).json({
          success: false,
          message: 'El evento debe conservar al menos 1 imagen (mínimo 1, máximo 5).',
        })
      }

      if (rawImagesToUpdate.length > 5) {
        return res.status(400).json({
          success: false,
          message: 'No puedes cargar más de 5 imágenes para el evento.',
        })
      }

      const processedImages: string[] = []
      for (const imgItem of rawImagesToUpdate) {
        const trimmed = imgItem.trim()
        if (trimmed.startsWith('data:image/')) {
          const uploaded = await uploadBase64ToCloudinary(trimmed, 'linkedsound/events')
          if (uploaded) processedImages.push(uploaded)
        } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          processedImages.push(trimmed)
        } else {
          return res.status(400).json({
            success: false,
            message: 'Uno o más formatos de imagen no son válidos. Debe ser una imagen local o URL válida.',
          })
        }
      }

      if (processedImages.length > 0) {
        updateData.images = processedImages
        updateData.profileImage = processedImages[0]

        // Sincronizar tabla intermedia EventImage
        await prisma.eventImage.deleteMany({
          where: { eventId: id },
        }).catch(() => {})

        for (let i = 0; i < processedImages.length; i++) {
          const imgUrl = processedImages[i]
          const imgRecord = await prisma.image.create({
            data: { url: imgUrl },
          })
          await prisma.eventImage.create({
            data: {
              eventId: id,
              imageId: imgRecord.id,
              order: i,
            },
          }).catch(() => {})
        }
      }
    }

    const updated = await prisma.event.update({
      where: { id },
      data: updateData,
      include: {
        location: true,
        eventType: true,
        genres: {
          include: {
            genre: true,
          },
        },
        eventImages: {
          include: {
            image: true,
          },
          orderBy: {
            order: 'asc',
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
          create: { name: trimmed, slug: toSlug(trimmed) },
        })

        await prisma.eventGenre.create({
          data: {
            eventId: id,
            genreId: genreRecord.id,
          },
        }).catch(() => {})
      }
    }

    const activeUserId = requestUserId || existing.ownerId
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
      event: formatEventResponse(updated),
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

    const tokenUserId = (req as any).user?.userId || (req as any).user?.id
    const userRole = (req as any).user?.accountRole || (req as any).user?.role
    const requestUserId = tokenUserId || req.body?.ownerId || req.body?.userId

    if (tokenUserId && existing.ownerId !== tokenUserId && userRole !== 'Administrador') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar este evento.',
      })
    }

    // Verificar margen de 24 horas desde su creación
    const createdAtTime = new Date(existing.createdAt).getTime()
    const nowTime = Date.now()
    const hoursElapsed = (nowTime - createdAtTime) / (1000 * 60 * 60)

    if (hoursElapsed > 24 && userRole !== 'Administrador') {
      return res.status(403).json({
        success: false,
        message: 'El plazo de 24 horas para eliminar este evento ha expirado. No es posible eliminarlo.',
      })
    }

    await prisma.event.delete({
      where: { id },
    })

    const userId = tokenUserId || requestUserId || existing.ownerId
    await prisma.userActivityLog.create({
      data: {
        userId,
        action: `Eliminó el evento "${existing.title}" dentro del plazo permitido`,
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
