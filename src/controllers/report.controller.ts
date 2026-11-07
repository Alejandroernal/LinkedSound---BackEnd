import type { Request, Response } from 'express'
import { reportService } from '../services/report.service.js'

export const getReports = async (_req: Request, res: Response) => {
  try {
    const reports = await reportService.getAllReports()
    return res.status(200).json({
      success: true,
      reports,
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

    const reporterUserId = (req as any).user?.userId || (req as any).user?.id || req.body.reporterUserId

    const createdReport = await reportService.createReport({
      reporterUserId,
      targetName,
      targetType,
      reason,
      details,
      severity,
      origin,
    })

    return res.status(201).json({
      success: true,
      message: 'Reporte registrado exitosamente en la base de datos.',
      report: createdReport,
    })
  } catch (error: any) {
    console.error('Error al crear reporte:', error)
    const isValidationError = error.message.includes('obligatorios') ||
      error.message.includes('vincularse') ||
      error.message.includes('disponibles')
    return res.status(isValidationError ? 400 : 500).json({
      success: false,
      message: error.message || 'Error al registrar el reporte en la base de datos.',
      error: error.message,
    })
  }
}

export const updateReport = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { status, adminComment, severity } = req.body

    const updated = await reportService.updateReport({
      id,
      status,
      adminComment,
      severity,
    })

    return res.status(200).json({
      success: true,
      message: 'Reporte actualizado exitosamente.',
      report: updated,
    })
  } catch (error: any) {
    console.error('Error al actualizar reporte:', error)
    const isNotFound = error.message.includes('no encontrado')
    const isValidation = error.message.includes('obligatorio')
    const statusCode = isNotFound ? 404 : isValidation ? 400 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al actualizar el reporte.',
      error: error.message,
    })
  }
}
