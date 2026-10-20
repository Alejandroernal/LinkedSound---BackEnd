import type { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { uploadBase64ToCloudinary } from '../services/upload.service.js'

const ACCENT_COLORS: Array<'purple' | 'pink' | 'cyan' | 'gold'> = ['purple', 'pink', 'cyan', 'gold']

export const getConversations = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user?.userId || (req as any).user?.id

    if (!currentUserId) {
      return res.status(200).json({
        success: true,
        conversations: [],
      })
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
      },
      include: {
        user1: true,
        user2: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const formatted = conversations.map((conv, index) => {
      const partner = conv.user1Id === currentUserId ? conv.user2 : conv.user1

      const partnerName = partner
        ? partner.nickname || `${partner.firstName} ${partner.lastName}`.trim()
        : 'Usuario de LinkedSound'

      const lastMsg = conv.messages[0]
      const timeStr = lastMsg
        ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Reciente'

      const accent = ACCENT_COLORS[index % ACCENT_COLORS.length]

      // Solo es unread si el ultimo mensaje no fue leido y no fue enviado por el usuario actual
      const isUnread = Boolean(
        lastMsg &&
        !lastMsg.read &&
        lastMsg.senderId !== currentUserId
      )

      return {
        id: conv.id,
        name: partnerName,
        role: partner?.role || 'Artista',
        avatar: partnerName.slice(0, 2).toUpperCase(),
        accent,
        status: partner?.status === 'Active' ? 'Online' : 'Offline',
        preview: lastMsg?.text || 'Nueva conversación iniciada.',
        time: timeStr,
        unread: isUnread ? 1 : 0,
        pinned: conv.pinned,
        muted: conv.muted,
        blocked: conv.blocked,
        profileImage: partner?.profileImage || '',
        location: partner?.location || '',
      }
    })

    return res.status(200).json({
      success: true,
      conversations: formatted,
    })
  } catch (error: any) {
    console.error('Error al obtener conversaciones:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al consultar conversaciones.',
      error: error.message,
    })
  }
}

export const getMessages = async (req: Request, res: Response) => {
  try {
    const conversationId = String(req.params.id)
    const currentUserId = (req as any).user?.userId || (req as any).user?.id

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado.',
      })
    }

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
    })

    if (!conv) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada.',
      })
    }

    // Verificar que el usuario pertenezca estrictamente a la conversacion
    if (conv.user1Id !== currentUserId && conv.user2Id !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver esta conversación.',
      })
    }

    // Al abrir el chat, marcar los mensajes del otro usuario como leidos
    await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: currentUserId },
        read: false,
      },
      data: { read: true },
    })

    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    const formatted = messages.map((m) => {
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

    return res.status(200).json({
      success: true,
      messages: formatted,
    })
  } catch (error: any) {
    console.error('Error al obtener mensajes:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al consultar mensajes.',
      error: error.message,
    })
  }
}

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const conversationId = String(req.params.id)
    const { text, attachmentUrl, attachmentName, attachmentType, attachmentSize } = req.body

    if (!text && !attachmentUrl) {
      return res.status(400).json({
        success: false,
        message: 'No se puede enviar un mensaje vacío.',
      })
    }

    const currentUserId = (req as any).user?.userId || (req as any).user?.id
    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado.',
      })
    }

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
    })
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Conversación no encontrada.' })
    }

    // Verificar que el usuario pertenezca estrictamente a la conversacion
    if (conv.user1Id !== currentUserId && conv.user2Id !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'No puedes enviar mensajes en una conversación que no te pertenece.',
      })
    }

    const senderId = currentUserId

    // Subir archivo adjunto a Cloudinary si viene en formato base64
    let finalAttachmentUrl = attachmentUrl || null
    if (finalAttachmentUrl && typeof finalAttachmentUrl === 'string' && finalAttachmentUrl.startsWith('data:')) {
      finalAttachmentUrl = await uploadBase64ToCloudinary(finalAttachmentUrl, 'linkedsound/chat')
    }

    const created = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        text: String(text || '').trim(),
        attachmentUrl: finalAttachmentUrl,
        attachmentName: attachmentName || null,
        attachmentType: attachmentType || null,
        attachmentSize: attachmentSize || null,
        read: false,
      },
    })

    // Actualizar tiempo de última modificación en la conversación
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    const timeStr = new Date(created.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    return res.status(201).json({
      success: true,
      message: 'Mensaje enviado.',
      data: created,
      formattedMessage: {
        id: created.id,
        sender: 'me',
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
    })
  } catch (error: any) {
    console.error('Error al enviar mensaje:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al enviar el mensaje.',
      error: error.message,
    })
  }
}
