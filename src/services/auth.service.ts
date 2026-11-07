import { query, getClient } from '../config/db.js'
import { hashPassword, comparePassword } from '../utils/password.js'
import { generateToken } from '../utils/jwt.js'
import { uploadBase64ToCloudinary } from './upload.service.js'

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export const formatUserResponse = (user: any) => {
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
    status: userStatus?.name || user.status || 'Active',
    location: loc.formattedAddress || rawLoc || user.formattedAddress || '',
    country: loc.country || user.country || '',
    province: loc.province || user.province || '',
    city: loc.city || user.city || '',
    streetAddress: loc.streetAddress || user.streetAddress || '',
    latitude: loc.latitude ?? user.latitude ?? null,
    longitude: loc.longitude ?? user.longitude ?? null,
    locationId: user.locationId || loc.id || null,
    locationData: typeof location === 'object' && location !== null ? location : null,
    interestGenres: Array.isArray(genres)
      ? genres.map((g: any) => (typeof g === 'string' ? g : g.name || g.genre?.name || ''))
      : Array.isArray(user.interestGenres)
      ? user.interestGenres
      : [],
    tracks: formattedTracks,
  }
}

export class AuthService {
  /**
   * Helper para obtener un usuario completamente hidratado (con location, status, tracks, genres).
   */
  async getUserById(userId: string) {
    const userRes = await query(`
      SELECT 
        u.id, u.email, u.password, u."firstName", u."lastName", u.nickname,
        u.role, u."accountRole", u."profileImage", u.description,
        u."soundcloudUrl", u."spotifyUrl", u."soundcloudHandle",
        u."locationId", u."statusId", u."reportsCount", u."createdAt", u."updatedAt",
        s.name AS status_name,
        l."formattedAddress", l.country, l.province, l.city, l."streetAddress", l.latitude, l.longitude
      FROM "User" u
      LEFT JOIN "UserStatus" s ON u."statusId" = s.id
      LEFT JOIN "Location" l ON u."locationId" = l.id
      WHERE u.id = $1
      LIMIT 1;
    `, [userId])

    if (userRes.rows.length === 0) return null
    const row = userRes.rows[0]

    // Géneros
    const genresRes = await query(`
      SELECT g.id, g.name
      FROM "ProfileGenre" pg
      JOIN "Genre" g ON pg."genreId" = g.id
      WHERE pg."userId" = $1;
    `, [userId])

    // Tracks con su género relacionado
    const tracksRes = await query(`
      SELECT 
        t.id, t.title, t.plays, t.duration, t."audioUrl", t."soundcloudLink",
        t.format, t."snippetType", t.bpm, t.key, t."fileSize", t."order",
        g.name AS genre_name
      FROM "Track" t
      LEFT JOIN "TrackGenre" tg ON t.id = tg."trackId"
      LEFT JOIN "Genre" g ON tg."genreId" = g.id
      WHERE t."userId" = $1
      ORDER BY t."order" ASC;
    `, [userId])

    return {
      ...row,
      status: row.status_name || 'Active',
      genres: genresRes.rows.map((g: any) => g.name),
      tracks: tracksRes.rows,
    }
  }

  /**
   * Registro de un nuevo usuario aplicando reglas de unicidad, hash y relaciones.
   */
  async register(data: any) {
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
      profileImage,
      tracks,
      trackUrl,
    } = data

    if (!email || !password || !firstName || !lastName || !nickname || !location) {
      throw new Error('Faltan campos obligatorios para el registro')
    }

    // Comprobar unicidad de email y nickname
    const existing = await query(`
      SELECT email, nickname FROM "User"
      WHERE LOWER(email) = LOWER($1) OR LOWER(nickname) = LOWER($2)
      LIMIT 1;
    `, [email.trim(), nickname.trim()])

    if (existing.rows.length > 0) {
      const isEmail = existing.rows[0].email.toLowerCase() === email.trim().toLowerCase()
      const field = isEmail ? 'El correo electronico' : 'El nombre de usuario (nickname)'
      const err = new Error(`${field} ya se encuentra registrado`)
      ;(err as any).statusCode = 409
      throw err
    }

    const hashedPassword = await hashPassword(password)

    let finalProfileImage: string | null = null
    if (profileImage && typeof profileImage === 'string') {
      finalProfileImage = await uploadBase64ToCloudinary(profileImage, 'linkedsound/avatars')
    }

    const client = await getClient()

    try {
      await client.query('BEGIN')

      // 1. Crear Location
      const formattedAddress = String(location || [streetAddress, city, province, country].filter(Boolean).join(', ') || 'Sin especificar').trim()
      const locInsert = await client.query(`
        INSERT INTO "Location" (id, "formattedAddress", country, province, city, "streetAddress", latitude, longitude, srid, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 4326, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id;
      `, [
        formattedAddress,
        country ? String(country).trim() : null,
        province ? String(province).trim() : null,
        city ? String(city).trim() : null,
        streetAddress ? String(streetAddress).trim() : null,
        latitude ? parseFloat(latitude) : null,
        longitude ? parseFloat(longitude) : null,
      ])
      const locationId = locInsert.rows[0].id

      // 2. Obtener statusId 'Active'
      const statusRes = await client.query(`SELECT id FROM "UserStatus" WHERE name = 'Active' LIMIT 1;`)
      const statusId = statusRes.rows.length > 0 ? statusRes.rows[0].id : null

      // 3. Insertar Usuario
      const userInsert = await client.query(`
        INSERT INTO "User" (
          id, email, password, "firstName", "lastName", nickname, role, "accountRole",
          "profileImage", description, "soundcloudUrl", "spotifyUrl", "locationId", "statusId",
          "reportsCount", "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'Usuario',
          $7, $8, $9, $10, $11, $12, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING id, email, nickname, role, "accountRole";
      `, [
        email.trim().toLowerCase(),
        hashedPassword,
        firstName.trim(),
        lastName.trim(),
        nickname.trim(),
        role || 'Artista',
        finalProfileImage,
        description ? String(description).trim().slice(0, 150) : null,
        soundcloudUrl ? String(soundcloudUrl).trim() : null,
        spotifyUrl ? String(spotifyUrl).trim() : null,
        locationId,
        statusId,
      ])
      const newUser = userInsert.rows[0]

      // 4. Asignar rol RBAC básico en UserRole
      const roleRes = await client.query(`SELECT id FROM "Role" WHERE name = 'Usuario' LIMIT 1;`)
      if (roleRes.rows.length > 0) {
        await client.query(`
          INSERT INTO "UserRole" ("userId", "roleId", "assignedAt")
          VALUES ($1, $2, CURRENT_TIMESTAMP)
          ON CONFLICT DO NOTHING;
        `, [newUser.id, roleRes.rows[0].id])
      }

      // 5. Vincular géneros musicales
      const genreList = Array.isArray(interestGenres)
        ? interestGenres.filter((g: any) => typeof g === 'string' && g.trim().length > 0)
        : []

      for (const gName of genreList) {
        const trimmed = String(gName).trim()
        if (!trimmed) continue
        const gRes = await client.query(`
          INSERT INTO "Genre" (id, name, slug, "createdAt")
          VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP)
          ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
          RETURNING id;
        `, [trimmed, toSlug(trimmed)])
        const gId = gRes.rows[0].id

        await client.query(`
          INSERT INTO "ProfileGenre" ("userId", "genreId", "createdAt")
          VALUES ($1, $2, CURRENT_TIMESTAMP)
          ON CONFLICT DO NOTHING;
        `, [newUser.id, gId])
      }

      // 6. Tracks
      const incomingTracks = Array.isArray(tracks) ? tracks : []
      if (incomingTracks.length > 0) {
        for (let i = 0; i < Math.min(incomingTracks.length, 5); i++) {
          const t = incomingTracks[i]
          const trackIns = await client.query(`
            INSERT INTO "Track" (
              id, title, "audioUrl", "soundcloudLink", duration, format, "snippetType", bpm, key, "fileSize", "order", plays, "userId", "createdAt"
            )
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
            RETURNING id;
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
            typeof t.plays === 'number' ? t.plays : 50,
            newUser.id,
          ])
        }
      } else if (typeof trackUrl === 'string' && trackUrl.trim()) {
        await client.query(`
          INSERT INTO "Track" (
            id, title, duration, plays, "soundcloudLink", "userId", "order", "createdAt"
          )
          VALUES (gen_random_uuid(), $1, 'SoundCloud', 120, $2, $3, 0, CURRENT_TIMESTAMP);
        `, [`${newUser.nickname || 'Usuario'} - Track Destacado`, trackUrl.trim(), newUser.id])
      }

      await client.query('COMMIT')

      const fullUser = await this.getUserById(newUser.id)
      const token = generateToken({
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role || 'Artista',
        accountRole: newUser.accountRole || 'Usuario',
      })

      return {
        token,
        user: formatUserResponse(fullUser),
      }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * Inicio de sesión con validación de credenciales criptográficas y generación de JWT.
   */
  async login(email: string, pass: string) {
    if (!email || !pass) {
      throw new Error('Debe ingresar email y contrasena')
    }

    const userRes = await query(`
      SELECT id, email, password, role, "accountRole"
      FROM "User"
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `, [email.trim()])

    if (userRes.rows.length === 0) {
      const err = new Error('Credenciales invalidas')
      ;(err as any).statusCode = 401
      throw err
    }

    const user = userRes.rows[0]
    const isValid = await comparePassword(pass, user.password)
    if (!isValid) {
      const err = new Error('Credenciales invalidas')
      ;(err as any).statusCode = 401
      throw err
    }

    const fullUser = await this.getUserById(user.id)
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role || 'Artista',
      accountRole: user.accountRole || 'Usuario',
    })

    return {
      token,
      user: formatUserResponse(fullUser),
    }
  }

  /**
   * Obtiene el perfil propio del usuario autenticado.
   */
  async getMe(userId: string) {
    const user = await this.getUserById(userId)
    if (!user) {
      const err = new Error('Usuario no encontrado')
      ;(err as any).statusCode = 404
      throw err
    }
    return formatUserResponse(user)
  }

  /**
   * Actualiza el perfil de usuario, contraseñas, ubicación y pistas de audio.
   */
  async updateProfile(userId: string, data: any) {
    const user = await this.getUserById(userId)
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

    if (description !== undefined && description !== null && typeof description === 'string' && description.trim().length > 150) {
      throw new Error('La descripcion debe tener como maximo 150 caracteres')
    }

    if (spotifyUrl && typeof spotifyUrl === 'string' && spotifyUrl.trim() && !spotifyUrl.toLowerCase().includes('spotify.com')) {
      throw new Error('El enlace de Spotify debe ser una URL valida de Spotify (debe contener spotify.com)')
    }

    if (soundcloudUrl && typeof soundcloudUrl === 'string' && soundcloudUrl.trim() && !soundcloudUrl.toLowerCase().includes('soundcloud.com')) {
      throw new Error('El enlace de SoundCloud debe ser una URL valida de SoundCloud (debe contener soundcloud.com)')
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

      // 1. Ubicación
      const hasLocationData = location !== undefined || country !== undefined || city !== undefined
      if (hasLocationData) {
        if (user.locationId) {
          await client.query(`
            UPDATE "Location"
            SET "formattedAddress" = COALESCE($1, "formattedAddress"),
                country = COALESCE($2, country),
                province = COALESCE($3, province),
                city = COALESCE($4, city),
                "streetAddress" = COALESCE($5, "streetAddress"),
                latitude = COALESCE($6, latitude),
                longitude = COALESCE($7, longitude),
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $8;
          `, [
            location ? String(location).trim() : null,
            country ? String(country).trim() : null,
            province ? String(province).trim() : null,
            city ? String(city).trim() : null,
            streetAddress ? String(streetAddress).trim() : null,
            latitude ? parseFloat(latitude) : null,
            longitude ? parseFloat(longitude) : null,
            user.locationId,
          ])
        } else if (location || city || country) {
          const locRes = await client.query(`
            INSERT INTO "Location" (id, "formattedAddress", country, province, city, "streetAddress", latitude, longitude, srid, "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 4326, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id;
          `, [
            String(location || 'Sin especificar').trim(),
            country ? String(country).trim() : null,
            province ? String(province).trim() : null,
            city ? String(city).trim() : null,
            streetAddress ? String(streetAddress).trim() : null,
            latitude ? parseFloat(latitude) : null,
            longitude ? parseFloat(longitude) : null,
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
      if (role && ['Productor', 'Artista', 'Productor y Artista'].includes(role)) {
        updateFields.push(`role = $${pIdx++}`)
        updateVals.push(role)
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

      // 3. Sincronizar géneros
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

      // 4. Tracks
      if (Array.isArray(tracks) && tracks.length > 0) {
        await client.query(`DELETE FROM "Track" WHERE "userId" = $1;`, [userId])
        for (let i = 0; i < Math.min(tracks.length, 5); i++) {
          const t = tracks[i]
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
            typeof t.plays === 'number' ? t.plays : 50,
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
            VALUES (gen_random_uuid(), $1, 'SoundCloud', 120, $2, $3, 0, CURRENT_TIMESTAMP);
          `, [`${nickname || user.nickname || 'Usuario'} - Track Destacado`, trackUrl.trim(), userId])
        }
      }

      await client.query('COMMIT')
      const updatedUser = await this.getUserById(userId)
      return formatUserResponse(updatedUser)
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

    const sql = `
      SELECT 
        u.id, u.email, u."firstName", u."lastName", u.nickname, u.role, u."accountRole",
        u.description, u."profileImage", u."soundcloudUrl", u."spotifyUrl",
        u."locationId", u."reportsCount", u."createdAt", u."updatedAt",
        s.name AS status_name,
        l."formattedAddress", l.country, l.province, l.city, l."streetAddress", l.latitude, l.longitude
      FROM "User" u
      LEFT JOIN "UserStatus" s ON u."statusId" = s.id
      LEFT JOIN "Location" l ON u."locationId" = l.id
      ${shouldExcludeSelf ? 'WHERE u.id <> $1' : ''}
      ORDER BY u."createdAt" DESC;
    `
    const params = shouldExcludeSelf ? [currentUserId] : []
    const usersRes = await query(sql, params)

    const allGenresRes = await query(`
      SELECT pg."userId", g.name
      FROM "ProfileGenre" pg
      JOIN "Genre" g ON pg."genreId" = g.id;
    `)
    const genresByUser = new Map<string, string[]>()
    for (const row of allGenresRes.rows) {
      if (!genresByUser.has(row.userId)) genresByUser.set(row.userId, [])
      genresByUser.get(row.userId)!.push(row.name)
    }

    const allTracksRes = await query(`
      SELECT 
        t.id, t.title, t.plays, t.duration, t."audioUrl", t."soundcloudLink",
        t.format, t."snippetType", t.bpm, t.key, t."fileSize", t."order", t."userId",
        g.name AS genre_name
      FROM "Track" t
      LEFT JOIN "TrackGenre" tg ON t.id = tg."trackId"
      LEFT JOIN "Genre" g ON tg."genreId" = g.id
      ORDER BY t."order" ASC;
    `)
    const tracksByUser = new Map<string, any[]>()
    for (const t of allTracksRes.rows) {
      if (!tracksByUser.has(t.userId)) tracksByUser.set(t.userId, [])
      tracksByUser.get(t.userId)!.push(t)
    }

    return usersRes.rows.map((u: any) => {
      const userPayload = {
        ...u,
        status: u.status_name || 'Active',
        genres: genresByUser.get(u.id) || [],
        tracks: tracksByUser.get(u.id) || [],
      }
      return formatUserResponse(userPayload)
    })
  }
}

export const authService = new AuthService()

