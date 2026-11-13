import { query, getClient } from '../config/db.js'
import type {
  AffinityResult,
  ProximityResult,
  UserMatchProfile,
} from '../models/match.model.js'

export type { AffinityResult, ProximityResult, UserMatchProfile }

/**
 * Calcula el porcentaje ponderado de afinidad musical entre dos usuarios
 * basándose en géneros en común y complementariedad de roles.
 */
export function calculateAffinity(
  userA: { role?: string; interestGenres?: string[] },
  userB: { role?: string; interestGenres?: string[] }
): AffinityResult {
  const genresA = (userA.interestGenres || []).map((g) => g.toLowerCase().trim())
  const genresB = (userB.interestGenres || []).map((g) => g.toLowerCase().trim())

  const commonGenresSet = new Set<string>()
  for (const ga of genresA) {
    if (genresB.some((gb) => gb === ga || gb.includes(ga) || ga.includes(gb))) {
      const original = (userA.interestGenres || []).find((orig) => orig.toLowerCase().trim() === ga) || ga
      commonGenresSet.add(original)
    }
  }
  const commonGenres = Array.from(commonGenresSet)

  let baseScore = 60

  if (commonGenres.length > 0) {
    baseScore += Math.min(30, commonGenres.length * 10)
  }

  const roleA = (userA.role || '').toLowerCase()
  const roleB = (userB.role || '').toLowerCase()

  if (
    (roleA.includes('productor') && roleB.includes('artista')) ||
    (roleA.includes('artista') && roleB.includes('productor')) ||
    (roleA.includes('ambos') || roleB.includes('ambos'))
  ) {
    baseScore += 15
  } else if (roleA && roleB && roleA === roleB) {
    baseScore += 8
  }

  const finalScore = Math.min(99, Math.max(55, Math.round(baseScore)))
  const percentage = `${finalScore}%`

  const reasons: string[] = []
  if (commonGenres.length > 0) {
    reasons.push(`Generos afines: ${commonGenres.slice(0, 3).join(', ')}`)
  }

  let summary = 'Afinidad en estilos y colaboraciones musicales.'
  if (commonGenres.length > 0) {
    summary = `Comparten interes en ${commonGenres.slice(0, 2).join(' y ')}.`
  }

  return {
    score: finalScore,
    percentage,
    commonGenres,
    reasons,
    summary,
  }
}

/**
 * Calcula la proximidad geográfica en kilómetros entre dos coordenadas
 * usando la fórmula geodésica de Haversine.
 */
export function calculateProximity(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null
): ProximityResult {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return {
      distanceKm: -1,
      isNearby: false,
      formattedDistance: 'Distancia no disponible',
    }
  }

  const R = 6371 // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distanceKm = Math.round(R * c * 10) / 10

  const isNearby = distanceKm <= 50
  const formattedDistance =
    distanceKm < 1 ? 'A menos de 1 km' : `A aprox. ${distanceKm} km`

  return {
    distanceKm,
    isNearby,
    formattedDistance,
  }
}

export class MatchService {
  /**
   * Registra un Like y procesa la regla de negocio de Matching recíproco.
   */
  async likeUser(senderId: string, targetUserId: string) {
    if (!senderId) throw new Error('Usuario no autenticado.')
    if (!targetUserId || typeof targetUserId !== 'string') throw new Error('ID de usuario objetivo requerido.')
    if (senderId === targetUserId) throw new Error('No puedes conectar contigo mismo.')

    const targetUserRes = await query(`
      SELECT 
        u.id, u."firstName", u."lastName", u.nickname, u."profileImage",
        COALESCE(
          (SELECT r.name FROM "UserRole" ur JOIN "Role" r ON ur."roleId" = r.id WHERE ur."userId" = u.id LIMIT 1),
          'Artista'
        ) AS role,
        l."formattedAddress" AS location,
        ST_Y(l.geo_point::geometry) AS latitude,
        ST_X(l.geo_point::geometry) AS longitude
      FROM "User" u
      LEFT JOIN "Location" l ON u."locationId" = l.id
      WHERE u.id = $1
      LIMIT 1;
    `, [targetUserId])

    if (targetUserRes.rows.length === 0) {
      throw new Error('Usuario objetivo no encontrado.')
    }
    const targetUser = targetUserRes.rows[0]

    await query(`
      INSERT INTO "Interaction" (id, "senderId", "receiverId", "isLike", "createdAt")
      VALUES (gen_random_uuid(), $1, $2, true, CURRENT_TIMESTAMP)
      ON CONFLICT ("senderId", "receiverId") DO UPDATE SET "isLike" = true;
    `, [senderId, targetUserId])

    const [u1, u2] = [senderId, targetUserId].sort()

    const matchCheck = await query(`
      SELECT id FROM "Match" WHERE "user1Id" = $1 AND "user2Id" = $2 LIMIT 1;
    `, [u1, u2])

    const convCheck = await query(`
      SELECT id FROM "Conversation" WHERE "user1Id" = $1 AND "user2Id" = $2 LIMIT 1;
    `, [u1, u2])

    const targetLikeCheck = await query(`
      SELECT "isLike" FROM "Interaction" WHERE "senderId" = $1 AND "receiverId" = $2 LIMIT 1;
    `, [targetUserId, senderId])

    const targetNotifCheck = await query(`
      SELECT id FROM "Notification"
      WHERE "userId" = $1 AND type = 'match_request' AND (
        message ILIKE $2 OR message ILIKE $3
      )
      LIMIT 1;
    `, [senderId, `%${targetUser.nickname || ''}%`, `%${targetUser.firstName || ''}%`])

    const hasReciprocalLike =
      (targetLikeCheck.rows.length > 0 && targetLikeCheck.rows[0].isLike === true) ||
      targetNotifCheck.rows.length > 0
    const isMatch = Boolean(matchCheck.rows.length > 0 || convCheck.rows.length > 0 || hasReciprocalLike)

    const senderRes = await query(`
      SELECT 
        u.id, u."firstName", u."lastName", u.nickname,
        COALESCE(
          (SELECT r.name FROM "UserRole" ur JOIN "Role" r ON ur."roleId" = r.id WHERE ur."userId" = u.id LIMIT 1),
          'Artista'
        ) AS role,
        ST_Y(l.geo_point::geometry) AS latitude,
        ST_X(l.geo_point::geometry) AS longitude
      FROM "User" u
      LEFT JOIN "Location" l ON u."locationId" = l.id
      WHERE u.id = $1 LIMIT 1;
    `, [senderId])
    const senderUser = senderRes.rows[0]
    const senderDisplayName = senderUser?.nickname || `${senderUser?.firstName || ''} ${senderUser?.lastName || ''}`.trim() || 'Un creador'

    if (!isMatch) {
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

    // MATCH MUTUO - Asegurar ambas interacciones con isLike = true
    await query(`
      INSERT INTO "Interaction" (id, "senderId", "receiverId", "isLike", "createdAt")
      VALUES (gen_random_uuid(), $1, $2, true, CURRENT_TIMESTAMP)
      ON CONFLICT ("senderId", "receiverId") DO UPDATE SET "isLike" = true;
    `, [targetUserId, senderId])

    await query(`
      INSERT INTO "Interaction" (id, "senderId", "receiverId", "isLike", "createdAt")
      VALUES (gen_random_uuid(), $1, $2, true, CURRENT_TIMESTAMP)
      ON CONFLICT ("senderId", "receiverId") DO UPDATE SET "isLike" = true;
    `, [senderId, targetUserId])

    const [u1Genres, u2Genres] = await Promise.all([
      query(`
        SELECT g.name FROM "ProfileGenre" pg
        JOIN "Genre" g ON pg."genreId" = g.id
        WHERE pg."userId" = $1;
      `, [u1]),
      query(`
        SELECT g.name FROM "ProfileGenre" pg
        JOIN "Genre" g ON pg."genreId" = g.id
        WHERE pg."userId" = $1;
      `, [u2]),
    ])

    const affinity = calculateAffinity(
      { role: senderUser?.role, interestGenres: (senderId === u1 ? u1Genres : u2Genres).rows.map((r: any) => r.name) },
      { role: targetUser.role, interestGenres: (senderId === u1 ? u2Genres : u1Genres).rows.map((r: any) => r.name) }
    )

    const proximity = calculateProximity(
      senderUser?.latitude,
      senderUser?.longitude,
      targetUser.latitude,
      targetUser.longitude
    )

    let matchRecord: any = null
    if (matchCheck.rows.length > 0) {
      matchRecord = matchCheck.rows[0]
      await query(`
        UPDATE "Match"
        SET "affinityPercent" = $1, "matchedAt" = CURRENT_TIMESTAMP
        WHERE id = $2;
      `, [affinity.percentage, matchRecord.id])
    } else {
      const matchInsert = await query(`
        INSERT INTO "Match" (id, "user1Id", "user2Id", "affinityPercent", "matchedAt", "createdAt")
        VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, "user1Id", "user2Id", "affinityPercent", "matchedAt";
      `, [u1, u2, affinity.percentage])
      matchRecord = matchInsert.rows[0]
    }

    let convRecord: any = null
    if (convCheck.rows.length > 0) {
      convRecord = convCheck.rows[0]
    } else {
      const convInsert = await query(`
        INSERT INTO "Conversation" (id, "user1Id", "user2Id", pinned, muted, blocked, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, $2, false, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id;
      `, [u1, u2])
      convRecord = convInsert.rows[0]
    }

    const partnerTracksRes = await query(`
      SELECT id, title, duration, "audioUrl", "soundcloudLink", "snippetType", bpm, key
      FROM "Track"
      WHERE "userId" = $1
      ORDER BY "order" ASC
      LIMIT 3;
    `, [targetUserId])

    const partnerPayload = {
      id: targetUser.id,
      name: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || targetUser.nickname,
      nickname: targetUser.nickname,
      role: targetUser.role || 'Artista',
      location: targetUser.location || 'LinkedSound Network',
      avatar: targetUser.profileImage || '',
      match: affinity.percentage,
      tags: (senderId === u1 ? u2Genres : u1Genres).rows.map((r: any) => r.name),
      tracks: partnerTracksRes.rows,
      proximity: proximity.formattedDistance,
    }

    // Limpiar solicitudes pendientes de match entre ambos usuarios
    await query(`
      DELETE FROM "Notification"
      WHERE ("userId" = $1 AND type = 'match_request' AND (message ILIKE $2 OR message ILIKE $3))
         OR ("userId" = $4 AND type = 'match_request' AND (message ILIKE $5 OR message ILIKE $6));
    `, [
      senderId, `%${targetUser.nickname || ''}%`, `%${targetUser.firstName || ''}%`,
      targetUserId, `%${senderDisplayName}%`, `%${senderUser?.firstName || ''}%`
    ])

    // Crear notificaciones de Match Mutuo para ambos usuarios en PostgreSQL
    await Promise.all([
      query(`
        INSERT INTO "Notification" (id, "userId", title, message, type, "linkPage", "isRead", "createdAt")
        VALUES (gen_random_uuid(), $1, $2, $3, 'match', 'Messages', false, CURRENT_TIMESTAMP);
      `, [
        senderId,
        `Nuevo Match con ${partnerPayload.nickname || partnerPayload.name}`,
        `${partnerPayload.nickname || partnerPayload.name} y tu han conectado. Ya pueden colaborar en Mensajes.`
      ]),
      query(`
        INSERT INTO "Notification" (id, "userId", title, message, type, "linkPage", "isRead", "createdAt")
        VALUES (gen_random_uuid(), $1, $2, $3, 'match', 'Messages', false, CURRENT_TIMESTAMP);
      `, [
        targetUserId,
        `Nuevo Match con ${senderDisplayName}`,
        `${senderDisplayName} y tu han conectado. Ya pueden colaborar en Mensajes.`
      ])
    ])

    const conversationPayload = {
      id: convRecord.id,
      name: partnerPayload.nickname || partnerPayload.name,
      role: partnerPayload.role,
      avatar: partnerPayload.avatar ? '' : (partnerPayload.nickname ? partnerPayload.nickname.slice(0, 2).toUpperCase() : 'LS'),
      profileImage: partnerPayload.avatar,
      accent: 'purple',
      status: 'Offline',
      preview: 'Nuevo Match. Comiencen una conversacion.',
      time: 'Justo ahora',
      unread: 0,
      location: partnerPayload.location,
    }

    return {
      isMatch: true,
      match: matchRecord,
      conversation: conversationPayload,
      partner: partnerPayload,
      affinity,
      proximity,
      message: 'Es un Match. Ya pueden chatear y colaborar.',
    }
  }

  /**
   * Registra un Pase (isLike: false).
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
      message: 'Pase registrado correctamente.',
    }
  }

  /**
   * Deshace un Match y remueve la conversación asociada.
   */
  async unmatch(senderId: string, targetUserId: string) {
    if (!senderId) throw new Error('Usuario no autenticado.')
    if (!targetUserId) throw new Error('ID de usuario requerido.')

    const [u1, u2] = [senderId, targetUserId].sort()

    const client = await getClient()
    try {
      await client.query('BEGIN')

      await client.query(`
        DELETE FROM "Conversation"
        WHERE "user1Id" = $1 AND "user2Id" = $2;
      `, [u1, u2])

      await client.query(`
        DELETE FROM "Match"
        WHERE "user1Id" = $1 AND "user2Id" = $2;
      `, [u1, u2])

      await client.query(`
        DELETE FROM "Interaction"
        WHERE ("senderId" = $1 AND "receiverId" = $2)
           OR ("senderId" = $2 AND "receiverId" = $1);
      `, [senderId, targetUserId])

      await client.query('COMMIT')
      return { success: true, message: 'Match y conversacion eliminados correctamente.' }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * Obtiene la lista de todos los Matches del usuario autenticado.
   */
  async getMatches(userId: string) {
    if (!userId) throw new Error('Usuario no autenticado.')

    const sql = `
      SELECT 
        m.id, m."affinityPercent", m."matchedAt", m."createdAt",
        CASE WHEN m."user1Id" = $1 THEN m."user2Id" ELSE m."user1Id" END AS partner_id
      FROM "Match" m
      WHERE m."user1Id" = $1 OR m."user2Id" = $1
      ORDER BY m."matchedAt" DESC;
    `
    const matchesRes = await query(sql, [userId])
    const partnerIds = matchesRes.rows.map((r: any) => r.partner_id)

    if (partnerIds.length === 0) {
      return []
    }

    const partnersRes = await query(`
      SELECT 
        u.id, u."firstName", u."lastName", u.nickname, u."profileImage",
        COALESCE(
          (SELECT r.name FROM "UserRole" ur JOIN "Role" r ON ur."roleId" = r.id WHERE ur."userId" = u.id LIMIT 1),
          'Artista'
        ) AS role,
        l."formattedAddress" AS location
      FROM "User" u
      LEFT JOIN "Location" l ON u."locationId" = l.id
      WHERE u.id = ANY($1::uuid[]);
    `, [partnerIds])

    const partnerMap = new Map<string, any>()
    for (const p of partnersRes.rows) {
      partnerMap.set(p.id, p)
    }

    return matchesRes.rows.map((m: any) => {
      const p = partnerMap.get(m.partner_id) || {}
      return {
        id: m.id,
        partnerId: m.partner_id,
        name: `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.nickname || 'Creador',
        nickname: p.nickname || 'Creador',
        role: p.role || 'Artista',
        location: p.location || 'LinkedSound Network',
        avatar: p.profileImage || '',
        affinity: m.affinityPercent || '90%',
        matchedAt: m.matchedAt,
      }
    })
  }

  /**
   * Obtiene el estado de interacciones salientes y entrantes del usuario.
   */
  async getUserInteractions(userId: string) {
    if (!userId) throw new Error('Usuario no autenticado.')

    const [outRes, inRes, notifRes, allUsersRes] = await Promise.all([
      query(`SELECT "receiverId", "isLike" FROM "Interaction" WHERE "senderId" = $1;`, [userId]),
      query(`SELECT "senderId" FROM "Interaction" WHERE "receiverId" = $1 AND "isLike" = true;`, [userId]),
      query(`SELECT message FROM "Notification" WHERE "userId" = $1 AND type = 'match_request';`, [userId]),
      query(`SELECT id, nickname, "firstName" FROM "User";`),
    ])

    const incomingLikesSet = new Set<string>(inRes.rows.map((r: any) => r.senderId))

    // Incluir remitentes de solicitudes de match pendientes en notificaciones
    for (const notif of notifRes.rows) {
      const msg = notif.message || ''
      for (const u of allUsersRes.rows) {
        if ((u.nickname && msg.includes(u.nickname)) || (u.firstName && msg.includes(u.firstName))) {
          incomingLikesSet.add(u.id)
        }
      }
    }

    return {
      interactions: outRes.rows.map((r: any) => ({
        receiverId: r.receiverId,
        isLike: r.isLike,
      })),
      incomingLikes: Array.from(incomingLikesSet),
    }
  }

  /**
   * Resetea interacciones del usuario (para pruebas de desarrollo).
   */
  async resetInteractions(userId: string) {
    if (!userId) throw new Error('Usuario no autenticado.')

    await query(`
      DELETE FROM "Interaction"
      WHERE "senderId" = $1 OR "receiverId" = $1;
    `, [userId])

    return { success: true, message: 'Interacciones reseteadas exitosamente.' }
  }
}

export const matchService = new MatchService()
export const interactionService = matchService
