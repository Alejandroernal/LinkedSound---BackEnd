import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { mensajesService } from '../services/mensajes.service.js'

export const getUserConversations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    }

    const conversations = await mensajesService.getUserConversations(userId)
    return res.status(200).json({ success: true, conversations })
  } catch (error: any) {
    console.error('Error al obtener conversaciones:', error)
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error al obtener conversaciones' })
  }
}

export const getConversationMessages = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    }

    const conversationId = String(req.params.id)
    const messages = await mensajesService.getConversationMessages(userId, conversationId)
    return res.status(200).json({ success: true, messages })
  } catch (error: any) {
    console.error('Error al obtener mensajes:', error)
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error al obtener mensajes' })
  }
}

export const sendMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    }

    const conversationId = String(req.params.id)
    const newMsg = await mensajesService.sendMessage(userId, conversationId, req.body)
    return res.status(201).json({ success: true, message: 'Mensaje enviado', data: newMsg, formattedMessage: newMsg })
  } catch (error: any) {
    console.error('Error al enviar mensaje:', error)
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error al enviar mensaje' })
  }
}

export const updateConversationStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    }

    const conversationId = String(req.params.id)
    const updated = await mensajesService.updateConversationStatus(userId, conversationId, req.body)
    return res.status(200).json({ success: true, conversation: updated })
  } catch (error: any) {
    console.error('Error al actualizar estado de conversacion:', error)
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error al actualizar conversacion' })
  }
}

export const deleteConversation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    }

    const conversationId = String(req.params.id)
    const result = await mensajesService.deleteConversation(userId, conversationId)
    return res.status(200).json(result)
  } catch (error: any) {
    console.error('Error al eliminar conversacion:', error)
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error al eliminar conversacion' })
  }
}
