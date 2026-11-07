import { query, getClient } from '../config/db.js'
import { uploadBase64ToCloudinary } from './upload.service.js'

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export const formatEventResponse = (ev: any) => {
  const loc = typeof ev.location === 'object' && ev.location !== null ? ev.location : {}
  const rawLoc = typeof ev.location === 'string' ? ev.location : ''

  const dateObj = ev.eventDate ? new Date(ev.eventDate) : new Date()
  const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : String(ev.eventDate || '')

  const imagesList: string[] = Array.isArray(ev.images) && ev.images.length > 0
    ? ev.images
    : (ev.profileImage
        ? [ev.profileImage]
        : ['https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80'])

  return {
    id: ev.id,
    title: ev.title,
    nickname: ev.nickname || ev.title,
    role: ev.event_type_name || ev.role || 'Evento Live',
    eventTypeId: ev.eventTypeId || ev.event_type_id || null,
    eventDate: dateStr,
    eventTime: ev.eventTime || ev.event_time || '22:00',
    venue: ev.venue || loc.name || 'Venue Principal',
    ticketUrl: ev.ticketUrl || ev.ticket_url || null,
    isFinished: (ev.status_name === 'Finished' || ev.status === 'Finished' || Boolean(ev.isFinished)),
    description: ev.description || '',
    images: imagesList,
    profileImage: imagesList[0],
    location: loc.formattedAddress || ev.formattedAddress || rawLoc || '',
    country: loc.country || ev.country || '',
    province: loc.province || ev.province || '',
    city: loc.city || ev.city || '',
    streetAddress: loc.streetAddress || ev.streetAddress || '',
    latitude: loc.latitude ?? ev.latitude ?? null,
    longitude: loc.longitude ?? ev.longitude ?? null,
    locationId: ev.locationId || ev.location_id || loc.id || null,
    locationData: typeof ev.location === 'object' && ev.location !== null ? ev.location : null,
    status: ev.status_name || ev.status || 'Active',
    reportsCount: ev.reportsCount ?? ev.reports_count ?? 0,
    soundcloudUrl: ev.soundcloudUrl || ev.soundcloud_url || '',
    spotifyUrl: ev.spotifyUrl || ev.spotify_url || '',
    interestGenres: Array.isArray(ev.genres)
      ? ev.genres.map((g: any) => (typeof g === 'string' ? g : g.genre?.name || g.name || ''))
      : ev.interestGenres || [],
    owner: ev.owner_name || (ev.owner_first ? `${ev.owner_first} ${ev.owner_last || ''}`.trim() : null) || ev.owner_nickname || 'Organizador',
    ownerId: ev.ownerId || ev.owner_id,
    ownerNickname: ev.owner_nickname || '',
    tracks: ev.tracks || [],
    comments: Array.isArray(ev.comments) ? ev.comments : [],
    createdAt: ev.createdAt || ev.created_at,
    updatedAt: ev.updatedAt || ev.updated_at,
  }
}

export class EventService {
  /**
   * Obtiene todos los eventos con sus imágenes, géneros, comentarios y organizador.
   */
  async getAllEvents() {
    const sql = `
      SELECT 
        e.id, e.title, e.nickname, e."eventTypeId" AS event_type_id, e."eventDate" AS "eventDate",
        e."eventTime" AS "eventTime", e.venue, e."ticketUrl" AS ticket_url, e.description,
        e."profileImage" AS "profileImage", e."locationId" AS location_id, e."statusId" AS status_id,
        e."reportsCount" AS reports_count, e."soundcloudUrl" AS soundcloud_url, e."spotifyUrl" AS spotify_url,
        e."ownerId" AS owner_id, e."createdAt" AS "createdAt", e."updatedAt" AS "updatedAt",
        et.name AS event_type_name,
        es.name AS status_name,
        l."formattedAddress", l.country, l.province, l.city, l."streetAddress", l.latitude, l.longitude,
        u."firstName" AS owner_first, u."lastName" AS owner_last, u.nickname AS owner_nickname
      FROM "Event" e
      LEFT JOIN "EventType" et ON e."eventTypeId" = et.id
      LEFT JOIN "EventStatus" es ON e."statusId" = es.id
      LEFT JOIN "Location" l ON e."locationId" = l.id
      LEFT JOIN "User" u ON e."ownerId" = u.id
      ORDER BY e."createdAt" DESC;
    `
    const { rows: events } = await query(sql)

    // Cargar imágenes de eventos ordenadas por isCover DESC, order ASC
    const imgRes = await query(`
      SELECT ei."eventId", i.url, ei."isCover", ei."order"
      FROM "EventImage" ei
      JOIN "Image" i ON ei."imageId" = i.id
      ORDER BY ei."isCover" DESC, ei."order" ASC;
    `)
    const imagesByEvent = new Map<string, string[]>()
    for (const row of imgRes.rows) {
      if (!imagesByEvent.has(row.eventId)) imagesByEvent.set(row.eventId, [])
      imagesByEvent.get(row.eventId)!.push(row.url)
    }

    // Cargar géneros de eventos
    const genresRes = await query(`
      SELECT eg."eventId", g.name
      FROM "EventGenre" eg
      JOIN "Genre" g ON eg."genreId" = g.id;
    `)
    const genresByEvent = new Map<string, string[]>()
    for (const row of genresRes.rows) {
      if (!genresByEvent.has(row.eventId)) genresByEvent.set(row.eventId, [])
      genresByEvent.get(row.eventId)!.push(row.name)
    }

    // Cargar comentarios
    const commentsRes = await query(`
      SELECT 
        ec.id, ec."eventId", ec."userId", ec.content, ec."createdAt", ec."updatedAt",
        u.nickname, u."firstName", u."lastName", u."profileImage"
      FROM "EventComment" ec
      JOIN "User" u ON ec."userId" = u.id
      ORDER BY ec."createdAt" DESC;
    `)
    const commentsByEvent = new Map<string, any[]>()
    for (const c of commentsRes.rows) {
      if (!commentsByEvent.has(c.eventId)) commentsByEvent.set(c.eventId, [])
      commentsByEvent.get(c.eventId)!.push({
        id: c.id,
        eventId: c.eventId,
        userId: c.userId,
        content: c.content,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        user: {
          id: c.userId,
          nickname: c.nickname,
          firstName: c.firstName,
          lastName: c.lastName,
          profileImage: c.profileImage,
        },
      })
    }

    return events.map((ev: any) => {
      const fullEv = {
        ...ev,
        images: imagesByEvent.get(ev.id) || (ev.profileImage ? [ev.profileImage] : []),
        genres: genresByEvent.get(ev.id) || [],
        comments: commentsByEvent.get(ev.id) || [],
        location: {
          formattedAddress: ev.formattedAddress,
          country: ev.country,
          province: ev.province,
          city: ev.city,
          streetAddress: ev.streetAddress,
          latitude: ev.latitude,
          longitude: ev.longitude,
        },
      }
      return formatEventResponse(fullEv)
    })
  }

  /**
   * Crea un evento validando campos obligatorios, imágenes, ubicación y géneros.
   */
  async createEvent(currentUserId: string | undefined, data: any) {
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
      images,
      ownerNickname,
    } = data

    if (!title || !location || !eventDate) {
      throw new Error('Título, ubicación y fecha son campos obligatorios.')
    }

    const trimmedTitle = String(title).trim()
    if (trimmedTitle.length < 3 || trimmedTitle.length > 50) {
      throw new Error('El título del evento debe tener entre 3 y 50 caracteres para preservar el formato.')
    }

    // Validar año de 4 dígitos
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(String(eventDate).trim())) {
      throw new Error('La fecha del evento debe tener un formato válido con año de 4 dígitos (AAAA-MM-DD).')
    }
    const yearNumber = parseInt(String(eventDate).trim().split('-')[0], 10)
    const currentYear = new Date().getFullYear()
    if (isNaN(yearNumber) || yearNumber < currentYear || yearNumber > 2099) {
      throw new Error(`El año del evento debe ser de 4 dígitos entre ${currentYear} y 2099.`)
    }

    // Determinar propietario organizador
    let ownerId = currentUserId
    if (!ownerId && ownerNickname) {
      const uRes = await query(`SELECT id FROM "User" WHERE LOWER(nickname) = LOWER($1) LIMIT 1;`, [String(ownerNickname).trim()])
      if (uRes.rows.length > 0) ownerId = uRes.rows[0].id
    }
    if (!ownerId) {
      const fallback = await query(`
        SELECT u.id FROM "User" u
        INNER JOIN "UserStatus" s ON u."statusId" = s.id
        WHERE s.name = 'Active' LIMIT 1;
      `)
      if (fallback.rows.length > 0) ownerId = fallback.rows[0].id
      else throw new Error('No se encontró un usuario organizador para asociar el evento.')
    }

    // Procesar imágenes (1 a 5)
    const rawImages: string[] = Array.isArray(images) && images.length > 0
      ? images.filter((img: any) => typeof img === 'string' && img.trim())
      : (profileImage && typeof profileImage === 'string' && profileImage.trim() ? [profileImage.trim()] : [])

    if (rawImages.length < 1) {
      throw new Error('El evento debe incluir al menos 1 imagen de presentación.')
    }
    if (rawImages.length > 5) {
      throw new Error('No puedes cargar más de 5 imágenes para el evento.')
    }

    const processedImages: string[] = []
    for (const imgItem of rawImages) {
      const trimmed = imgItem.trim()
      if (trimmed.startsWith('data:image/')) {
        const uploaded = await uploadBase64ToCloudinary(trimmed, 'linkedsound/events')
        if (uploaded) processedImages.push(uploaded)
      } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        processedImages.push(trimmed)
      } else {
        throw new Error('Uno o más formatos de imagen no son válidos. Debe ser una imagen local o URL válida.')
      }
    }

    if (processedImages.length < 1) {
      processedImages.push('https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80')
    }

    const client = await getClient()

    try {
      await client.query('BEGIN')

      // 1. Ubicación
      const formattedAddress = String(location || [streetAddress, city, province, country].filter(Boolean).join(', ') || 'Sin especificar').trim()
      const locRes = await client.query(`
        INSERT INTO "Location" (id, name, "formattedAddress", country, province, city, "streetAddress", latitude, longitude, srid, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 4326, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id;
      `, [
        venue ? String(venue).trim() : null,
        formattedAddress,
        country ? String(country).trim() : null,
        province ? String(province).trim() : null,
        city ? String(city).trim() : null,
        streetAddress ? String(streetAddress).trim() : null,
        latitude ? parseFloat(latitude) : null,
        longitude ? parseFloat(longitude) : null,
      ])
      const locationId = locRes.rows[0].id

      // 2. Tipo de evento
      let eventTypeId: string | null = null
      if (role) {
        const etRes = await client.query(`
          INSERT INTO "EventType" (id, name, "createdAt")
          VALUES (gen_random_uuid(), $1, CURRENT_TIMESTAMP)
          ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
          RETURNING id;
        `, [String(role).trim()])
        eventTypeId = etRes.rows[0].id
      }

      // 3. Status 'Active'
      const statusRes = await client.query(`SELECT id FROM "EventStatus" WHERE name = 'Active' LIMIT 1;`)
      const statusId = statusRes.rows.length > 0 ? statusRes.rows[0].id : null

      // 4. Insertar Evento
      const eventInsert = await client.query(`
        INSERT INTO "Event" (
          id, title, nickname, "eventTypeId", "eventDate", "eventTime", venue, "ticketUrl",
          description, "profileImage", "locationId", "statusId", "reportsCount", "soundcloudUrl", "spotifyUrl", "ownerId",
          "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, 0, $12, $13, $14,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING *;
      `, [
        trimmedTitle,
        nickname ? String(nickname).trim() : trimmedTitle,
        eventTypeId,
        String(eventDate).trim(),
        (eventTime ? String(eventTime).trim() : '22:00').slice(0, 8),
        venue ? String(venue).trim().slice(0, 100) : null,
        ticketUrl ? String(ticketUrl).trim() : null,
        description ? String(description).trim().slice(0, 250) : null,
        processedImages[0],
        locationId,
        statusId,
        soundcloudUrl ? String(soundcloudUrl).trim() : null,
        spotifyUrl ? String(spotifyUrl).trim() : null,
        ownerId,
      ])
      const createdEvent = eventInsert.rows[0]

      // 5. Imágenes normalizadas en Image y EventImage con isCover
      for (let i = 0; i < processedImages.length; i++) {
        const imgUrl = processedImages[i]
        const imgRes = await client.query(`
          INSERT INTO "Image" (id, url, "createdAt")
          VALUES (gen_random_uuid(), $1, CURRENT_TIMESTAMP)
          RETURNING id;
        `, [imgUrl])
        const imgId = imgRes.rows[0].id

        await client.query(`
          INSERT INTO "EventImage" ("eventId", "imageId", "isCover", "order", "createdAt")
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          ON CONFLICT ("eventId", "imageId") DO NOTHING;
        `, [createdEvent.id, imgId, i === 0, i])
      }

      // 6. Géneros
      if (Array.isArray(interestGenres) && interestGenres.length > 0) {
        for (const gName of interestGenres) {
          const trimmed = String(gName).trim()
          if (!trimmed) continue
          const gRes = await client.query(`
            INSERT INTO "Genre" (id, name, slug, "createdAt")
            VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id;
          `, [trimmed, toSlug(trimmed)])
          await client.query(`
            INSERT INTO "EventGenre" ("eventId", "genreId", "createdAt")
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT ("eventId", "genreId") DO NOTHING;
          `, [createdEvent.id, gRes.rows[0].id])
        }
      }

      // 7. Log de actividad
      await client.query(`
        INSERT INTO "UserActivityLog" (id, "userId", action, ip, device, module, "createdAt")
        VALUES (gen_random_uuid(), $1, $2, '127.0.0.1', 'Web Browser', 'Explorer', CURRENT_TIMESTAMP);
      `, [ownerId, `Creó el evento "${createdEvent.title}" para la fecha ${createdEvent.eventDate}`])

      await client.query('COMMIT')

      return formatEventResponse({
        ...createdEvent,
        images: processedImages,
        interestGenres: Array.isArray(interestGenres) ? interestGenres : [],
        location: { formattedAddress },
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * Actualiza los datos de un evento, sus imágenes y géneros asociados.
   */
  async updateEvent(id: string, currentUserId: string | undefined, currentUserRole: string | undefined, data: any) {
    const eventRes = await query(`SELECT * FROM "Event" WHERE id = $1 LIMIT 1;`, [id])
    if (eventRes.rows.length === 0) {
      throw new Error('Evento no encontrado.')
    }
    const existing = eventRes.rows[0]

    // Autorización
    const isAdmin = currentUserRole === 'Administrador'
    if (currentUserId && existing.ownerId !== currentUserId && !isAdmin) {
      throw new Error('No tienes permisos para modificar este evento.')
    }

    const {
      title,
      nickname,
      venue,
      ticketUrl,
      description,
      soundcloudUrl,
      spotifyUrl,
      images,
      profileImage,
    } = data

    const client = await getClient()

    try {
      await client.query('BEGIN')

      const updates: string[] = ['"updatedAt" = CURRENT_TIMESTAMP']
      const vals: any[] = [id]
      let pIdx = 2

      if (title) {
        updates.push(`title = $${pIdx++}`)
        vals.push(String(title).trim().slice(0, 100))
      }
      if (nickname) {
        updates.push(`nickname = $${pIdx++}`)
        vals.push(String(nickname).trim().slice(0, 100))
      }
      if (venue !== undefined) {
        updates.push(`venue = $${pIdx++}`)
        vals.push(venue ? String(venue).trim().slice(0, 100) : null)
      }
      if (ticketUrl !== undefined) {
        updates.push(`"ticketUrl" = $${pIdx++}`)
        vals.push(ticketUrl ? String(ticketUrl).trim() : null)
      }
      if (description !== undefined) {
        updates.push(`description = $${pIdx++}`)
        vals.push(description ? String(description).trim().slice(0, 250) : null)
      }
      if (soundcloudUrl !== undefined) {
        updates.push(`"soundcloudUrl" = $${pIdx++}`)
        vals.push(soundcloudUrl ? String(soundcloudUrl).trim() : null)
      }
      if (spotifyUrl !== undefined) {
        updates.push(`"spotifyUrl" = $${pIdx++}`)
        vals.push(spotifyUrl ? String(spotifyUrl).trim() : null)
      }

      await client.query(`
        UPDATE "Event"
        SET ${updates.join(', ')}
        WHERE id = $1;
      `, vals)

      // Actualizar imágenes si se enviaron
      const rawImages: string[] | null = Array.isArray(images) && images.length > 0
        ? images
        : (profileImage ? [profileImage] : null)

      if (rawImages && rawImages.length > 0) {
        await client.query(`DELETE FROM "EventImage" WHERE "eventId" = $1;`, [id])
        for (let i = 0; i < Math.min(rawImages.length, 5); i++) {
          const imgUrl = rawImages[i]
          const imgRes = await client.query(`
            INSERT INTO "Image" (id, url, "createdAt")
            VALUES (gen_random_uuid(), $1, CURRENT_TIMESTAMP)
            RETURNING id;
          `, [imgUrl])
          await client.query(`
            INSERT INTO "EventImage" ("eventId", "imageId", "isCover", "order", "createdAt")
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP);
          `, [id, imgRes.rows[0].id, i === 0, i])
        }
      }

      await client.query('COMMIT')
      const updated = await query(`SELECT * FROM "Event" WHERE id = $1;`, [id])
      return formatEventResponse(updated.rows[0])
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * Elimina un evento y sus registros hijos en cascada.
   */
  async deleteEvent(id: string, currentUserId: string | undefined, currentUserRole: string | undefined) {
    const eventRes = await query(`SELECT * FROM "Event" WHERE id = $1 LIMIT 1;`, [id])
    if (eventRes.rows.length === 0) {
      throw new Error('Evento no encontrado.')
    }
    const existing = eventRes.rows[0]

    const isAdmin = currentUserRole === 'Administrador'
    if (currentUserId && existing.ownerId !== currentUserId && !isAdmin) {
      throw new Error('No tienes permisos para eliminar este evento.')
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')
      await client.query(`DELETE FROM "EventImage" WHERE "eventId" = $1;`, [id])
      await client.query(`DELETE FROM "EventGenre" WHERE "eventId" = $1;`, [id])
      await client.query(`DELETE FROM "EventComment" WHERE "eventId" = $1;`, [id])
      await client.query(`DELETE FROM "Report" WHERE "reportedEventId" = $1;`, [id])
      await client.query(`DELETE FROM "Event" WHERE id = $1;`, [id])
      await client.query('COMMIT')
      return { message: 'Evento eliminado correctamente.' }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * Añade un comentario a un evento.
   */
  async addComment(eventId: string, userId: string, content: string) {
    if (!content || !String(content).trim()) {
      throw new Error('El comentario no puede estar vacío.')
    }

    const res = await query(`
      INSERT INTO "EventComment" (id, "eventId", "userId", content, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
    `, [eventId, userId, String(content).trim()])

    const userRes = await query(`
      SELECT id, nickname, "firstName", "lastName", "profileImage" FROM "User" WHERE id = $1;
    `, [userId])

    return {
      ...res.rows[0],
      user: userRes.rows[0] || null,
    }
  }

  /**
   * Elimina un comentario de evento validando autor o administrador.
   */
  async deleteComment(commentId: string, userId: string, userRole: string | undefined) {
    const commentRes = await query(`SELECT * FROM "EventComment" WHERE id = $1 LIMIT 1;`, [commentId])
    if (commentRes.rows.length === 0) {
      throw new Error('Comentario no encontrado.')
    }
    const comment = commentRes.rows[0]

    const isAdmin = userRole === 'Administrador'
    if (comment.userId !== userId && !isAdmin) {
      throw new Error('No tienes permisos para eliminar este comentario.')
    }

    await query(`DELETE FROM "EventComment" WHERE id = $1;`, [commentId])
    return { message: 'Comentario eliminado.' }
  }
}

export const eventService = new EventService()

