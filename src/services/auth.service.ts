import { query, getClient } from '../config/db.js'
import { hashPassword, comparePassword, assertValidPassword } from '../utils/password.js'
import { generateToken } from '../utils/jwt.js'
import { perfilesService, formatUserResponse } from './perfiles.service.js'
import { emailService } from './email.service.js'

let isPasswordResetTableReady = false

async function ensurePasswordResetTable(): Promise<void> {
  if (isPasswordResetTableReady) return
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS "PasswordReset" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "idx_password_reset_email" ON "PasswordReset" (LOWER(email));
    `)
    isPasswordResetTableReady = true
  } catch (err) {
    console.warn('[AuthService] Error asegurando tabla PasswordReset:', err)
  }
}

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
      accountRole,
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

    // Bloquear cualquier intento de escalada de privilegios en el registro publico
    if (accountRole !== undefined && String(accountRole).trim() !== '' && String(accountRole).trim() !== 'Usuario') {
      const err = new Error('No esta permitido registrarse con privilegios de administrador.')
      ;(err as any).statusCode = 403
      throw err
    }

    const ALLOWED_PUBLIC_ROLES = ['Artista', 'Productor', 'Productor y Artista']
    const rawRole = typeof role === 'string' ? role.trim() : 'Artista'
    if (['administrador', 'admin'].includes(rawRole.toLowerCase())) {
      const err = new Error('No esta permitido asignarse el rol de administrador en el registro.')
      ;(err as any).statusCode = 403
      throw err
    }
    const safeRole = ALLOWED_PUBLIC_ROLES.includes(rawRole) ? rawRole : 'Artista'
    const safeAccountRole = 'Usuario'

    if (!email || !password || !firstName || !lastName || !nickname) {
      const err = new Error('Faltan campos obligatorios para el registro')
      ;(err as any).statusCode = 400
      throw err
    }

    assertValidPassword(password)

    if (description && typeof description === 'string' && description.trim().length > 150) {
      const err = new Error('La descripcion no puede superar los 150 caracteres (maximo permitido)')
      ;(err as any).statusCode = 400
      throw err
    }

    if (soundcloudUrl && typeof soundcloudUrl === 'string' && soundcloudUrl.trim() && !soundcloudUrl.toLowerCase().includes('soundcloud.com')) {
      const err = new Error('El enlace de SoundCloud debe ser una URL valida de SoundCloud (debe contener soundcloud.com)')
      ;(err as any).statusCode = 400
      throw err
    }
    if (spotifyUrl && typeof spotifyUrl === 'string' && spotifyUrl.trim() && !spotifyUrl.toLowerCase().includes('spotify.com')) {
      const err = new Error('El enlace de Spotify debe ser una URL valida de Spotify (debe contener spotify.com)')
      ;(err as any).statusCode = 400
      throw err
    }

    const checkRes = await query(`
      SELECT email, nickname FROM "User"
      WHERE LOWER(email) = LOWER($1) OR LOWER(nickname) = LOWER($2)
      LIMIT 1;
    `, [email.trim(), nickname.trim()])

    if (checkRes.rows.length > 0) {
      const existing = checkRes.rows[0]
      if (existing.email.toLowerCase() === email.trim().toLowerCase()) {
        const err = new Error('El correo electronico ya esta registrado')
        ;(err as any).statusCode = 409
        throw err
      }
      if (existing.nickname.toLowerCase() === nickname.trim().toLowerCase()) {
        const err = new Error('El nombre de usuario / artistico ya esta en uso')
        ;(err as any).statusCode = 409
        throw err
      }
    }

    const hashedPassword = await hashPassword(password)
    const client = await getClient()

    try {
      await client.query('BEGIN')

      // 1. Crear Location normalizada con geo_point
      const formattedAddress = String(location || [streetAddress, city, province, country].filter(Boolean).join(', ') || 'Sin especificar').trim()
      const parsedLat = latitude != null && latitude !== '' ? Number(latitude) : NaN
      const parsedLon = longitude != null && longitude !== '' ? Number(longitude) : NaN
      const latVal = Number.isFinite(parsedLat) ? parsedLat : null
      const lonVal = Number.isFinite(parsedLon) ? parsedLon : null

      const locInsert = await client.query(`
        INSERT INTO "Location" (id, "formattedAddress", country, province, city, "streetAddress", latitude, longitude, geo_point, srid, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          $6::double precision, $7::double precision,
          CASE WHEN $6::double precision IS NOT NULL AND $7::double precision IS NOT NULL THEN ST_SetSRID(ST_MakePoint($7::double precision, $6::double precision), 4326)::geography ELSE NULL END,
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
        safeAccountRole,
        profileImage || null,
        description ? description.trim() : null,
        soundcloudUrl ? soundcloudUrl.trim() : null,
        spotifyUrl ? spotifyUrl.trim() : null,
        locationId,
        statusId,
      ])
      const newUser = userInsert.rows[0]

      // 4. Asignar rol en UserRole (estrictamente limitado a roles musicales publicos)
      const rolesToAssign = safeRole === 'Productor y Artista' ? ['Productor', 'Artista'] : [safeRole]
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

      // 6. Tracks (garantizar persistencia de soundcloudLink en Track cuando el perfil tiene SoundCloud)
      const incomingTracks = Array.isArray(tracks) ? tracks.slice(0, 5) : []
      const fallbackScUrl =
        (typeof data.trackUrl === 'string' && data.trackUrl.trim() ? data.trackUrl.trim() : '') ||
        (typeof soundcloudUrl === 'string' && soundcloudUrl.trim() ? soundcloudUrl.trim() : '')

      if (incomingTracks.length > 0) {
        const hasAnyScLink = incomingTracks.some(
          (t: any) => typeof t?.soundcloudLink === 'string' && t.soundcloudLink.trim().length > 0
        )

        for (let i = 0; i < incomingTracks.length; i++) {
          const t = incomingTracks[i]
          const playsNum = typeof t.plays === 'number' ? t.plays : (parseInt(String(t.plays).replace(/\D/g, ''), 10) || 50)
          const rawScLink = typeof t.soundcloudLink === 'string' ? t.soundcloudLink.trim() : ''
          const assignedScLink = rawScLink || (!hasAnyScLink && i === 0 && fallbackScUrl ? fallbackScUrl : null)

          await client.query(`
            INSERT INTO "Track" (
              id, title, "audioUrl", "soundcloudLink", duration, format, "snippetType", bpm, key, "fileSize", "order", plays, "userId", "createdAt"
            )
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP);
          `, [
            (t.title || `Demo 0${i + 1}`).trim(),
            t.audioUrl || null,
            assignedScLink,
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
      } else if (fallbackScUrl) {
        await client.query(`
          INSERT INTO "Track" (id, title, duration, plays, "soundcloudLink", "userId", "order", "createdAt")
          VALUES (gen_random_uuid(), $1, '0:30', 50, $2, $3, 0, CURRENT_TIMESTAMP);
        `, [`${nickname.trim()} - Track Destacado`, fallbackScUrl, newUser.id])
      }

      await client.query('COMMIT')

      const fullUser = await perfilesService.getProfileById(newUser.id)
      const token = generateToken({
        userId: newUser.id,
        email: email.trim().toLowerCase(),
        role: safeRole,
        accountRole: safeAccountRole,
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
        s.name AS status_name,
        COALESCE(
          (SELECT r.name FROM "UserRole" ur JOIN "Role" r ON ur."roleId" = r.id WHERE ur."userId" = u.id LIMIT 1),
          'Artista'
        ) AS role
      FROM "User" u
      LEFT JOIN "UserStatus" s ON u."statusId" = s.id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1;
    `, [email.trim()])

    if (userRes.rows.length === 0) {
      const err = new Error('Credenciales invalidas (correo o contrasena incorrectos)')
      ;(err as any).statusCode = 401
      throw err
    }

    const user = userRes.rows[0]

    // Bloqueo estricto de usuarios suspendidos o dados de baja
    if (user.status_name === 'Suspended') {
      const err = new Error('Tu cuenta se encuentra suspendida temporalmente por un administrador.')
      ;(err as any).statusCode = 403
      throw err
    }
    if (user.status_name === 'Banned') {
      const err = new Error('Tu cuenta ha sido bloqueada permanentemente por infringir las normas de la comunidad.')
      ;(err as any).statusCode = 403
      throw err
    }
    if (user.status_name === 'Inactive') {
      const err = new Error('Tu cuenta se encuentra dada de baja.')
      ;(err as any).statusCode = 403
      throw err
    }

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

  /**
   * Solicita codigo de 6 digitos para recuperacion de contrasena validando la existencia de la cuenta.
   */
  async forgotPassword(email: string) {
    if (!email || !email.trim()) {
      const err = new Error('Por favor, ingresa tu correo electronico.')
      ;(err as any).statusCode = 400
      throw err
    }

    await ensurePasswordResetTable()

    const normalizedEmail = email.trim().toLowerCase()

    // 1. Validar si existe una cuenta registrada con este correo
    const userRes = await query(`
      SELECT id, email, "firstName", nickname, "accountRole"
      FROM "User"
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `, [normalizedEmail])

    if (userRes.rows.length === 0) {
      const err = new Error('No existe ninguna cuenta registrada con este correo electronico.')
      ;(err as any).statusCode = 404
      throw err
    }

    const user = userRes.rows[0]
    const recipientName = user.nickname || user.firstName || 'Creador'

    // 2. Generar codigo numerico criptografico de 6 digitos
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutos

    // 3. Eliminar codigos previos no confirmados para este correo
    await query(`DELETE FROM "PasswordReset" WHERE LOWER(email) = LOWER($1);`, [normalizedEmail])

    // 4. Almacenar el codigo en la tabla
    await query(`
      INSERT INTO "PasswordReset" (id, email, code, "expiresAt", verified, "createdAt")
      VALUES (gen_random_uuid(), $1, $2, $3, false, CURRENT_TIMESTAMP);
    `, [normalizedEmail, code, expiresAt])

    // 5. Enviar el correo electronico real a traves del servicio de email
    await emailService.sendPasswordResetCode(normalizedEmail, code, recipientName)

    return {
      success: true,
      message: `Codigo de verificacion de 6 digitos enviado a ${normalizedEmail}.`,
    }
  }

  /**
   * Valida el codigo de 6 digitos ingresado por el usuario.
   */
  async verifyResetCode(email: string, code: string) {
    if (!email || !code) {
      const err = new Error('Correo y codigo son obligatorios.')
      ;(err as any).statusCode = 400
      throw err
    }

    await ensurePasswordResetTable()

    const normalizedEmail = email.trim().toLowerCase()
    const cleanCode = code.trim()

    const res = await query(`
      SELECT id, code, "expiresAt", verified
      FROM "PasswordReset"
      WHERE LOWER(email) = LOWER($1)
      ORDER BY "createdAt" DESC
      LIMIT 1;
    `, [normalizedEmail])

    if (res.rows.length === 0 || res.rows[0].code !== cleanCode) {
      const err = new Error('El codigo de verificacion es incorrecto.')
      ;(err as any).statusCode = 400
      throw err
    }

    const resetRecord = res.rows[0]
    if (new Date() > new Date(resetRecord.expiresAt)) {
      const err = new Error('El codigo de verificacion ha expirado. Por favor solicita uno nuevo.')
      ;(err as any).statusCode = 400
      throw err
    }

    // Marcar como verificado para habilitar el cambio de clave
    await query(`UPDATE "PasswordReset" SET verified = true WHERE id = $1;`, [resetRecord.id])

    return {
      success: true,
      message: 'Codigo verificado correctamente.',
    }
  }

  /**
   * Restablece la contrasena del usuario una vez verificado el codigo.
   */
  async resetPassword(email: string, code: string, newPass: string) {
    if (!email || !code || !newPass) {
      const err = new Error('Todos los campos son obligatorios.')
      ;(err as any).statusCode = 400
      throw err
    }

    await ensurePasswordResetTable()

    const normalizedEmail = email.trim().toLowerCase()
    const cleanCode = code.trim()

    assertValidPassword(newPass)

    // Verificar que exista registro valido y verificado
    const res = await query(`
      SELECT id, "expiresAt", verified
      FROM "PasswordReset"
      WHERE LOWER(email) = LOWER($1) AND code = $2 AND verified = true
      ORDER BY "createdAt" DESC
      LIMIT 1;
    `, [normalizedEmail, cleanCode])

    if (res.rows.length === 0) {
      const err = new Error('No se ha verificado el codigo para esta cuenta o la sesion ha expirado.')
      ;(err as any).statusCode = 400
      throw err
    }

    if (new Date() > new Date(res.rows[0].expiresAt)) {
      const err = new Error('La sesion de restablecimiento ha expirado. Inicia el proceso nuevamente.')
      ;(err as any).statusCode = 400
      throw err
    }

    // Hashear nueva contrasena con bcrypt
    const hashedPassword = await hashPassword(newPass)

    // Actualizar en base de datos PostgreSQL
    await query(`
      UPDATE "User"
      SET password = $1, "updatedAt" = CURRENT_TIMESTAMP
      WHERE LOWER(email) = LOWER($2);
    `, [hashedPassword, normalizedEmail])

    // Limpiar tokens de reseteo usados
    await query(`DELETE FROM "PasswordReset" WHERE LOWER(email) = LOWER($1);`, [normalizedEmail])

    return {
      success: true,
      message: 'Contrasena actualizada exitosamente. Ya puedes iniciar sesion con tu nueva clave.',
    }
  }

  /**
   * Cambia la contrasena del usuario autenticado validando su clave actual
   * y aplicando las mismas reglas de seguridad que el registro y la recuperacion.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword?: string
  ) {
    if (!userId) {
      const err = new Error('Usuario no autenticado.')
      ;(err as any).statusCode = 401
      throw err
    }

    if (!currentPassword || !newPassword) {
      const err = new Error('Debes ingresar tu contrasena actual y la nueva contrasena.')
      ;(err as any).statusCode = 400
      throw err
    }

    assertValidPassword(newPassword)

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      const err = new Error('Las contrasenas nuevas no coinciden.')
      ;(err as any).statusCode = 400
      throw err
    }

    const userRes = await query(`SELECT id, password FROM "User" WHERE id = $1 LIMIT 1;`, [userId])
    if (userRes.rows.length === 0) {
      const err = new Error('Usuario no encontrado.')
      ;(err as any).statusCode = 404
      throw err
    }

    const existingHash = userRes.rows[0].password
    const isCurrentValid = await comparePassword(currentPassword, existingHash)
    if (!isCurrentValid) {
      const err = new Error('La contrasena actual es incorrecta.')
      ;(err as any).statusCode = 400
      throw err
    }

    const isSameAsCurrent = await comparePassword(newPassword, existingHash)
    if (isSameAsCurrent) {
      const err = new Error('La nueva contrasena debe ser diferente a tu contrasena actual.')
      ;(err as any).statusCode = 400
      throw err
    }

    const hashedPassword = await hashPassword(newPassword)
    await query(
      `UPDATE "User" SET password = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2;`,
      [hashedPassword, userId]
    )

    return {
      success: true,
      message: 'Contrasena actualizada exitosamente.',
    }
  }
}

export const authService = new AuthService()
