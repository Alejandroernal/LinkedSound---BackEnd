import type { Response } from 'express'
import { prisma } from '../config/prisma.js'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'

export const likeUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const senderId = req.user?.userId
    const { targetUserId } = req.body

    if (!senderId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado.' })
    }

    if (!targetUserId || typeof targetUserId !== 'string') {
      return res.status(400).json({ success: false, message: 'ID de usuario objetivo requerido.' })
    }

    if (senderId === targetUserId) {
      return res.status(400).json({ success: false, message: 'No puedes conectar contigo mismo.' })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        nickname: true,
        profileImage: true,
        role: true,
        location: true,
      },
    })

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Usuario objetivo no encontrado.' })
    }

    // Registrar el like del usuario actual
    await prisma.interaction.upsert({
      where: {
        senderId_receiverId: {
          senderId,
          receiverId: targetUserId,
        },
      },
      create: {
        senderId,
        receiverId: targetUserId,
        isLike: true,
      },
      update: {
        isLike: true,
      },
    })

    // Comprobar si el otro usuario ya le dio like al usuario actual previamente
    const targetInteraction = await prisma.interaction.findUnique({
      where: {
        senderId_receiverId: {
          senderId: targetUserId,
          receiverId: senderId,
        },
      },
    })

    const isMatch = Boolean(targetInteraction && targetInteraction.isLike === true)

    if (!isMatch) {
      return res.status(200).json({
        success: true,
        isMatch: false,
        message: 'Like registrado exitosamente. En espera de conexion mutua.',
      })
    }

    // HAY MATCH MUTUO: Crear Match y Conversacion persistente
    const [u1, u2] = [senderId, targetUserId].sort()

    const match = await prisma.match.upsert({
      where: {
        user1Id_user2Id: {
          user1Id: u1,
          user2Id: u2,
        },
      },
      create: {
        user1Id: u1,
        user2Id: u2,
        affinityPercent: '95%',
      },
      update: {},
    })

    const conversation = await prisma.conversation.upsert({
      where: {
        user1Id_user2Id: {
          user1Id: u1,
          user2Id: u2,
        },
      },
      create: {
        user1Id: u1,
        user2Id: u2,
      },
      update: {},
    })

    const currentUser = await prisma.user.findUnique({
      where: { id: senderId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        nickname: true,
      },
    })

    const targetDisplayName = targetUser.nickname || `${targetUser.firstName} ${targetUser.lastName}`.trim()
    const currentDisplayName = currentUser?.nickname || `${currentUser?.firstName} ${currentUser?.lastName}`.trim() || 'Un usuario'

    // Notificaciones de sistema en la base de datos
    await prisma.notification.createMany({
      data: [
        {
          userId: senderId,
          title: `Nuevo Match con ${targetDisplayName}`,
          message: `Has conectado con ${targetDisplayName}. Pueden conversar en Mensajes.`,
          type: 'match',
          linkPage: 'Messages',
        },
        {
          userId: targetUserId,
          title: `Nuevo Match con ${currentDisplayName}`,
          message: `Has conectado con ${currentDisplayName}. Pueden conversar en Mensajes.`,
          type: 'match',
          linkPage: 'Messages',
        },
      ],
    })

    return res.status(200).json({
      success: true,
      isMatch: true,
      message: 'Es un Match!',
      match,
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
      partner: targetUser,
    })
  } catch (error: any) {
    console.error('Error al registrar like:', error)
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor al registrar el like.',
      error: error.message,
    })
  }
}

export const passUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const senderId = req.user?.userId
    const { targetUserId } = req.body

    if (!senderId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado.' })
    }

    if (!targetUserId || typeof targetUserId !== 'string') {
      return res.status(400).json({ success: false, message: 'ID de usuario objetivo requerido.' })
    }

    await prisma.interaction.upsert({
      where: {
        senderId_receiverId: {
          senderId,
          receiverId: targetUserId,
        },
      },
      create: {
        senderId,
        receiverId: targetUserId,
        isLike: false,
      },
      update: {
        isLike: false,
      },
    })

    return res.status(200).json({
      success: true,
      isMatch: false,
      message: 'Descarte registrado.',
    })
  } catch (error: any) {
    console.error('Error al registrar descarte:', error)
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor al descartar.',
      error: error.message,
    })
  }
}

export const getMatches = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado.' })
    }

    const matches = await prisma.match.findMany({
      where: {
        OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
      },
      include: {
        user1: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
            profileImage: true,
            role: true,
            location: true,
          },
        },
        user2: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
            profileImage: true,
            role: true,
            location: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const formatted = matches.map((m) => {
      const partner = m.user1Id === currentUserId ? m.user2 : m.user1
      const partnerName = partner.nickname || `${partner.firstName} ${partner.lastName}`.trim()
      return {
        id: m.id,
        partnerId: partner.id,
        name: partnerName,
        role: partner.role || 'Artista',
        profileImage: partner.profileImage || '',
        location: partner.location || '',
        affinityPercent: m.affinityPercent || '95%',
        createdAt: m.createdAt,
      }
    })

    return res.status(200).json({
      success: true,
      matches: formatted,
    })
  } catch (error: any) {
    console.error('Error al obtener matches:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al consultar matches.',
      error: error.message,
    })
  }
}

export const getUserInteractions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId

    if (!currentUserId) {
      return res.status(200).json({ success: true, interactions: [] })
    }

    const interactions = await prisma.interaction.findMany({
      where: { senderId: currentUserId },
      select: {
        receiverId: true,
        isLike: true,
      },
    })

    return res.status(200).json({
      success: true,
      interactions,
    })
  } catch (error: any) {
    console.error('Error al obtener interacciones:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al consultar interacciones.',
      error: error.message,
    })
  }
}
