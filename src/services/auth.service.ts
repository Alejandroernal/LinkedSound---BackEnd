import { query, getClient } from '../config/db.js'
import { hashPassword, comparePassword } from '../utils/password.js'
import { generateToken } from '../utils/jwt.js'
import { perfilesService, formatUserResponse } from './perfiles.service.js'

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export { formatUserResponse }

export class AuthService {
  /**
   * Obtiene un usuario por ID delegando al servicio de perfiles.
   */
  async getUserById(userId: string) {
    return perfilesService.getProfileById(userId)
  }

  /**
   * Registro de usuario nuevo con creación de credenciales, roles y perfil inicial.
   */
  async register(data: any) {
    const {
      email,
      password,
      firstName,
      lastName,
      nickname,
      role = 'Artista',
      accountRole = 'Usuario',
      location,
      country,
      province,
      city,
      streetAddress,
      latitude,
      longitude,
      interestGenres = [],
      description,
      soundcloudUrl,
      spotifyUrl,
      profileImage,
      tracks = [],
    } = data

    if (!email || !password || !firstName || !lastName || !nickname) {
      throw new Error('Faltan campos obligatorios para el registro')
    }

    if (password.length < 6) {
      throw new Error('La contrasena debe tener al menos 6 caracteres')
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

    const checkRes = await query(`
      SELECT email, nickname FROM "User"
      WHERE LOWER(email) = LOWER($1) OR LOWER(nickname) = LOWER($2)
      LIMIT 1;
    `, [email.trim(), nickname.trim()])

    if (checkRes.rows.length > 0) {
      const existing = checkRes.rows[0]
      if (existing.email.toLowerCase() === email.trim().toLowerCase()) {
        throw new Error('El correo electronico ya esta registrado')
      }
      if (existing.nickname.toLowerCase() === nickname.trim().toLowerCase()) {
        throw new Error('El nombre de usuario / artistico ya esta en uso')
      }
    }

    const hashedPassword = await hashPassword(password)
    const client = await getClient()

    try {
      await client.query('BEGIN')

      // 1. Crear Location normalizada con geo_point
      const formattedAddress = String(location || [streetAddress, city, province, country].filter(Boolean).join(', ') || 'Sin especificar').trim()
      const latVal = latitude != null && latitude !== '' ? parseFloat(String(latitude)) : null
      const lonVal = longitude != null && longitude !== '' ? parseFloat(String(longitude)) : null

      const locInsert = await client.query(`
        INSERT INTO "Location" (id, "formattedAddress", country, province, city, "streetAddress", geo_point, srid, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          CASE WHEN $6::numeric IS NOT NULL AND $7::numeric IS NOT NULL THEN ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography ELSE NULL END,
          4326, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING id;
      `, [
        formattedAddress,
        country ? String(country).trim() : null,
        province ? String(province).trim() : null,
        city ? String(city).trim() : null,
        streetAddress ? String(streetAddress).trim() : null,
        latVal,
        lonVal,
      ])
      const locationId = locInsert.rows[0].id

      // 2. Obtener statusId 'Active'
      const statusRes = await client.query(`SELECT id FROM "UserStatus" WHERE name = 'Active' LIMIT 1;`)
      const statusId = statusRes.rows.length > 0 ? statusRes.rows[0].id : null

      if (!statusId) {
        throw new Error('Estado inicial de usuario no configurado.')
      }

      // 3. Crear Usuario (sin columnas redundantes role ni status)
      const userInsert = await client.query(`
        INSERT INTO "User" (
          id, email, password, "firstName", "lastName", nickname, "accountRole",
          "profileImage", description, "soundcloudUrl", "spotifyUrl", "locationId", "statusId",
          "reportsCount", "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING id;
      `, [
        email.trim().toLowerCase(),
        hashedPassword,
        firstName.trim(),
        lastName.trim(),
        nickname.trim(),
        ['Usuario', 'Administrador'].includes(accountRole) ? accountRole : 'Usuario',
        profileImage || null,
        description ? description.trim() : null,
        soundcloudUrl ? soundcloudUrl.trim() : null,
        spotifyUrl ? spotifyUrl.trim() : null,
        locationId,
        statusId,
      ])
      const newUser = userInsert.rows[0]

      // 4. Asignar rol en UserRole
      const rolesToAssign = role === 'Productor y Artista' ? ['Productor', 'Artista'] : [role || 'Artista']
      for (const rName of rolesToAssign) {
        const roleRes = await client.query(`SELECT id FROM "Role" WHERE name = $1 LIMIT 1;`, [rName])
        if (roleRes.rows.length > 0) {
          await client.query(`
            INSERT INTO "UserRole" ("userId", "roleId", "assignedAt")
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING;
          `, [newUser.id, roleRes.rows[0].id])
        }
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
            newUser.id,
          ])
        }
      }

      await client.query('COMMIT')

      const fullUser = await perfilesService.getProfileById(newUser.id)
      const token = generateToken({
        userId: newUser.id,
        email: email.trim().toLowerCase(),
        role: role || 'Artista',
        accountRole: accountRole || 'Usuario',
      })

      return {
        token,
        user: fullUser,
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
      SELECT 
        u.id, u.email, u.password, u."accountRole",
        COALESCE(
          (SELECT r.name FROM "UserRole" ur JOIN "Role" r ON ur."roleId" = r.id WHERE ur."userId" = u.id LIMIT 1),
          'Artista'
        ) AS role
      FROM "User" u
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1;
    `, [email.trim()])

    if (userRes.rows.length === 0) {
      const err = new Error('Credenciales invalidas (correo o contrasena incorrectos)')
      ;(err as any).statusCode = 401
      throw err
    }

    const user = userRes.rows[0]
    const isMatch = await comparePassword(pass, user.password)
    if (!isMatch) {
      const err = new Error('Credenciales invalidas (correo o contrasena incorrectos)')
      ;(err as any).statusCode = 401
      throw err
    }

    const fullUser = await perfilesService.getProfileById(user.id)
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role || 'Artista',
      accountRole: user.accountRole || 'Usuario',
    })

    return {
      token,
      user: fullUser,
    }
  }

  async updateProfile(userId: string, data: any) {
    return perfilesService.updateProfile(userId, data)
  }

  async getGenres(): Promise<string[]> {
    return perfilesService.getGenres()
  }

  async getUsers(currentUserId?: string, currentUserRole?: string, includeAll?: boolean) {
    return perfilesService.getUsers(currentUserId, currentUserRole, includeAll)
  }
}

export const authService = new AuthService()
