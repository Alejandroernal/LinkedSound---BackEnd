import { query, getClient } from '../config/db.js'
import { fcmService } from './fcm.service.js'
import type {
  AffinityResult,
  ProximityResult,
  UserMatchProfile,
} from '../models/match.model.js'

export type { AffinityResult, ProximityResult, UserMatchProfile }

/**
 * Calcula el porcentaje ponderado de afinidad musical entre dos usuarios
 * implementando el Coeficiente de Similitud de Jaccard sobre generos musicales:
 *   J(A, B) = |A ∩ B| / |A ∪ B|
 * e integrando la complementariedad de roles y la proximidad geografica calculada.
 */
export function calculateAffinity(
  userA: { role?: string; interestGenres?: string[] },
  userB: { role?: string; interestGenres?: string[] },
  distanceKm?: number | null
): AffinityResult {
  const rawA = userA.interestGenres || []
  const rawB = userB.interestGenres || []

  // Normalizar generos a minusculas
  const setA = new Set(rawA.map((g) => g.toLowerCase().trim()).filter(Boolean))
  const setB = new Set(rawB.map((g) => g.toLowerCase().trim()).filter(Boolean))

  // Calcular Interseccion y Union
  const intersection = new Set<string>()
  for (const itemA of setA) {
    if (setB.has(itemA)) {
      intersection.add(itemA)
    }
  }

  const union = new Set<string>([...setA, ...setB])

  // Coeficiente de Jaccard J(A, B) = |A ∩ B| / |A ∪ B|
  const jaccard = union.size > 0 ? intersection.size / union.size : 0.5

  // Mapear nombres legibles de generos en comun
  const commonGenres: string[] = []
  for (const ga of intersection) {
    const original =
      rawA.find((orig) => orig.toLowerCase().trim() === ga) ||
      rawB.find((orig) => orig.toLowerCase().trim() === ga) ||
      ga
    commonGenres.push(original)
  }

  // Ponderacion de afinidad
  // 1. Componente de Generos via Coeficiente de Jaccard (hasta 50 puntos)
  const genreScore = Math.round(jaccard * 50)

  // 2. Componente de Roles (hasta 15 puntos)
  let roleBonus = 5
  const roleA = (userA.role || '').toLowerCase()
  const roleB = (userB.role || '').toLowerCase()
  if (
    (roleA.includes('productor') && roleB.includes('artista')) ||
    (roleA.includes('artista') && roleB.includes('productor')) ||
    (roleA.includes('ambos') || roleB.includes('ambos'))
  ) {
    roleBonus = 15
  } else if (roleA && roleB && roleA === roleB) {
    roleBonus = 8
  }

  // 3. Componente de Proximidad geografica calculada (hasta 15 puntos)
  let proximityBonus = 0
  if (distanceKm != null && distanceKm >= 0) {
    if (distanceKm <= 25) {
      proximityBonus = 15
    } else if (distanceKm <= 100) {
      proximityBonus = 10
    } else if (distanceKm <= 300) {
      proximityBonus = 5
    } else {
      proximityBonus = 0
    }
  } else {
    // Si no hay ubicacion disponible, asignamos un neutro de 5 puntos
    proximityBonus = 5
  }

  // Base fija = 20 puntos
  const rawScore = 20 + genreScore + roleBonus + proximityBonus
  const finalScore = Math.min(99, Math.max(40, Math.round(rawScore)))
  const percentage = `${finalScore}%`

  const reasons: string[] = []
  if (commonGenres.length > 0) {
    reasons.push(`Generos en comun (Jaccard ${(jaccard * 100).toFixed(0)}%): ${commonGenres.slice(0, 3).join(', ')}`)
  }
  if (roleBonus === 15) {
    reasons.push('Alta complementariedad de roles (Artista / Productor)')
  }
  if (distanceKm != null && distanceKm >= 0 && distanceKm <= 100) {
    reasons.push(`Proximidad geografica cercana (${distanceKm} km)`)
  }

  let summary = 'Afinidad en estilos y colaboraciones musicales.'
  if (commonGenres.length > 0) {
    summary = `Comparten interes en ${commonGenres.slice(0, 2).join(' y ')} con similitud de Jaccard de ${(jaccard * 100).toFixed(0)}%.`
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
   * Registra un Like y procesa la regla de negocio de Matching reciproco
   * envuelto en una transaccion explicita BEGIN / COMMIT / ROLLBACK.
   */
  async likeUser(senderId: string, targetUserId: string) {
    if (!senderId) throw new Error('Usuario no autenticado.')
    if (!targetUserId || typeof targetUserId !== 'string') throw new Error('ID de usuario objetivo requerido.')
    if (senderId === targetUserId) throw new Error('No puedes conectar contigo mismo.')

    const client = await getClient()

    try {
      await client.query('BEGIN')

      const targetUserRes = await client.query(`
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

      // 1. Registrar o actualizar la interaccion del remitente (isLike = true)
      await client.query(`
        INSERT INTO "Interaction" (id, "senderId", "receiverId", "isLike", "createdAt")
        VALUES (gen_random_uuid(), $1, $2, true, CURRENT_TIMESTAMP)
        ON CONFLICT ("senderId", "receiverId") DO UPDATE SET "isLike" = true;
      `, [senderId, targetUserId])

      const [u1, u2] = [senderId, targetUserId].sort()

      const matchCheck = await client.query(`
        SELECT id FROM "Match" WHERE "user1Id" = $1 AND "user2Id" = $2 LIMIT 1;
      `, [u1, u2])

      const convCheck = await client.query(`
        SELECT id FROM "Conversation" WHERE "user1Id" = $1 AND "user2Id" = $2 LIMIT 1;
      `, [u1, u2])

      // Reciprocidad estricta (RF-02): isMatch se activa UNICAMENTE si existe un like real previo (Interaction.isLike = true)
      const targetLikeCheck = await client.query(`
        SELECT "isLike" FROM "Interaction" WHERE "senderId" = $1 AND "receiverId" = $2 LIMIT 1;
      `, [targetUserId, senderId])

      const isMatch = targetLikeCheck.rows.length > 0 && targetLikeCheck.rows[0].isLike === true

      const senderRes = await client.query(`
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
        const notifExists = await client.query(`
          SELECT id FROM "Notification"
          WHERE "userId" = $1 AND type = 'match_request' AND message LIKE $2
          LIMIT 1;
        `, [targetUserId, `%${senderDisplayName}%`])

        if (notifExists.rows.length === 0) {
          await client.query(`
            INSERT INTO "Notification" (id, "userId", title, message, type, "linkPage", "senderId", "isRead", "createdAt")
            VALUES (gen_random_uuid(), $1, 'Solicitud de Match', $2, 'match_request', 'Discovery', $3, false, CURRENT_TIMESTAMP);
          `, [targetUserId, `${senderDisplayName} quiere conectar y colaborar contigo.`, senderId])
        }

        await client.query('COMMIT')

        // Disparar push de solicitud de conexion al destinatario
        fcmService.sendToUser(targetUserId, {
          title: 'Solicitud de Match',
          body: `${senderDisplayName} quiere conectar y colaborar contigo.`,
          linkPage: 'Discovery',
          data: {
            senderId,
            type: 'match_request',
          },
        }).catch(() => {})

        return {
          isMatch: false,
          message: 'Like registrado exitosamente. En espera de conexion mutua.',
        }
      }

      // MATCH MUTUO - Asegurar ambas interacciones con isLike = true
      await client.query(`
        INSERT INTO "Interaction" (id, "senderId", "receiverId", "isLike", "createdAt")
        VALUES (gen_random_uuid(), $1, $2, true, CURRENT_TIMESTAMP)
        ON CONFLICT ("senderId", "receiverId") DO UPDATE SET "isLike" = true;
      `, [targetUserId, senderId])

      await client.query(`
        INSERT INTO "Interaction" (id, "senderId", "receiverId", "isLike", "createdAt")
        VALUES (gen_random_uuid(), $1, $2, true, CURRENT_TIMESTAMP)
        ON CONFLICT ("senderId", "receiverId") DO UPDATE SET "isLike" = true;
      `, [senderId, targetUserId])

      const [u1Genres, u2Genres] = await Promise.all([
        client.query(`
          SELECT g.name FROM "ProfileGenre" pg
          JOIN "Genre" g ON pg."genreId" = g.id
          WHERE pg."userId" = $1;
        `, [u1]),
        client.query(`
          SELECT g.name FROM "ProfileGenre" pg
          JOIN "Genre" g ON pg."genreId" = g.id
          WHERE pg."userId" = $1;
        `, [u2]),
      ])

      const proximity = calculateProximity(
        senderUser?.latitude,
        senderUser?.longitude,
        targetUser.latitude,
        targetUser.longitude
      )

      const affinity = calculateAffinity(
        { role: senderUser?.role, interestGenres: (senderId === u1 ? u1Genres : u2Genres).rows.map((r: any) => r.name) },
        { role: targetUser.role, interestGenres: (senderId === u1 ? u2Genres : u1Genres).rows.map((r: any) => r.name) },
        proximity.distanceKm >= 0 ? proximity.distanceKm : null
      )

      let matchRecord: any = null
      if (matchCheck.rows.length > 0) {
        matchRecord = matchCheck.rows[0]
        await client.query(`
          UPDATE "Match"
          SET "affinityPercent" = $1, "matchedAt" = CURRENT_TIMESTAMP
          WHERE id = $2;
        `, [affinity.percentage, matchRecord.id])
      } else {
        const matchInsert = await client.query(`
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
        const convInsert = await client.query(`
          INSERT INTO "Conversation" (id, "user1Id", "user2Id", pinned, muted, blocked, "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), $1, $2, false, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id;
        `, [u1, u2])
        convRecord = convInsert.rows[0]
      }

      const partnerTracksRes = await client.query(`
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
      await client.query(`
        DELETE FROM "Notification"
        WHERE ("userId" = $1 AND type = 'match_request' AND (message ILIKE $2 OR message ILIKE $3))
           OR ("userId" = $4 AND type = 'match_request' AND (message ILIKE $5 OR message ILIKE $6));
      `, [
        senderId, `%${targetUser.nickname || ''}%`, `%${targetUser.firstName || ''}%`,
        targetUserId, `%${senderDisplayName}%`, `%${senderUser?.firstName || ''}%`
      ])

      // Crear notificaciones de Match Mutuo para ambos usuarios en PostgreSQL
      await Promise.all([
        client.query(`
          INSERT INTO "Notification" (id, "userId", title, message, type, "linkPage", "senderId", "isRead", "createdAt")
          VALUES (gen_random_uuid(), $1, $2, $3, 'match', 'Messages', $4, false, CURRENT_TIMESTAMP);
        `, [
          senderId,
          `Nuevo Match con ${partnerPayload.nickname || partnerPayload.name}`,
          `${partnerPayload.nickname || partnerPayload.name} y tu han conectado. Ya pueden colaborar en Mensajes.`,
          targetUserId,
        ]),
        client.query(`
          INSERT INTO "Notification" (id, "userId", title, message, type, "linkPage", "senderId", "isRead", "createdAt")
          VALUES (gen_random_uuid(), $1, $2, $3, 'match', 'Messages', $4, false, CURRENT_TIMESTAMP);
        `, [
          targetUserId,
          `Nuevo Match con ${senderDisplayName}`,
          `${senderDisplayName} y tu han conectado. Ya pueden colaborar en Mensajes.`,
          senderId,
        ])
      ])

      await client.query('COMMIT')

      // Disparar notificaciones push FCM en tiempo real para ambos usuarios
      fcmService.sendToUser(senderId, {
        title: `Nuevo Match con ${partnerPayload.nickname || partnerPayload.name}`,
        body: 'Han conectado en LinkedSound. Ya pueden colaborar y chatear.',
        linkPage: 'Messages',
      }).catch(() => {})

      fcmService.sendToUser(targetUserId, {
        title: `Nuevo Match con ${senderDisplayName}`,
        body: 'Han conectado en LinkedSound. Ya pueden colaborar y chatear.',
        linkPage: 'Messages',
      }).catch(() => {})

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
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
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
   * Deteccion estricta: los likes entrantes provienen unicamente de la tabla Interaction.
   */
  async getUserInteractions(userId: string) {
    if (!userId) throw new Error('Usuario no autenticado.')

    const [outRes, inRes] = await Promise.all([
      query(`SELECT "receiverId", "isLike" FROM "Interaction" WHERE "senderId" = $1;`, [userId]),
      query(`SELECT "senderId" FROM "Interaction" WHERE "receiverId" = $1 AND "isLike" = true;`, [userId]),
    ])

    const incomingLikesSet = new Set<string>(inRes.rows.map((r: any) => r.senderId))

    return {
      interactions: outRes.rows.map((r: any) => ({
        receiverId: r.receiverId,
        isLike: r.isLike,
      })),
      incomingLikes: Array.from(incomingLikesSet),
    }
  }

  /**
   * Resetea unicamente los descartes del usuario (isLike = false emitidos por el usuario),
   * preservando todos los likes recibidos y emitidos, asi como los matches existentes.
   */
  async resetInteractions(userId: string) {
    if (!userId) throw new Error('Usuario no autenticado.')

    await query(`
      DELETE FROM "Interaction"
      WHERE "senderId" = $1 AND "isLike" = false;
    `, [userId])

    return { success: true, message: 'Descartes reseteados exitosamente. Tus likes y matches fueron preservados.' }
  }
}

export const matchService = new MatchService()
export const interactionService = matchService
