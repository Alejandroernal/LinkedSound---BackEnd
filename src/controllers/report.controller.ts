import type { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'

export const getReports = async (_req: Request, res: Response) => {
  try {
    const reports = await prisma.userReport.findMany({
      include: {
        reporter: {
          select: {
            id: true,
            nickname: true,
            firstName: true,
            lastName: true,
          },
        },
        reportedUser: {
          select: {
            id: true,
            nickname: true,
            firstName: true,
            lastName: true,
          },
        },
        reportedEvent: {
          select: {
            id: true,
            title: true,
            nickname: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const formatted = reports.map((r) => {
      const reporterName = r.reporter
        ? r.reporter.nickname || `${r.reporter.firstName} ${r.reporter.lastName}`.trim()
        : 'Usuario Anónimo'

      let reportedTargetName = 'Desconocido'
      if (r.targetType === 'Evento' && r.reportedEvent) {
        reportedTargetName = r.reportedEvent.title || r.reportedEvent.nickname
      } else if (r.reportedUser) {
        reportedTargetName = r.reportedUser.nickname || `${r.reportedUser.firstName} ${r.reportedUser.lastName}`.trim()
      }

      const createdDate = new Date(r.createdAt)
      const day = String(createdDate.getDate()).padStart(2, '0')
      const month = String(createdDate.getMonth() + 1).padStart(2, '0')
      const year = createdDate.getFullYear()
      const formattedDate = `${year}-${month}-${day}`

      return {
        id: r.id,
        reporterUser: reporterName,
        reportedUser: reportedTargetName,
        reportedUserId: r.reportedUserId,
        reportedEventId: r.reportedEventId,
        reason: r.reason,
        details: r.details,
        date: formattedDate,
        status: r.status as 'Pending' | 'Resolved' | 'Dismissed',
        severity: r.severity as 'Low' | 'Medium' | 'High',
        origin: r.origin as 'Discovery' | 'Explorer',
        targetType: r.targetType as 'Perfil' | 'Evento',
        adminComment: r.adminComment || undefined,
      }
    })

    return res.status(200).json({
      success: true,
      reports: formatted,
    })
  } catch (error: any) {
    console.error('Error al obtener reportes:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al consultar los reportes en la base de datos.',
      error: error.message,
    })
  }
}

export const createReport = async (req: Request, res: Response) => {
  try {
    const {
      targetName,
      targetType = 'Perfil',
      reason,
      details,
      severity = 'Medium',
      origin = 'Discovery',
    } = req.body

    if (!reason || !details) {
      return res.status(400).json({
        success: false,
        message: 'Motivo y detalles son obligatorios para enviar el reporte.',
      })
    }

    // Reporter: usuario autenticado o primer usuario activo
    let reporterUserId = (req as any).user?.id

    if (!reporterUserId) {
      const activeUser = await prisma.user.findFirst({
        where: { status: 'Active' },
      })
      if (activeUser) {
        reporterUserId = activeUser.id
      } else {
        return res.status(400).json({
          success: false,
          message: 'No hay usuarios registrados para asociar el reporte.',
        })
      }
    }

    // Buscar si el objetivo corresponde a un usuario o a un evento
    let reportedUserId: string | null = null
    let reportedEventId: string | null = null

    if (targetType === 'Evento') {
      const foundEvent = await prisma.event.findFirst({
        where: {
          OR: [
            { title: { equals: targetName, mode: 'insensitive' } },
            { nickname: { equals: targetName, mode: 'insensitive' } },
          ],
        },
      })
      if (foundEvent) {
        reportedEventId = foundEvent.id
      }
    } else {
      const foundUser = await prisma.user.findFirst({
        where: {
          OR: [
            { nickname: { equals: targetName, mode: 'insensitive' } },
            { firstName: { equals: targetName, mode: 'insensitive' } },
          ],
        },
      })
      if (foundUser) {
        reportedUserId = foundUser.id
      }
    }

    const createdReport = await prisma.userReport.create({
      data: {
        reporterUserId,
        reportedUserId,
        reportedEventId,
        reason: reason.trim(),
        details: details.trim(),
        severity,
        origin,
        targetType: targetType === 'Evento' ? 'Evento' : 'Perfil',
        status: 'Pending',
      },
    })

    return res.status(201).json({
      success: true,
      message: 'Reporte registrado exitosamente en la base de datos.',
      report: createdReport,
    })
  } catch (error: any) {
    console.error('Error al crear reporte:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al registrar el reporte en la base de datos.',
      error: error.message,
    })
  }
}

export const updateReport = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { status, adminComment, severity } = req.body

    const existing = await prisma.userReport.findUnique({
      where: { id },
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado.',
      })
    }

    const updated = await prisma.userReport.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(adminComment !== undefined ? { adminComment } : {}),
        ...(severity ? { severity } : {}),
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Reporte actualizado exitosamente.',
      report: updated,
    })
  } catch (error: any) {
    console.error('Error al actualizar reporte:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar el reporte.',
      error: error.message,
    })
  }
}
