import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { notificationService } from '../services/notification.service.js'

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado.' })
    }

    const notifications = await notificationService.getUserNotifications(userId)
    return res.status(200).json({
      success: true,
      notifications,
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
    await notificationService.markAsRead(userId, notifId)

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

    await notificationService.markAllAsRead(userId)

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

    await notificationService.clearNotifications(userId)

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
