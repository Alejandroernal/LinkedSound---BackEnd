import { query, getClient } from '../config/db.js'
import { uploadBase64ToCloudinary } from './upload.service.js'

const ACCENT_COLORS: Array<'purple' | 'pink' | 'cyan' | 'gold'> = ['purple', 'pink', 'cyan', 'gold']

export interface FormattedConversation {
  id: string
  partnerId: string
  partnerUserId: string
  name: string
  role: string
  avatar: string
  accent: 'purple' | 'pink' | 'cyan' | 'gold'
  status: 'Online' | 'Offline'
  preview: string
  time: string
  unread: number
  pinned: boolean
  muted: boolean
  blocked: boolean
  profileImage: string
  location: string
}

export class ConversationService {
  /**
   * Obtiene las conversaciones activas del usuario con su último mensaje y estado.
   */
  async getConversations(currentUserId: string): Promise<FormattedConversation[]> {
    if (!currentUserId) return []

    const sql = `
      SELECT 
        c.id,
        c."user1Id",
        c."user2Id",
        c.pinned,
        c.muted,
        c.blocked,
        c."updatedAt",
        -- Usuario 1
        u1.id AS u1_id, u1.nickname AS u1_nickname, u1."firstName" AS u1_firstname, u1."lastName" AS u1_lastname,
        u1."profileImage" AS u1_img, u1.role AS u1_role, l1."formattedAddress" AS u1_loc, s1.name AS u1_status,
        -- Usuario 2
        u2.id AS u2_id, u2.nickname AS u2_nickname, u2."firstName" AS u2_firstname, u2."lastName" AS u2_lastname,
        u2."profileImage" AS u2_img, u2.role AS u2_role, l2."formattedAddress" AS u2_loc, s2.name AS u2_status,
        -- Último Mensaje
        last_m.id AS msg_id,
        last_m.text AS msg_text,
        last_m."senderId" AS msg_sender,
        last_m."isRead" AS msg_is_read,
        last_m."createdAt" AS msg_created_at
      FROM "Conversation" c
      JOIN "User" u1 ON c."user1Id" = u1.id
      LEFT JOIN "Location" l1 ON u1."locationId" = l1.id
      LEFT JOIN "UserStatus" s1 ON u1."statusId" = s1.id
      JOIN "User" u2 ON c."user2Id" = u2.id
      LEFT JOIN "Location" l2 ON u2."locationId" = l2.id
      LEFT JOIN "UserStatus" s2 ON u2."statusId" = s2.id
      LEFT JOIN LATERAL (
        SELECT id, text, "senderId", "isRead", "createdAt"
        FROM "Message" m
        WHERE m."conversationId" = c.id
        ORDER BY m."createdAt" DESC
        LIMIT 1
      ) last_m ON true
      WHERE c."user1Id" = $1 OR c."user2Id" = $1
      ORDER BY c."updatedAt" DESC;
    `
    const { rows } = await query(sql, [currentUserId])

    return rows.map((conv: any, index: number) => {
      const isU1 = conv.user1Id === currentUserId
      const partnerId = isU1 ? conv.u2_id : conv.u1_id
      const partnerName = isU1
        ? conv.u2_nickname || `${conv.u2_firstname || ''} ${conv.u2_lastname || ''}`.trim() || 'Usuario de LinkedSound'
        : conv.u1_nickname || `${conv.u1_firstname || ''} ${conv.u1_lastname || ''}`.trim() || 'Usuario de LinkedSound'
      const partnerRole = isU1 ? conv.u2_role : conv.u1_role
      const partnerImg = isU1 ? conv.u2_img : conv.u1_img
      const partnerLoc = isU1 ? conv.u2_loc : conv.u1_loc
      const partnerStatus = (isU1 ? conv.u2_status : conv.u1_status) === 'Active' ? 'Online' : 'Offline'

      const timeStr = conv.msg_created_at
        ? new Date(conv.msg_created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Reciente'

      const accent = ACCENT_COLORS[index % ACCENT_COLORS.length]
      const isUnread = Boolean(
        conv.msg_id &&
        !conv.msg_is_read &&
        conv.msg_sender !== currentUserId
      )

      return {
        id: conv.id,
        partnerId: partnerId || '',
        partnerUserId: partnerId || '',
        name: partnerName,
        role: partnerRole || 'Artista',
        avatar: partnerName.slice(0, 2).toUpperCase(),
        accent,
        status: partnerStatus as 'Online' | 'Offline',
        preview: conv.msg_text || 'Nueva conversación iniciada.',
        time: timeStr,
        unread: isUnread ? 1 : 0,
        pinned: Boolean(conv.pinned),
        muted: Boolean(conv.muted),
        blocked: Boolean(conv.blocked),
        profileImage: partnerImg || '',
        location: partnerLoc || '',
      }
    })
  }

  /**
   * Obtiene los mensajes de una conversación, validando pertenencia y marcando lectura.
   */
  async getMessages(conversationId: string, currentUserId: string) {
    if (!currentUserId) throw new Error('Usuario no autenticado.')

    const convRes = await query(`
      SELECT id, "user1Id", "user2Id", blocked FROM "Conversation" WHERE id = $1 LIMIT 1;
    `, [conversationId])

    if (convRes.rows.length === 0) {
      throw new Error('Conversación no encontrada.')
    }
    const conv = convRes.rows[0]

    // Regla de autorización: Pertenencia a la conversación
    if (conv.user1Id !== currentUserId && conv.user2Id !== currentUserId) {
      throw new Error('No tienes permiso para ver esta conversación.')
    }

    // Marcar mensajes entrantes como leídos registrando readAt
    await query(`
      UPDATE "Message"
      SET "isRead" = true, "readAt" = CURRENT_TIMESTAMP
      WHERE "conversationId" = $1 AND "senderId" <> $2 AND "isRead" = false;
    `, [conversationId, currentUserId])

    const msgRes = await query(`
      SELECT 
        id, "senderId", text, "attachmentUrl", "attachmentName", "attachmentType", "attachmentSize", "createdAt"
      FROM "Message"
      WHERE "conversationId" = $1
      ORDER BY "createdAt" ASC;
    `, [conversationId])

    return msgRes.rows.map((m: any) => {
      const isMe = m.senderId === currentUserId
      const timeStr = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      return {
        id: m.id,
        sender: isMe ? ('me' as const) : ('them' as const),
        text: m.text,
        time: timeStr,
        attachment: m.attachmentUrl
          ? {
              url: m.attachmentUrl,
              name: m.attachmentName || 'Archivo adjunto',
              type: (m.attachmentType || 'image') as 'audio' | 'image',
              size: m.attachmentSize || undefined,
            }
          : undefined,
      }
    })
  }

  /**
   * Envía un mensaje en la conversación aplicando reglas de validación y bloqueo.
   */
  async sendMessage(conversationId: string, currentUserId: string, data: {
    text?: string
    attachmentUrl?: string
    attachmentName?: string
    attachmentType?: string
    attachmentSize?: string
  }) {
    if (!data.text && !data.attachmentUrl) {
      throw new Error('No se puede enviar un mensaje vacío.')
    }
    if (!currentUserId) throw new Error('Usuario no autenticado.')

    const convRes = await query(`
      SELECT 
        c.id, c."user1Id", c."user2Id", c.blocked,
        u1.nickname AS u1_nickname, u1."firstName" AS u1_first, u1."lastName" AS u1_last,
        u2.nickname AS u2_nickname, u2."firstName" AS u2_first, u2."lastName" AS u2_last
      FROM "Conversation" c
      JOIN "User" u1 ON c."user1Id" = u1.id
      JOIN "User" u2 ON c."user2Id" = u2.id
      WHERE c.id = $1
      LIMIT 1;
    `, [conversationId])

    if (convRes.rows.length === 0) {
      throw new Error('Conversación no encontrada.')
    }
    const conv = convRes.rows[0]

    // Regla de autorización
    if (conv.user1Id !== currentUserId && conv.user2Id !== currentUserId) {
      throw new Error('No puedes enviar mensajes en una conversación que no te pertenece.')
    }

    // Regla de bloqueo
    if (conv.blocked) {
      throw new Error('No es posible enviar mensajes en una conversación bloqueada.')
    }

    const recipientUserId = conv.user1Id === currentUserId ? conv.user2Id : conv.user1Id
    const senderDisplayName = conv.user1Id === currentUserId
      ? (conv.u1_nickname || `${conv.u1_first || ''} ${conv.u1_last || ''}`.trim() || 'Un usuario')
      : (conv.u2_nickname || `${conv.u2_first || ''} ${conv.u2_last || ''}`.trim() || 'Un usuario')

    let finalAttachmentUrl = data.attachmentUrl || null
    if (finalAttachmentUrl && typeof finalAttachmentUrl === 'string' && finalAttachmentUrl.startsWith('data:')) {
      finalAttachmentUrl = await uploadBase64ToCloudinary(finalAttachmentUrl, 'linkedsound/chat')
    }

    const insertSql = `
      INSERT INTO "Message" (
        id, "conversationId", "senderId", text, "attachmentUrl", "attachmentName", "attachmentType", "attachmentSize", "isRead", "createdAt"
      )
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, CURRENT_TIMESTAMP)
      RETURNING *;
    `
    const insertRes = await query(insertSql, [
      conversationId,
      currentUserId,
      data.text && String(data.text).trim().length > 0 ? String(data.text).trim() : null,
      finalAttachmentUrl,
      data.attachmentName || null,
      data.attachmentType || null,
      data.attachmentSize || null,
    ])
    const created = insertRes.rows[0]

    // Actualizar timestamp de la conversación
    await query(`UPDATE "Conversation" SET "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1;`, [conversationId])

    // Crear notificación para el receptor
    const previewText = created.text
      ? (created.text.length > 50 ? `${created.text.slice(0, 50)}...` : created.text)
      : 'Te ha enviado un archivo adjunto.'

    await query(`
      INSERT INTO "Notification" (id, "userId", title, message, type, "linkPage", "isRead", "createdAt")
      VALUES (gen_random_uuid(), $1, $2, $3, 'message', 'Messages', false, CURRENT_TIMESTAMP);
    `, [recipientUserId, `Nuevo mensaje de ${senderDisplayName}`, previewText]).catch(() => {})

    const timeStr = new Date(created.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    return {
      created,
      formattedMessage: {
        id: created.id,
        sender: 'me' as const,
        text: created.text,
        time: timeStr,
        attachment: created.attachmentUrl
          ? {
              url: created.attachmentUrl,
              name: created.attachmentName || 'Archivo adjunto',
              type: (created.attachmentType || 'image') as 'audio' | 'image',
              size: created.attachmentSize || undefined,
            }
          : undefined,
      },
    }
  }

  /**
   * Elimina la conversación, mensajes, match e interacciones entre ambos usuarios.
   */
  async deleteConversation(conversationId: string, currentUserId: string) {
    if (!currentUserId) throw new Error('Usuario no autenticado.')
    if (!conversationId) throw new Error('ID de conversación requerido.')

    const convRes = await query(`
      SELECT id, "user1Id", "user2Id" FROM "Conversation" WHERE id = $1 LIMIT 1;
    `, [conversationId])

    if (convRes.rows.length === 0) {
      throw new Error('Conversación no encontrada.')
    }
    const conv = convRes.rows[0]

    if (conv.user1Id !== currentUserId && conv.user2Id !== currentUserId) {
      throw new Error('No tienes autorización para eliminar esta conversación.')
    }

    const otherUserId = conv.user1Id === currentUserId ? conv.user2Id : conv.user1Id
    const [u1, u2] = [conv.user1Id, conv.user2Id].sort()
    const client = await getClient()

    try {
      await client.query('BEGIN')
      // 1. Mensajes
      await client.query(`DELETE FROM "Message" WHERE "conversationId" = $1;`, [conversationId])
      // 2. Conversación
      await client.query(`DELETE FROM "Conversation" WHERE id = $1;`, [conversationId])
      // 3. Match canónico
      await client.query(`DELETE FROM "Match" WHERE "user1Id" = $1 AND "user2Id" = $2;`, [u1, u2])
      // 4. Interacciones mutuas
      await client.query(`
        DELETE FROM "Interaction" 
        WHERE ("senderId" = $1 AND "receiverId" = $2)
           OR ("senderId" = $2 AND "receiverId" = $1);
      `, [currentUserId, otherUserId])
      // 5. Notificaciones de match
      await client.query(`
        DELETE FROM "Notification" 
        WHERE ("userId" = $1 OR "userId" = $2) AND type IN ('match', 'match_request');
      `, [currentUserId, otherUserId])

      await client.query('COMMIT')
      return { message: 'Desconexión completada. Match y conversación eliminados exitosamente.' }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * Actualiza configuraciones de conversación (fijar, silenciar, bloquear).
   */
  async updateConversationSettings(conversationId: string, currentUserId: string, settings: {
    blocked?: boolean
    pinned?: boolean
    muted?: boolean
  }) {
    if (!currentUserId) throw new Error('Usuario no autenticado.')
    if (!conversationId) throw new Error('ID de conversación requerido.')

    const convRes = await query(`
      SELECT id, "user1Id", "user2Id" FROM "Conversation" WHERE id = $1 LIMIT 1;
    `, [conversationId])

    if (convRes.rows.length === 0) {
      throw new Error('Conversación no encontrada.')
    }
    const conv = convRes.rows[0]

    if (conv.user1Id !== currentUserId && conv.user2Id !== currentUserId) {
      throw new Error('No tienes autorización para modificar esta conversación.')
    }

    const updates: string[] = []
    const values: any[] = [conversationId]
    let pIdx = 2

    if (typeof settings.blocked === 'boolean') {
      updates.push(`blocked = $${pIdx++}`)
      values.push(settings.blocked)
    }
    if (typeof settings.pinned === 'boolean') {
      updates.push(`pinned = $${pIdx++}`)
      values.push(settings.pinned)
    }
    if (typeof settings.muted === 'boolean') {
      updates.push(`muted = $${pIdx++}`)
      values.push(settings.muted)
    }

    if (updates.length === 0) {
      return conv
    }

    const sql = `
      UPDATE "Conversation"
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *;
    `
    const updated = await query(sql, values)
    return updated.rows[0]
  }
}

export const conversationService = new ConversationService()

