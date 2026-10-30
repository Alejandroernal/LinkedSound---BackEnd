import type { Response } from 'express'
import { prisma } from '../config/prisma.js'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'Justo ahora'
  if (diffMin < 60) return `Hace ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`
  if (diffHour < 24) return `Hace ${diffHour} ${diffHour === 1 ? 'hora' : 'horas'}`
  return `Hace ${diffDay} ${diffDay === 1 ? 'dia' : 'dias'}`
}

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado.' })
    }

    const notifs = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 40,
    })

    const formatted = notifs.map((n: any) => {
      const isReadVal = n.isRead !== undefined ? n.isRead : Boolean(n.read)
      return {
        id: n.id,
        title: n.title,
        message: n.message,
        read: isReadVal,
        isRead: isReadVal,
        readAt: n.readAt,
        type: n.type,
        linkPage: n.linkPage || 'Discovery',
        timestamp: formatRelativeTime(n.createdAt),
        createdAt: n.createdAt,
      }
    })

    return res.status(200).json({
      success: true,
      notifications: formatted,
    })
  } catch (error: any) {
    console.error('Error al obtener notificaciones:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al consultar notificaciones.',
      error: error.message,
    })
  }
}

export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    const { id } = req.params

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado.' })
    }

    const notifId = Array.isArray(id) ? id[0] : id
    const now = new Date()

    await prisma.notification.updateMany({
      where: {
        id: notifId,
        userId,
      },
      data: {
        isRead: true,
        readAt: now,
      } as any,
    })

    return res.status(200).json({
      success: true,
      message: 'Notificacion marcada como leida.',
    })
  } catch (error: any) {
    console.error('Error al marcar notificacion como leida:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar notificacion.',
      error: error.message,
    })
  }
}

export const markAllAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado.' })
    }

    const now = new Date()
    await prisma.notification.updateMany({
      where: { userId },
      data: {
        isRead: true,
        readAt: now,
      } as any,
    })

    return res.status(200).json({
      success: true,
      message: 'Todas las notificaciones marcadas como leidas.',
    })
  } catch (error: any) {
    console.error('Error al marcar todas las notificaciones como leidas:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar notificaciones.',
      error: error.message,
    })
  }
}

export const clearNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado.' })
    }

    await prisma.notification.deleteMany({
      where: { userId },
    })

    return res.status(200).json({
      success: true,
      message: 'Notificaciones eliminadas correctamente.',
    })
  } catch (error: any) {
    console.error('Error al limpiar notificaciones:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar notificaciones.',
      error: error.message,
    })
  }
}
