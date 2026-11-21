import { query, getClient } from '../config/db.js'
import { hashPassword } from '../utils/password.js'
import { uploadBase64ToCloudinary } from './upload.service.js'
import type { UpdateProfileDTO, PerfilResponse } from '../models/perfiles.model.js'

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export const formatUserResponse = (user: any): PerfilResponse | null => {
  if (!user) return null
  const { location, tracks, userStatus, genres, ...rest } = user
  const loc = typeof location === 'object' && location !== null ? location : {}
  const rawLoc = typeof location === 'string' ? location : ''

  const formattedTracks = Array.isArray(tracks)
    ? tracks.map((t: any) => ({
        id: t.id,
        title: t.title || 'Track Destacado',
        plays: typeof t.plays === 'number' ? `${t.plays.toLocaleString()} reproducciones` : String(t.plays || '0'),
        duration: t.duration || '0:30',
        genre: t.genre_name || t.genre || 'Destacado',
        audioUrl: t.audioUrl || t.audio_url || '',
        soundcloudLink: t.soundcloudLink || t.soundcloud_link || '',
        format: t.format || 'MP3',
        snippetType: t.snippetType || t.snippet_type || 'Snippet Demo',
        bpm: t.bpm || '',
        key: t.key || '',
        fileSize: t.fileSize || t.file_size || '',
        order: typeof t.order === 'number' ? t.order : 0,
      }))
    : []

  return {
    ...rest,
    status: userStatus?.name || user.status_name || user.status || 'Active',
    location: loc.formattedAddress || rawLoc || user.formattedAddress || '',
    country: loc.country || user.country || '',
    province: loc.province || user.province || '',
    city: loc.city || user.city || '',
    streetAddress: loc.streetAddress || user.streetAddress || '',
    latitude: loc.latitude ?? user.latitude ?? null,
    longitude: loc.longitude ?? user.longitude ?? null,
    interestGenres: Array.isArray(genres) ? genres : [],
    tracks: formattedTracks,
  }
}

export class PerfilesService {
  /**
   * Obtiene el perfil completo de un usuario con sus relaciones (roles, géneros, tracks).
   */
  async getProfileById(id: string) {
    const userRes = await query(`
      SELECT 
        u.id, u.email, u."firstName", u."lastName", u.nickname,
        COALESCE(
          (SELECT r.name FROM "UserRole" ur JOIN "Role" r ON ur."roleId" = r.id WHERE ur."userId" = u.id LIMIT 1),
          'Artista'
        ) AS role,
        u."accountRole", u."profileImage", u.description,
        u."soundcloudUrl", u."spotifyUrl", u."soundcloudHandle",
        u."locationId", u."statusId", u."reportsCount", u."createdAt", u."updatedAt",
        s.name AS status_name,
        l."formattedAddress", l.country, l.province, l.city, l."streetAddress",
        ST_Y(l.geo_point::geometry) AS latitude,
        ST_X(l.geo_point::geometry) AS longitude
      FROM "User" u
      LEFT JOIN "UserStatus" s ON u."statusId" = s.id
      LEFT JOIN "Location" l ON u."locationId" = l.id
      WHERE u.id = $1;
    `, [id])

    if (userRes.rows.length === 0) return null
    const user = userRes.rows[0]

    const [genresRes, tracksRes] = await Promise.all([
      query(`
        SELECT g.name FROM "ProfileGenre" pg
        JOIN "Genre" g ON pg."genreId" = g.id
        WHERE pg."userId" = $1;
      `, [id]),
      query(`
        SELECT 
          t.id, t.title, t.plays, t.duration, t."audioUrl", t."soundcloudLink",
          t.format, t."snippetType", t.bpm, t.key, t."fileSize", t."order",
          g.name AS genre_name
        FROM "Track" t
        LEFT JOIN "TrackGenre" tg ON tg."trackId" = t.id
        LEFT JOIN "Genre" g ON tg."genreId" = g.id
        WHERE t."userId" = $1
        ORDER BY t."order" ASC;
      `, [id]),
    ])

    user.genres = genresRes.rows.map((r: any) => r.name)
    user.tracks = tracksRes.rows

    return formatUserResponse(user)
  }

  /**
   * Actualiza el perfil de un usuario garantizando integridad transaccional.
   */
  async updateProfile(userId: string, data: UpdateProfileDTO) {
    const user = await this.getProfileById(userId)
    if (!user) {
      const err = new Error('Usuario no encontrado')
      ;(err as any).statusCode = 404
      throw err
    }

    const {
      firstName,
      lastName,
      nickname,
      password,
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
      profileImage,
      tracks,
      trackUrl,
    } = data

    if (nickname && nickname.trim() !== user.nickname) {
      const checkNick = await query(`SELECT id FROM "User" WHERE LOWER(nickname) = LOWER($1) AND id <> $2 LIMIT 1;`, [nickname.trim(), userId])
      if (checkNick.rows.length > 0) {
        throw new Error('El nombre de usuario / artistico ya esta en uso por otro creador')
      }
    }

    if (description && typeof description === 'string' && description.trim().length > 150) {
      throw new Error('La descripcion no puede superar los 150 caracteres (maximo permitido)')
    }

    if (soundcloudUrl && typeof soundcloudUrl === 'string' && soundcloudUrl.trim() && !soundcloudUrl.toLowerCase().includes('soundcloud.com')) {
      throw new Error('El enlace de SoundCloud debe ser una URL valida de SoundCloud (debe contener soundcloud.com)')
    }
    if (spotifyUrl && typeof spotifyUrl === 'string' && spotifyUrl.trim() && !spotifyUrl.toLowerCase().includes('spotify.com')) {
      throw new Error('El enlace de Spotify debe ser una URL valida de Spotify (debe contener spotify.com)')
    }

    let updatedHashedPassword: string | null = null
    if (password && typeof password === 'string' && password.trim().length >= 6) {
      updatedHashedPassword = await hashPassword(password.trim())
    }

    let finalProfileImage: string | null = null
    if (profileImage && typeof profileImage === 'string') {
      finalProfileImage = await uploadBase64ToCloudinary(profileImage, 'linkedsound/avatars')
    }

    const client = await getClient()

    try {
      await client.query('BEGIN')

      // 1. Ubicación con PostGIS
      const hasLocationData = location !== undefined || country !== undefined || city !== undefined
      if (hasLocationData) {
        const latVal = latitude != null && latitude !== '' ? parseFloat(String(latitude)) : null
        const lonVal = longitude != null && longitude !== '' ? parseFloat(String(longitude)) : null

        if (user.locationId) {
          await client.query(`
            UPDATE "Location"
            SET "formattedAddress" = COALESCE($1, "formattedAddress"),
                country = COALESCE($2, country),
                province = COALESCE($3, province),
                city = COALESCE($4, city),
                "streetAddress" = COALESCE($5, "streetAddress"),
                geo_point = CASE 
                  WHEN $6::numeric IS NOT NULL AND $7::numeric IS NOT NULL 
                  THEN ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography 
                  ELSE geo_point 
                END,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $8;
          `, [
            location ? String(location).trim() : null,
            country ? String(country).trim() : null,
            province ? String(province).trim() : null,
            city ? String(city).trim() : null,
            streetAddress ? String(streetAddress).trim() : null,
            latVal,
            lonVal,
            user.locationId,
          ])
        } else if (location || city || country) {
          const locRes = await client.query(`
            INSERT INTO "Location" (id, "formattedAddress", country, province, city, "streetAddress", geo_point, srid, "createdAt", "updatedAt")
            VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5,
              CASE WHEN $6::numeric IS NOT NULL AND $7::numeric IS NOT NULL THEN ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography ELSE NULL END,
              4326, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            RETURNING id;
          `, [
            String(location || 'Sin especificar').trim(),
            country ? String(country).trim() : null,
            province ? String(province).trim() : null,
            city ? String(city).trim() : null,
            streetAddress ? String(streetAddress).trim() : null,
            latVal,
            lonVal,
          ])
          await client.query(`UPDATE "User" SET "locationId" = $1 WHERE id = $2;`, [locRes.rows[0].id, userId])
        }
      }

      // 2. Actualizar Usuario
      const updateFields: string[] = ['"updatedAt" = CURRENT_TIMESTAMP']
      const updateVals: any[] = [userId]
      let pIdx = 2

      if (updatedHashedPassword) {
        updateFields.push(`password = $${pIdx++}`)
        updateVals.push(updatedHashedPassword)
      }
      if (firstName) {
        updateFields.push(`"firstName" = $${pIdx++}`)
        updateVals.push(String(firstName).trim())
      }
      if (lastName) {
        updateFields.push(`"lastName" = $${pIdx++}`)
        updateVals.push(String(lastName).trim())
      }
      if (nickname) {
        updateFields.push(`nickname = $${pIdx++}`)
        updateVals.push(String(nickname).trim())
      }
      if (accountRole && ['Usuario', 'Administrador'].includes(accountRole)) {
        updateFields.push(`"accountRole" = $${pIdx++}`)
        updateVals.push(accountRole)
      }
      if (description !== undefined) {
        updateFields.push(`description = $${pIdx++}`)
        updateVals.push(description ? String(description).trim() : null)
      }
      if (soundcloudUrl !== undefined) {
        updateFields.push(`"soundcloudUrl" = $${pIdx++}`)
        updateVals.push(soundcloudUrl ? String(soundcloudUrl).trim() : null)
      }
      if (spotifyUrl !== undefined) {
        updateFields.push(`"spotifyUrl" = $${pIdx++}`)
        updateVals.push(spotifyUrl ? String(spotifyUrl).trim() : null)
      }
      if (profileImage !== undefined) {
        updateFields.push(`"profileImage" = $${pIdx++}`)
        updateVals.push(finalProfileImage || null)
      }

      await client.query(`
        UPDATE "User"
        SET ${updateFields.join(', ')}
        WHERE id = $1;
      `, updateVals)

      // 3. Sincronizar rol en UserRole
      if (role && ['Productor', 'Artista', 'Productor y Artista'].includes(role)) {
        await client.query(`DELETE FROM "UserRole" WHERE "userId" = $1;`, [userId])
        const roleNames = role === 'Productor y Artista' ? ['Productor', 'Artista'] : [role]
        for (const rName of roleNames) {
          const rRes = await client.query(`SELECT id FROM "Role" WHERE name = $1 LIMIT 1;`, [rName])
          if (rRes.rows.length > 0) {
            await client.query(`
              INSERT INTO "UserRole" ("userId", "roleId", "assignedAt")
              VALUES ($1, $2, CURRENT_TIMESTAMP)
              ON CONFLICT DO NOTHING;
            `, [userId, rRes.rows[0].id])
          }
        }
      }

      // 4. Sincronizar géneros
      if (Array.isArray(interestGenres)) {
        await client.query(`DELETE FROM "ProfileGenre" WHERE "userId" = $1;`, [userId])
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
            INSERT INTO "ProfileGenre" ("userId", "genreId", "createdAt")
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING;
          `, [userId, gRes.rows[0].id])
        }
      }

      // 5. Tracks
      if (Array.isArray(tracks) && tracks.length > 0) {
        await client.query(`DELETE FROM "Track" WHERE "userId" = $1;`, [userId])
        for (let i = 0; i < Math.min(tracks.length, 5); i++) {
          const t = tracks[i]
          const playsNum = typeof t.plays === 'number' ? t.plays : (parseInt(String(t.plays).replace(/\D/g, ''), 10) || 50)
          await client.query(`
            INSERT INTO "Track" (
              id, title, "audioUrl", "soundcloudLink", duration, format, "snippetType", bpm, key, "fileSize", "order", plays, "userId", "createdAt"
            )
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP);
          `, [
            (t.title || `Demo 0${i + 1}`).trim(),
            t.audioUrl || null,
            t.soundcloudLink || null,
            t.duration || '0:30',
            t.format || 'MP3',
            t.snippetType || `0${i + 1} - DEMO EXCLUSIVA`,
            t.bpm || null,
            t.key || null,
            t.fileSize || null,
            i,
            playsNum,
            userId,
          ])
        }
      } else if (typeof trackUrl === 'string' && trackUrl.trim()) {
        const existT = await client.query(`SELECT id FROM "Track" WHERE "userId" = $1 LIMIT 1;`, [userId])
        if (existT.rows.length > 0) {
          await client.query(`
            UPDATE "Track" SET "soundcloudLink" = $1, title = $2 WHERE id = $3;
          `, [trackUrl.trim(), `${nickname || user.nickname || 'Usuario'} - Track Destacado`, existT.rows[0].id])
        } else {
          await client.query(`
            INSERT INTO "Track" (id, title, duration, plays, "soundcloudLink", "userId", "order", "createdAt")
            VALUES (gen_random_uuid(), $1, '0:30', 50, $2, $3, 0, CURRENT_TIMESTAMP);
          `, [`${nickname || user.nickname || 'Usuario'} - Track Destacado`, trackUrl.trim(), userId])
        }
      }

      await client.query('COMMIT')
      return await this.getProfileById(userId)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * Catálogo de géneros ordenado alfabéticamente.
   */
  async getGenres(): Promise<string[]> {
    const res = await query(`SELECT name FROM "Genre" ORDER BY name ASC;`)
    return res.rows.map((r: any) => r.name)
  }

  /**
   * Listado de usuarios para Discovery y Explorer con filtros de exclusión propia.
   */
  async getUsers(currentUserId?: string, currentUserRole?: string, includeAll?: boolean) {
    const shouldExcludeSelf = currentUserId && !includeAll && currentUserRole !== 'Administrador'
    const conditions: string[] = []
    const params: any[] = []
    let pIdx = 1

    if (shouldExcludeSelf) {
      conditions.push(`u.id <> $${pIdx++}`)
      params.push(currentUserId)
    }

    // RF-01 / RF-02: Para Discovery/Matching ordinario, exigir al menos una pista de SoundCloud vinculada en la entidad Track
    if (!includeAll && currentUserRole !== 'Administrador') {
      conditions.push(`EXISTS (
        SELECT 1 FROM "Track" t 
        WHERE t."userId" = u.id 
          AND t."soundcloudLink" IS NOT NULL 
          AND TRIM(t."soundcloudLink") <> ''
      )`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const sql = `
      SELECT 
        u.id, u.email, u."firstName", u."lastName", u.nickname, u."accountRole",
        COALESCE(
          (SELECT r.name FROM "UserRole" ur JOIN "Role" r ON ur."roleId" = r.id WHERE ur."userId" = u.id LIMIT 1),
          'Artista'
        ) AS role,
        u.description, u."profileImage", u."soundcloudUrl", u."spotifyUrl",
        u."locationId", u."reportsCount", u."createdAt", u."updatedAt",
        s.name AS status_name,
        l."formattedAddress", l.country, l.province, l.city, l."streetAddress",
        ST_Y(l.geo_point::geometry) AS latitude,
        ST_X(l.geo_point::geometry) AS longitude
      FROM "User" u
      LEFT JOIN "UserStatus" s ON u."statusId" = s.id
      LEFT JOIN "Location" l ON u."locationId" = l.id
      ${whereClause}
      ORDER BY u."createdAt" DESC;
    `
    const usersRes = await query(sql, params)
    const users = usersRes.rows

    if (users.length === 0) return []

    const userIds = users.map((u: any) => u.id)

    const [genresRes, tracksRes] = await Promise.all([
      query(`
        SELECT pg."userId", g.name
        FROM "ProfileGenre" pg
        JOIN "Genre" g ON pg."genreId" = g.id
        WHERE pg."userId" = ANY($1::uuid[]);
      `, [userIds]),
      query(`
        SELECT 
          t.id, t.title, t.plays, t.duration, t."audioUrl", t."soundcloudLink",
          t.format, t."snippetType", t.bpm, t.key, t."fileSize", t."order", t."userId",
          g.name AS genre_name
        FROM "Track" t
        LEFT JOIN "TrackGenre" tg ON tg."trackId" = t.id
        LEFT JOIN "Genre" g ON tg."genreId" = g.id
        WHERE t."userId" = ANY($1::uuid[])
        ORDER BY t."userId", t."order" ASC;
      `, [userIds]),
    ])

    const genresByUser = new Map<string, string[]>()
    for (const row of genresRes.rows) {
      if (!genresByUser.has(row.userId)) genresByUser.set(row.userId, [])
      genresByUser.get(row.userId)!.push(row.name)
    }

    const tracksByUser = new Map<string, any[]>()
    for (const row of tracksRes.rows) {
      if (!tracksByUser.has(row.userId)) tracksByUser.set(row.userId, [])
      tracksByUser.get(row.userId)!.push(row)
    }

    return users.map((u: any) => {
      const userPayload = {
        ...u,
        genres: genresByUser.get(u.id) || [],
        tracks: tracksByUser.get(u.id) || [],
      }
      return formatUserResponse(userPayload)
    })
  }

  /**
   * Administracion: Actualiza el estado de una cuenta (Active, Suspended, Banned, Inactive)
   * exigiendo justificacion para sanciones o suspensiones.
   */
  async updateUserStatus(adminUserId: string, targetUserId: string, status: string, justification?: string) {
    if (!targetUserId) throw new Error('ID de usuario requerido.')
    const normalizedStatus = String(status || '').trim()

    if (!['Active', 'Suspended', 'Banned', 'Inactive'].includes(normalizedStatus)) {
      throw new Error('Estado de usuario invalido. Debe ser Active, Suspended, Banned o Inactive.')
    }

    if ((normalizedStatus === 'Suspended' || normalizedStatus === 'Banned') && (!justification || !justification.trim())) {
      throw new Error('La justificacion de la suspension o sancion es obligatoria.')
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const uRes = await client.query(`SELECT id, nickname, email FROM "User" WHERE id = $1 LIMIT 1;`, [targetUserId])
      if (uRes.rows.length === 0) {
        throw new Error('Usuario objetivo no encontrado.')
      }
      const targetUser = uRes.rows[0]

      const statusRes = await client.query(`
        INSERT INTO "UserStatus" (id, name, "createdAt")
        VALUES (gen_random_uuid(), $1, CURRENT_TIMESTAMP)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id;
      `, [normalizedStatus])
      const statusId = statusRes.rows[0].id

      await client.query(`
        UPDATE "User"
        SET "statusId" = $1, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $2;
      `, [statusId, targetUserId])

      // Notificar al usuario afectado
      const motive = justification?.trim() || 'Modificacion de estado administrativa.'
      await client.query(`
        INSERT INTO "Notification" (id, "userId", title, message, type, "linkPage", "isRead", "createdAt")
        VALUES (gen_random_uuid(), $1, 'Actualizacion de Estado', $2, 'system', 'Profile', false, CURRENT_TIMESTAMP);
      `, [targetUserId, `Tu cuenta ha cambiado a estado "${normalizedStatus}". Motivo: "${motive}"`])

      // Registrar accion en log de auditoria
      await client.query(`
        INSERT INTO "UserActivityLog" (id, "userId", action, ip, device, module, "createdAt")
        VALUES (gen_random_uuid(), $1, $2, '127.0.0.1', 'Admin Panel', 'Perfil', CURRENT_TIMESTAMP);
      `, [adminUserId || targetUserId, `Cambio estado del usuario "${targetUser.nickname}" a ${normalizedStatus}. Motivo: "${motive}"`])

      await client.query('COMMIT')
      return await this.getProfileById(targetUserId)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * Administracion: Da de baja / elimina una cuenta de usuario.
   */
  async deleteUser(adminUserId: string, targetUserId: string) {
    if (!targetUserId) throw new Error('ID de usuario requerido.')

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const uRes = await client.query(`SELECT id, nickname FROM "User" WHERE id = $1 LIMIT 1;`, [targetUserId])
      if (uRes.rows.length === 0) {
        throw new Error('Usuario objetivo no encontrado.')
      }

      // Eliminar registros de usuario en cascada
      await client.query(`DELETE FROM "Conversation" WHERE "user1Id" = $1 OR "user2Id" = $1;`, [targetUserId])
      await client.query(`DELETE FROM "Match" WHERE "user1Id" = $1 OR "user2Id" = $1;`, [targetUserId])
      await client.query(`DELETE FROM "Interaction" WHERE "senderId" = $1 OR "receiverId" = $1;`, [targetUserId])
      await client.query(`DELETE FROM "User" WHERE id = $1;`, [targetUserId])

      await client.query(`
        INSERT INTO "UserActivityLog" (id, "userId", action, ip, device, module, "createdAt")
        VALUES (gen_random_uuid(), $1, $2, '127.0.0.1', 'Admin Panel', 'Perfil', CURRENT_TIMESTAMP);
      `, [adminUserId, `Dio de baja al usuario ID "${targetUserId}"`])

      await client.query('COMMIT')
      return { success: true, message: 'Usuario dado de baja exitosamente.' }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
}

export const perfilesService = new PerfilesService()

