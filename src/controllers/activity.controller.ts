import type { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'

export const getActivities = async (_req: Request, res: Response) => {
  try {
    const activities = await prisma.userActivityLog.findMany({
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    })

    const formatted = activities.map((act) => {
      const createdDate = new Date(act.createdAt)
      const day = String(createdDate.getDate()).padStart(2, '0')
      const month = String(createdDate.getMonth() + 1).padStart(2, '0')
      const year = createdDate.getFullYear()
      const hours = String(createdDate.getHours()).padStart(2, '0')
      const minutes = String(createdDate.getMinutes()).padStart(2, '0')
      const seconds = String(createdDate.getSeconds()).padStart(2, '0')
      const exactFormatted = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`

      const userName = act.user
        ? act.user.role === 'Administrador'
          ? `Administrador (${act.user.nickname || 'Admin'})`
          : act.user.nickname || `${act.user.firstName} ${act.user.lastName}`.trim()
        : 'Sistema'

      return {
        id: act.id,
        user: userName,
        action: act.action,
        timestamp: 'Reciente',
        exactTimestamp: exactFormatted,
        ip: act.ip || '127.0.0.1',
        device: act.device || 'Navegador Web',
        module: (act.module || 'Sistema') as 'Perfil' | 'Explorer' | 'Sistema',
      }
    })

    return res.status(200).json({
      success: true,
      activities: formatted,
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

    if (!action) {
      return res.status(400).json({
        success: false,
        message: 'La acción es obligatoria para registrar en el log.',
      })
    }

    let userId = (req as any).user?.id

    if (!userId) {
      const activeUser = await prisma.user.findFirst({
        where: { status: 'Active' },
      })
      if (activeUser) {
        userId = activeUser.id
      } else {
        return res.status(400).json({
          success: false,
          message: 'No hay usuarios para asociar la actividad.',
        })
      }
    }

    const newLog = await prisma.userActivityLog.create({
      data: {
        userId,
        action: String(action).trim(),
        ip: req.ip || '127.0.0.1',
        device: (req.headers['user-agent'] as string) || 'Web Browser',
        module: String(module).trim(),
      },
    })

    return res.status(201).json({
      success: true,
      activity: newLog,
    })
  } catch (error: any) {
    console.error('Error al registrar actividad:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al guardar la actividad en la base de datos.',
      error: error.message,
    })
  }
}
