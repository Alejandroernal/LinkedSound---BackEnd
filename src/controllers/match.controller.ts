import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { matchService, calculateAffinity, calculateProximity } from '../services/match.service.js'

export const likeUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const senderId = req.user?.userId
    if (!senderId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    }

    const { targetUserId } = req.body
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'targetUserId es requerido' })
    }

    const result = await matchService.likeUser(senderId, targetUserId)
    return res.status(200).json({ success: true, ...result })
  } catch (error: any) {
    console.error('Error al dar like:', error)
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error al procesar like' })
  }
}

export const passUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const senderId = req.user?.userId
    if (!senderId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    }

    const { targetUserId } = req.body
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'targetUserId es requerido' })
    }

    const result = await matchService.passUser(senderId, targetUserId)
    return res.status(200).json({ success: true, ...result })
  } catch (error: any) {
    console.error('Error al pasar perfil:', error)
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error al procesar pase' })
  }
}

export const unmatch = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const senderId = req.user?.userId
    if (!senderId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    }

    const { targetUserId } = req.body
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'targetUserId es requerido' })
    }

    const result = await matchService.unmatch(senderId, targetUserId)
    return res.status(200).json(result)
  } catch (error: any) {
    console.error('Error al deshacer match:', error)
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error al deshacer match' })
  }
}

export const getMatches = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    }

    const matches = await matchService.getMatches(userId)
    return res.status(200).json({ success: true, matches })
  } catch (error: any) {
    console.error('Error al obtener matches:', error)
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error al obtener matches' })
  }
}

export const getUserInteractions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    }

    const status = await matchService.getUserInteractions(userId)
    return res.status(200).json({ success: true, ...status })
  } catch (error: any) {
    console.error('Error al obtener interacciones:', error)
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error al consultar interacciones' })
  }
}

export const resetInteractions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    }

    const result = await matchService.resetInteractions(userId)
    return res.status(200).json(result)
  } catch (error: any) {
    console.error('Error al resetear interacciones:', error)
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error al resetear interacciones' })
  }
}

export const getAffinityPreview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userA, userB } = req.body
    if (!userA || !userB) {
      return res.status(400).json({ success: false, message: 'userA y userB son requeridos' })
    }

    const proximity = calculateProximity(userA.latitude, userA.longitude, userB.latitude, userB.longitude)
    const distanceKm = proximity.distanceKm >= 0 ? proximity.distanceKm : null
    const affinity = calculateAffinity(userA, userB, distanceKm)

    return res.status(200).json({ success: true, affinity, proximity })
  } catch (error: any) {
    console.error('Error al calcular afinidad:', error)
    return res.status(500).json({ success: false, message: 'Error al calcular afinidad' })
  }
}

