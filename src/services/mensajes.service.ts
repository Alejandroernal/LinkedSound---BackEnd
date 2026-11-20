import { query, getClient } from '../config/db.js'
import type { SendMessageDTO } from '../models/mensajes.model.js'

export class MensajesService {
  /**
   * Obtiene todas las conversaciones activas del usuario con su último mensaje y conteo de no leídos.
   */
  async getUserConversations(userId: string) {
    if (!userId) {
      throw new Error('Identificador de usuario inválido.')
    }

    const sql = `
      SELECT 
        c.id, c."user1Id", c."user2Id", c.pinned, c.muted, c.blocked,
        c."createdAt", c."updatedAt",
        u1."firstName" AS u1_firstname, u1."lastName" AS u1_lastname, u1.nickname AS u1_nickname, u1."profileImage" AS u1_image,
        COALESCE((SELECT r.name FROM "UserRole" ur JOIN "Role" r ON ur."roleId" = r.id WHERE ur."userId" = u1.id LIMIT 1), 'Artista') AS u1_role,
        s1.name AS u1_status,
        u2."firstName" AS u2_firstname, u2."lastName" AS u2_lastname, u2.nickname AS u2_nickname, u2."profileImage" AS u2_image,
        COALESCE((SELECT r.name FROM "UserRole" ur JOIN "Role" r ON ur."roleId" = r.id WHERE ur."userId" = u2.id LIMIT 1), 'Artista') AS u2_role,
        s2.name AS u2_status
      FROM "Conversation" c
      LEFT JOIN "User" u1 ON c."user1Id" = u1.id
      LEFT JOIN "UserStatus" s1 ON u1."statusId" = s1.id
      LEFT JOIN "User" u2 ON c."user2Id" = u2.id
      LEFT JOIN "UserStatus" s2 ON u2."statusId" = s2.id
      WHERE c."user1Id" = $1 OR c."user2Id" = $1
      ORDER BY c.pinned DESC, c."updatedAt" DESC;
    `
    const { rows: conversations } = await query(sql, [userId])
    if (conversations.length === 0) return []

    const convIds = conversations.map((c: any) => c.id)

    // Último mensaje y conteo de no leídos por conversación
    const [lastMessagesRes, unreadCountsRes] = await Promise.all([
      query(`
        SELECT DISTINCT ON ("conversationId")
          id, "conversationId", "senderId", text, "attachmentUrl", "attachmentName", "isRead", "createdAt"
        FROM "Message"
        WHERE "conversationId" = ANY($1::uuid[])
        ORDER BY "conversationId", "createdAt" DESC;
      `, [convIds]),
      query(`
        SELECT "conversationId", COUNT(*)::int AS count
        FROM "Message"
        WHERE "conversationId" = ANY($1::uuid[])
          AND "senderId" <> $2
          AND "isRead" = false
        GROUP BY "conversationId";
      `, [convIds, userId]),
    ])

    const lastMsgMap = new Map<string, any>()
    for (const msg of lastMessagesRes.rows) {
      lastMsgMap.set(msg.conversationId, msg)
    }

    const unreadMap = new Map<string, number>()
    for (const row of unreadCountsRes.rows) {
      unreadMap.set(row.conversationId, row.count)
    }

    return conversations.map((c: any) => {
      const isUser1 = c.user1Id === userId
      const otherId = isUser1 ? c.user2Id : c.user1Id
      const otherFirst = isUser1 ? c.u2_firstname : c.u1_firstname
      const otherLast = isUser1 ? c.u2_lastname : c.u1_lastname
      const otherNick = isUser1 ? c.u2_nickname : c.u1_nickname
      const otherImage = isUser1 ? c.u2_image : c.u1_image
      const otherRole = isUser1 ? c.u2_role : c.u1_role
      const otherStatus = isUser1 ? c.u2_status : c.u1_status

      const displayName = otherNick || `${otherFirst || ''} ${otherLast || ''}`.trim() || 'Creador'
      const initials = displayName.slice(0, 2).toUpperCase()

      const lastMsg = lastMsgMap.get(c.id)
      let lastMessagePreview = 'Comienza una nueva conversacion'
      let lastMessageTime = c.updatedAt

      if (lastMsg) {
        lastMessageTime = lastMsg.createdAt
        if (lastMsg.text && lastMsg.text.trim()) {
          lastMessagePreview = lastMsg.text
        } else if (lastMsg.attachmentName) {
          lastMessagePreview = `Archivo: ${lastMsg.attachmentName}`
        } else if (lastMsg.attachmentUrl) {
          lastMessagePreview = 'Archivo adjunto'
        }
      }

      const timeStr = lastMessageTime
        ? new Date(lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Reciente'

      return {
        id: c.id,
        // Flat properties required by Frontend (Conversation type)
        name: displayName,
        role: otherRole || 'Artista',
        avatar: initials,
        profileImage: otherImage || '',
        accent: 'purple' as const,
        status: otherStatus || 'Online',
        preview: lastMessagePreview,
        time: timeStr,
        unread: unreadMap.get(c.id) || 0,
        pinned: Boolean(c.pinned),
        muted: Boolean(c.muted),
        blocked: Boolean(c.blocked),
        location: '',

        // Nested structure for backward compatibility
        partnerId: otherId,
        participant: {
          id: otherId,
          name: displayName,
          nickname: otherNick || 'Creador',
          avatar: otherImage || '',
          role: otherRole || 'Artista',
          status: otherStatus || 'Active',
        },
        lastMessage: lastMessagePreview,
        lastMessageTime,
        unreadCount: unreadMap.get(c.id) || 0,
      }
    })
  }

  /**
   * Obtiene los mensajes con paginacion real, ordenados cronologicamente y marca como leidos con readAt.
   */
  async getConversationMessages(userId: string, conversationId: string, page = 1, limit = 50) {
    if (!userId || !conversationId) {
      throw new Error('Parametros de conversacion invalidos.')
    }

    const conv = await query(`
      SELECT id, "user1Id", "user2Id", blocked
      FROM "Conversation"
      WHERE id = $1 AND ("user1Id" = $2 OR "user2Id" = $2)
      LIMIT 1;
    `, [conversationId, userId])

    if (conv.rows.length === 0) {
      const err = new Error('Conversacion no encontrada o acceso no autorizado.')
      ;(err as any).statusCode = 404
      throw err
    }

    // Marcar mensajes entrantes como leidos registrando readAt
    await query(`
      UPDATE "Message"
      SET "isRead" = true, "readAt" = CURRENT_TIMESTAMP
      WHERE "conversationId" = $1 AND "senderId" <> $2 AND "isRead" = false;
    `, [conversationId, userId])

    // Conteo total para paginacion real
    const countRes = await query(`
      SELECT COUNT(*)::int AS total
      FROM "Message"
      WHERE "conversationId" = $1;
    `, [conversationId])
    const total = countRes.rows[0]?.total || 0

    const validPage = Math.max(1, page)
    const validLimit = Math.max(1, Math.min(limit, 100))
    const offset = (validPage - 1) * validLimit

    const { rows: messages } = await query(`
      SELECT 
        m.id, m."conversationId", m."senderId", m.text, m."isRead", m."readAt",
        m."attachmentUrl", m."attachmentType", m."attachmentName", m."attachmentSize",
        m."createdAt",
        u."firstName", u."lastName", u.nickname, u."profileImage"
      FROM "Message" m
      LEFT JOIN "User" u ON m."senderId" = u.id
      WHERE m."conversationId" = $1
      ORDER BY m."createdAt" ASC
      LIMIT $2 OFFSET $3;
    `, [conversationId, validLimit, offset])

    const formattedMessages = messages.map((m: any) => {
      const isMe = m.senderId === userId
      const timeStr = m.createdAt
        ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Reciente'

      const hasAttachment = Boolean(m.attachmentUrl)
      const attachment = hasAttachment
        ? {
            url: m.attachmentUrl,
            name: m.attachmentName || 'Archivo adjunto',
            type: (m.attachmentType === 'audio' || String(m.attachmentUrl).match(/\.(mp3|wav|ogg|m4a|aac)/i))
              ? ('audio' as const)
              : ('image' as const),
            size: m.attachmentSize || 'Audio file',
            format: m.attachmentType || 'MP3',
          }
        : undefined

      return {
        id: m.id,
        // Frontend Message type
        sender: (isMe ? 'me' : 'them') as 'me' | 'them',
        text: m.text || '',
        time: timeStr,
        attachment,

        // Backend properties for full compatibility
        conversationId: m.conversationId,
        senderId: m.senderId,
        isMe,
        senderName: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.nickname || 'Creador',
        senderAvatar: m.profileImage || '',
        isRead: Boolean(m.isRead),
        readAt: m.readAt,
        attachmentUrl: m.attachmentUrl || null,
        attachmentType: m.attachmentType || null,
        attachmentName: m.attachmentName || null,
        attachmentSize: m.attachmentSize || null,
        createdAt: m.createdAt,
      }
    })

    return {
      messages: formattedMessages,
      pagination: {
        total,
        page: validPage,
        limit: validLimit,
        totalPages: Math.ceil(total / validLimit) || 1,
        hasMore: offset + messages.length < total,
      },
    }
  }

  /**
   * Envía un mensaje en la conversación actual.
   */
  async sendMessage(userId: string, conversationId: string, payload: SendMessageDTO) {
    if (!userId || !conversationId) {
      throw new Error('Identificadores inválidos para el mensaje.')
    }

    const { text, attachmentUrl, attachmentType, attachmentName, attachmentSize } = payload

    if ((!text || !text.trim()) && !attachmentUrl) {
      throw new Error('El mensaje debe contener texto o un archivo adjunto.')
    }

    const conv = await query(`
      SELECT id, "user1Id", "user2Id", blocked
      FROM "Conversation"
      WHERE id = $1 AND ("user1Id" = $2 OR "user2Id" = $2)
      LIMIT 1;
    `, [conversationId, userId])

    if (conv.rows.length === 0) {
      const err = new Error('Conversacion no encontrada o acceso denegado.')
      ;(err as any).statusCode = 404
      throw err
    }

    if (conv.rows[0].blocked) {
      throw new Error('La conversacion esta bloqueada. No se pueden enviar mensajes.')
    }

    const insertSql = `
      INSERT INTO "Message" (
        id, "conversationId", "senderId", text, "attachmentUrl", "attachmentType",
        "attachmentName", "attachmentSize", "isRead", "createdAt"
      )
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, CURRENT_TIMESTAMP)
      RETURNING id, "conversationId", "senderId", text, "attachmentUrl", "attachmentType", "attachmentName", "attachmentSize", "isRead", "createdAt";
    `
    const { rows: msgRows } = await query(insertSql, [
      conversationId,
      userId,
      text ? text.trim() : null,
      attachmentUrl || null,
      attachmentType || null,
      attachmentName || null,
      attachmentSize || null,
    ])

    await query(`
      UPDATE "Conversation"
      SET "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1;
    `, [conversationId])

    const newMsg = msgRows[0]
    const timeStr = new Date(newMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const hasAttachment = Boolean(newMsg.attachmentUrl)
    const attachment = hasAttachment
      ? {
          url: newMsg.attachmentUrl,
          name: newMsg.attachmentName || 'Archivo adjunto',
          type: (newMsg.attachmentType === 'audio' || String(newMsg.attachmentUrl).match(/\.(mp3|wav|ogg|m4a|aac)/i))
            ? ('audio' as const)
            : ('image' as const),
          size: newMsg.attachmentSize || 'Audio file',
          format: newMsg.attachmentType || 'MP3',
        }
      : undefined

    return {
      ...newMsg,
      sender: 'me' as const,
      time: timeStr,
      attachment,
      isMe: true,
    }
  }

  /**
   * Actualiza el estado de una conversación (fijar, silenciar, bloquear).
   */
  async updateConversationStatus(
    userId: string,
    conversationId: string,
    data: { blocked?: boolean; pinned?: boolean; muted?: boolean }
  ) {
    const fields: string[] = ['"updatedAt" = CURRENT_TIMESTAMP']
    const values: any[] = [conversationId, userId]
    let pIdx = 3

    if (data.blocked !== undefined) {
      fields.push(`blocked = $${pIdx++}`)
      values.push(Boolean(data.blocked))
    }
    if (data.pinned !== undefined) {
      fields.push(`pinned = $${pIdx++}`)
      values.push(Boolean(data.pinned))
    }
    if (data.muted !== undefined) {
      fields.push(`muted = $${pIdx++}`)
      values.push(Boolean(data.muted))
    }

    const sql = `
      UPDATE "Conversation"
      SET ${fields.join(', ')}
      WHERE id = $1 AND ("user1Id" = $2 OR "user2Id" = $2)
      RETURNING id, pinned, muted, blocked, "updatedAt";
    `
    const { rows } = await query(sql, values)
    if (rows.length === 0) {
      const err = new Error('Conversacion no encontrada.')
      ;(err as any).statusCode = 404
      throw err
    }
    return rows[0]
  }

  /**
   * Elimina una conversacion y sus mensajes, revocando completamente el vinculo
   * entre los usuarios mediante la eliminacion sincronizada de Match e Interacciones.
   */
  async deleteConversation(userId: string, conversationId: string) {
    const client = await getClient()

    try {
      await client.query('BEGIN')

      // Verificar pertenencia y obtener ambos participantes
      const convRes = await client.query(`
        SELECT id, "user1Id", "user2Id"
        FROM "Conversation"
        WHERE id = $1 AND ("user1Id" = $2 OR "user2Id" = $2)
        LIMIT 1;
      `, [conversationId, userId])

      if (convRes.rows.length === 0) {
        const err = new Error('Conversacion no encontrada o sin autorizacion.')
        ;(err as any).statusCode = 404
        throw err
      }

      const { user1Id, user2Id } = convRes.rows[0]

      // 1. Eliminar la conversacion (los mensajes asociados se eliminan en cascada)
      await client.query(`DELETE FROM "Conversation" WHERE id = $1;`, [conversationId])

      // 2. Revocar completamente el vinculo: eliminar el Match reciproco existente
      await client.query(`
        DELETE FROM "Match"
        WHERE ("user1Id" = $1 AND "user2Id" = $2)
           OR ("user1Id" = $2 AND "user2Id" = $1);
      `, [user1Id, user2Id])

      // 3. Eliminar todas las interacciones (likes y descartes) entre ambos usuarios
      await client.query(`
        DELETE FROM "Interaction"
        WHERE ("senderId" = $1 AND "receiverId" = $2)
           OR ("senderId" = $2 AND "receiverId" = $1);
      `, [user1Id, user2Id])

      await client.query('COMMIT')
      return { success: true, message: 'Conversacion, match e interacciones revocadas exitosamente.' }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
}

export const mensajesService = new MensajesService()
export const conversationService = mensajesService

