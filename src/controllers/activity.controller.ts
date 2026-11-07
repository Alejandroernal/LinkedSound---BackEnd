import type { Request, Response } from 'express'
import { activityService } from '../services/activity.service.js'

export const getActivities = async (_req: Request, res: Response) => {
  try {
    const activities = await activityService.getAllActivities()
    return res.status(200).json({
      success: true,
      activities,
    })
  } catch (error: any) {
    console.error('Error al obtener actividades:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al consultar logs de actividad.',
      error: error.message,
    })
  }
}

export const createActivity = async (req: Request, res: Response) => {
  try {
    const { action, module = 'Sistema' } = req.body
    const userId = (req as any).user?.userId || (req as any).user?.id || req.body.userId

    const activity = await activityService.logActivity({
      userId,
      action,
      ip: req.ip || '127.0.0.1',
      device: (req.headers['user-agent'] as string) || 'Web Browser',
      module,
    })

    return res.status(201).json({
      success: true,
      activity,
    })
  } catch (error: any) {
    console.error('Error al registrar actividad:', error)
    const statusCode = error.message.includes('obligatoria') || error.message.includes('disponibles') ? 400 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al guardar la actividad en la base de datos.',
      error: error.message,
    })
  }
}
