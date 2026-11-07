import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { interactionService } from '../services/interaction.service.js'

export const likeUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const senderId = req.user?.userId
    const { targetUserId } = req.body

    const result = await interactionService.likeUser(senderId!, targetUserId)
    return res.status(200).json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    console.error('Error al registrar like:', error)
    const isValidation = error.message.includes('requerido') ||
      error.message.includes('autenticado') ||
      error.message.includes('contigo mismo')
    const statusCode = isValidation ? 400 : error.message.includes('no encontrado') ? 404 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error en el servidor al registrar el like.',
      error: error.message,
    })
  }
}

export const passUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const senderId = req.user?.userId
    const { targetUserId } = req.body

    const result = await interactionService.passUser(senderId!, targetUserId)
    return res.status(200).json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    console.error('Error al registrar descarte:', error)
    const statusCode = error.message.includes('requerido') || error.message.includes('autenticado') ? 400 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error en el servidor al descartar.',
      error: error.message,
    })
  }
}

export const getMatches = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId
    const matches = await interactionService.getMatches(currentUserId!)
    return res.status(200).json({
      success: true,
      matches,
    })
  } catch (error: any) {
    console.error('Error al obtener matches:', error)
    const statusCode = error.message.includes('autenticado') ? 401 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al consultar matches.',
      error: error.message,
    })
  }
}

export const getUserInteractions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId
    const data = await interactionService.getUserInteractions(currentUserId!)
    return res.status(200).json({
      success: true,
      ...data,
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

export const resetInteractions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId
    const result = await interactionService.resetInteractions(currentUserId!)
    return res.status(200).json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    console.error('Error al reiniciar interacciones:', error)
    const statusCode = error.message.includes('autenticado') ? 401 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al reiniciar las interacciones de descubrimiento.',
      error: error.message,
    })
  }
}

export const unmatchUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId
    const { targetUserId } = req.body

    const result = await interactionService.unmatchUser(currentUserId!, targetUserId)
    return res.status(200).json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    console.error('Error al desconectar usuario:', error)
    const statusCode = error.message.includes('requerido') || error.message.includes('autenticado') ? 400 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al desconectar el usuario.',
      error: error.message,
    })
  }
}
