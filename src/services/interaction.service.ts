import { query, getClient } from '../config/db.js'
import { calculateAffinity } from './affinity.service.js'

export class InteractionService {
  /**
   * Registra un Like y procesa la regla de negocio de Matching recíproco.
   */
  async likeUser(senderId: string, targetUserId: string) {
    if (!senderId) throw new Error('Usuario no autenticado.')
    if (!targetUserId || typeof targetUserId !== 'string') throw new Error('ID de usuario objetivo requerido.')
    if (senderId === targetUserId) throw new Error('No puedes conectar contigo mismo.')

    // Verificar existencia del usuario objetivo
    const targetUserRes = await query(`
      SELECT 
        u.id, u."firstName", u."lastName", u.nickname, u."profileImage", u.role,
        l."formattedAddress" AS location
      FROM "User" u
      LEFT JOIN "Location" l ON u."locationId" = l.id
      WHERE u.id = $1
      LIMIT 1;
    `, [targetUserId])

    if (targetUserRes.rows.length === 0) {
      throw new Error('Usuario objetivo no encontrado.')
    }
    const targetUser = targetUserRes.rows[0]

    // Registrar like del usuario actual (idempotente)
    await query(`
      INSERT INTO "Interaction" (id, "senderId", "receiverId", "isLike", "createdAt")
      VALUES (gen_random_uuid(), $1, $2, true, CURRENT_TIMESTAMP)
      ON CONFLICT ("senderId", "receiverId") DO UPDATE SET "isLike" = true;
    `, [senderId, targetUserId])

    // Determinar orden canónico lexicográfico
    const [u1, u2] = [senderId, targetUserId].sort()

    // Comprobar reciprocidad o existencia previa
    const matchCheck = await query(`
      SELECT id FROM "Match" WHERE "user1Id" = $1 AND "user2Id" = $2 LIMIT 1;
    `, [u1, u2])

    const convCheck = await query(`
      SELECT id FROM "Conversation" WHERE "user1Id" = $1 AND "user2Id" = $2 LIMIT 1;
    `, [u1, u2])

    const targetLikeCheck = await query(`
      SELECT "isLike" FROM "Interaction" WHERE "senderId" = $1 AND "receiverId" = $2 LIMIT 1;
    `, [targetUserId, senderId])

    const hasReciprocalLike = targetLikeCheck.rows.length > 0 && targetLikeCheck.rows[0].isLike === true
    const isMatch = Boolean(matchCheck.rows.length > 0 || convCheck.rows.length > 0 || hasReciprocalLike)

    // Remitente
    const senderRes = await query(`
      SELECT id, "firstName", "lastName", nickname FROM "User" WHERE id = $1 LIMIT 1;
    `, [senderId])
    const senderUser = senderRes.rows[0]
    const senderDisplayName = senderUser?.nickname || `${senderUser?.firstName || ''} ${senderUser?.lastName || ''}`.trim() || 'Un creador'
    const targetDisplayName = targetUser.nickname || `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim()

    if (!isMatch) {
      // Regla de notificación: Crear solicitud si no existe una activa
      const notifExists = await query(`
        SELECT id FROM "Notification"
        WHERE "userId" = $1 AND type = 'match_request' AND message LIKE $2
        LIMIT 1;
      `, [targetUserId, `%${senderDisplayName}%`])

      if (notifExists.rows.length === 0) {
        await query(`
          INSERT INTO "Notification" (id, "userId", title, message, type, "linkPage", "isRead", "createdAt")
          VALUES (gen_random_uuid(), $1, 'Solicitud de Match', $2, 'match_request', 'Discovery', false, CURRENT_TIMESTAMP);
        `, [targetUserId, `${senderDisplayName} quiere conectar y colaborar contigo.`])
      }

      return {
        isMatch: false,
        message: 'Like registrado exitosamente. En espera de conexion mutua.',
      }
    }

    // MATCH MUTUO: Asegurar que ambas direcciones tengan like en la base de datos
    await query(`
      INSERT INTO "Interaction" (id, "senderId", "receiverId", "isLike", "createdAt")
      VALUES (gen_random_uuid(), $1, $2, true, CURRENT_TIMESTAMP)
      ON CONFLICT ("senderId", "receiverId") DO UPDATE SET "isLike" = true;
    `, [targetUserId, senderId])

    // Cargar géneros de ambos usuarios para el cálculo de afinidad
    const [u1Genres, u2Genres] = await Promise.all([
      query(`
        SELECT g.name FROM "ProfileGenre" pg
        JOIN "Genre" g ON pg."genreId" = g.id
        WHERE pg."userId" = $1;
      `, [u1]),
      query(`
        SELECT g.name FROM "ProfileGenre" pg
        JOIN "Genre" g ON pg."genreId" = g.id
        WHERE pg."userId" = $2;
      `, [u2]),
    ])

    const user1Profile = { interestGenres: u1Genres.rows.map((r: any) => r.name) }
    const user2Profile = { interestGenres: u2Genres.rows.map((r: any) => r.name) }
    const affinity = calculateAffinity(user1Profile, user2Profile)

    // Insertar / Actualizar Match canónico
    const matchInsert = await query(`
      INSERT INTO "Match" (id, "user1Id", "user2Id", "affinityPercent", "matchedAt", "createdAt")
      VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("user1Id", "user2Id") DO UPDATE SET "affinityPercent" = EXCLUDED."affinityPercent"
      RETURNING *;
    `, [u1, u2, affinity.percentage])
    const match = matchInsert.rows[0]

    // Insertar / Obtener Conversación canónica
    const convInsert = await query(`
      INSERT INTO "Conversation" (id, "user1Id", "user2Id", pinned, muted, blocked, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, false, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("user1Id", "user2Id") DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP
      RETURNING *;
    `, [u1, u2])
    const conversation = convInsert.rows[0]

    // Notificaciones de sistema para ambos creadores
    await query(`
      INSERT INTO "Notification" (id, "userId", title, message, type, "linkPage", "isRead", "createdAt")
      VALUES 
        (gen_random_uuid(), $1, $2, $3, 'match', 'Messages', false, CURRENT_TIMESTAMP),
        (gen_random_uuid(), $4, $5, $6, 'match', 'Messages', false, CURRENT_TIMESTAMP);
    `, [
      senderId,
      `Nuevo Match con ${targetDisplayName}`,
      `Has conectado con ${targetDisplayName} (${affinity.percentage} afinidad). Pueden conversar en Mensajes.`,
      targetUserId,
      `Nuevo Match con ${senderDisplayName}`,
      `Has conectado con ${senderDisplayName} (${affinity.percentage} afinidad). Pueden conversar en Mensajes.`,
    ])

    return {
      isMatch: true,
      message: 'Es un Match!',
      match: {
        ...match,
        affinityPercent: affinity.percentage,
        commonGenres: affinity.commonGenres,
        summary: affinity.summary,
      },
      conversation: {
        id: conversation.id,
        name: targetDisplayName,
        role: targetUser.role || 'Artista',
        avatar: targetDisplayName.slice(0, 2).toUpperCase(),
        accent: 'purple',
        status: 'Online',
        preview: 'Han conectado. Inicia la conversacion.',
        time: 'Ahora',
        unread: 1,
        profileImage: targetUser.profileImage || '',
        location: targetUser.location || '',
      },
      partner: {
        ...targetUser,
        match: affinity.percentage,
        commonGenres: affinity.commonGenres,
        affinitySummary: affinity.summary,
      },
    }
  }

  /**
   * Registra un descarte de perfil.
   */
  async passUser(senderId: string, targetUserId: string) {
    if (!senderId) throw new Error('Usuario no autenticado.')
    if (!targetUserId || typeof targetUserId !== 'string') throw new Error('ID de usuario objetivo requerido.')

    await query(`
      INSERT INTO "Interaction" (id, "senderId", "receiverId", "isLike", "createdAt")
      VALUES (gen_random_uuid(), $1, $2, false, CURRENT_TIMESTAMP)
      ON CONFLICT ("senderId", "receiverId") DO UPDATE SET "isLike" = false;
    `, [senderId, targetUserId])

    return {
      isMatch: false,
      message: 'Descarte registrado.',
    }
  }

  /**
   * Obtiene la lista de matches confirmados para el usuario actual.
   */
  async getMatches(currentUserId: string) {
    if (!currentUserId) throw new Error('Usuario no autenticado.')

    const sql = `
      SELECT 
        m.id,
        m."user1Id",
        m."user2Id",
        m."affinityPercent",
        m."createdAt",
        u1.id AS u1_id, u1."firstName" AS u1_firstname, u1."lastName" AS u1_lastname, u1.nickname AS u1_nickname, u1."profileImage" AS u1_img, u1.role AS u1_role, l1."formattedAddress" AS u1_loc,
        u2.id AS u2_id, u2."firstName" AS u2_firstname, u2."lastName" AS u2_lastname, u2.nickname AS u2_nickname, u2."profileImage" AS u2_img, u2.role AS u2_role, l2."formattedAddress" AS u2_loc
      FROM "Match" m
      JOIN "User" u1 ON m."user1Id" = u1.id
      LEFT JOIN "Location" l1 ON u1."locationId" = l1.id
      JOIN "User" u2 ON m."user2Id" = u2.id
      LEFT JOIN "Location" l2 ON u2."locationId" = l2.id
      WHERE m."user1Id" = $1 OR m."user2Id" = $1
      ORDER BY m."createdAt" DESC;
    `
    const { rows } = await query(sql, [currentUserId])

    return rows.map((m: any) => {
      const isU1 = m.user1Id === currentUserId
      const partnerId = isU1 ? m.u2_id : m.u1_id
      const partnerName = isU1
        ? m.u2_nickname || `${m.u2_firstname || ''} ${m.u2_lastname || ''}`.trim()
        : m.u1_nickname || `${m.u1_firstname || ''} ${m.u1_lastname || ''}`.trim()
      const partnerRole = isU1 ? m.u2_role : m.u1_role
      const partnerImg = isU1 ? m.u2_img : m.u1_img
      const partnerLoc = isU1 ? m.u2_loc : m.u1_loc

      return {
        id: m.id,
        partnerId,
        name: partnerName,
        role: partnerRole || 'Artista',
        profileImage: partnerImg || '',
        location: partnerLoc || '',
        affinityPercent: m.affinityPercent || '95%',
        createdAt: m.createdAt,
      }
    })
  }

  /**
   * Obtiene las interacciones emitidas y likes entrantes.
   */
  async getUserInteractions(currentUserId: string) {
    if (!currentUserId) {
      return { interactions: [], incomingLikes: [] }
    }

    const [sentRes, receivedRes] = await Promise.all([
      query(`
        SELECT "receiverId", "isLike"
        FROM "Interaction"
        WHERE "senderId" = $1;
      `, [currentUserId]),
      query(`
        SELECT "senderId"
        FROM "Interaction"
        WHERE "receiverId" = $1 AND "isLike" = true;
      `, [currentUserId]),
    ])

    return {
      interactions: sentRes.rows,
      incomingLikes: receivedRes.rows.map((r: any) => r.senderId),
    }
  }

  /**
   * Reinicia únicamente los descartes (passes) para permitir volver a descubrir perfiles.
   */
  async resetInteractions(currentUserId: string) {
    if (!currentUserId) throw new Error('Usuario no autenticado.')

    await query(`
      DELETE FROM "Interaction"
      WHERE "senderId" = $1 AND "isLike" = false;
    `, [currentUserId])

    return {
      message: 'Perfiles descartados reiniciados exitosamente.',
    }
  }

  /**
   * Desconecta dos usuarios (unmatch): elimina mensajes, conversación, match e interacciones.
   */
  async unmatchUser(currentUserId: string, targetUserId: string) {
    if (!currentUserId) throw new Error('Usuario no autenticado.')
    if (!targetUserId) throw new Error('ID de usuario objetivo requerido.')

    const [u1, u2] = [currentUserId, targetUserId].sort()
    const client = await getClient()

    try {
      await client.query('BEGIN')

      // 1. Buscar y eliminar conversación y mensajes
      const convRes = await client.query(`
        SELECT id FROM "Conversation" WHERE "user1Id" = $1 AND "user2Id" = $2 LIMIT 1;
      `, [u1, u2])

      if (convRes.rows.length > 0) {
        const convId = convRes.rows[0].id
        await client.query(`DELETE FROM "Message" WHERE "conversationId" = $1;`, [convId])
        await client.query(`DELETE FROM "Conversation" WHERE id = $1;`, [convId])
      }

      // 2. Eliminar Match
      await client.query(`
        DELETE FROM "Match" WHERE "user1Id" = $1 AND "user2Id" = $2;
      `, [u1, u2])

      // 3. Eliminar Interacciones bidireccionales
      await client.query(`
        DELETE FROM "Interaction" 
        WHERE ("senderId" = $1 AND "receiverId" = $2)
           OR ("senderId" = $2 AND "receiverId" = $1);
      `, [currentUserId, targetUserId])

      // 4. Eliminar notificaciones de match
      await client.query(`
        DELETE FROM "Notification"
        WHERE ("userId" = $1 OR "userId" = $2) AND type = 'match';
      `, [currentUserId, targetUserId])

      await client.query('COMMIT')
      return { message: 'Desconexión realizada exitosamente.' }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
}

export const interactionService = new InteractionService()

