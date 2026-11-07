import type { Request, Response } from 'express'
import { conversationService } from '../services/conversation.service.js'

export const getConversations = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user?.userId || (req as any).user?.id
    const conversations = await conversationService.getConversations(currentUserId)
    return res.status(200).json({
      success: true,
      conversations,
    })
  } catch (error: any) {
    console.error('Error al obtener conversaciones:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al consultar conversaciones.',
      error: error.message,
    })
  }
}

export const getMessages = async (req: Request, res: Response) => {
  try {
    const conversationId = String(req.params.id)
    const currentUserId = (req as any).user?.userId || (req as any).user?.id

    const messages = await conversationService.getMessages(conversationId, currentUserId)
    return res.status(200).json({
      success: true,
      messages,
    })
  } catch (error: any) {
    console.error('Error al obtener mensajes:', error)
    const isAuth = error.message.includes('autenticado')
    const isForbidden = error.message.includes('permiso')
    const isNotFound = error.message.includes('no encontrada')
    const statusCode = isAuth ? 401 : isForbidden ? 403 : isNotFound ? 404 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al consultar mensajes.',
      error: error.message,
    })
  }
}

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const conversationId = String(req.params.id)
    const currentUserId = (req as any).user?.userId || (req as any).user?.id
    const { text, attachmentUrl, attachmentName, attachmentType, attachmentSize } = req.body

    const result = await conversationService.sendMessage(conversationId, currentUserId, {
      text,
      attachmentUrl,
      attachmentName,
      attachmentType,
      attachmentSize,
    })

    return res.status(201).json({
      success: true,
      message: 'Mensaje enviado.',
      data: result.created,
      formattedMessage: result.formattedMessage,
    })
  } catch (error: any) {
    console.error('Error al enviar mensaje:', error)
    const isAuth = error.message.includes('autenticado')
    const isForbidden = error.message.includes('pertenece')
    const isNotFound = error.message.includes('no encontrada')
    const isBlocked = error.message.includes('bloqueada')
    const isBad = error.message.includes('vacío')
    const statusCode = isAuth ? 401 : isForbidden ? 403 : isNotFound ? 404 : (isBlocked || isBad) ? 400 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al enviar el mensaje.',
      error: error.message,
    })
  }
}

export const deleteConversation = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user?.userId || (req as any).user?.id
    const id = String(req.params.id)

    const result = await conversationService.deleteConversation(id, currentUserId)
    return res.status(200).json({
      success: true,
      message: result.message,
    })
  } catch (error: any) {
    console.error('Error al desconectar y eliminar conversación/match:', error)
    const isAuth = error.message.includes('autenticado')
    const isForbidden = error.message.includes('autorización')
    const isNotFound = error.message.includes('no encontrada')
    const statusCode = isAuth ? 401 : isForbidden ? 403 : isNotFound ? 404 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error en el servidor al desconectar el usuario.',
      error: error.message,
    })
  }
}

export const updateConversation = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const currentUserId = (req as any).user?.userId || (req as any).user?.id
    const { blocked, pinned, muted } = req.body

    const updated = await conversationService.updateConversationSettings(id, currentUserId, {
      blocked,
      pinned,
      muted,
    })

    return res.status(200).json({
      success: true,
      message: 'Conversación actualizada correctamente.',
      conversation: updated,
    })
  } catch (error: any) {
    console.error('Error al actualizar conversación:', error)
    const isAuth = error.message.includes('autenticado')
    const isForbidden = error.message.includes('autorización')
    const isNotFound = error.message.includes('no encontrada')
    const statusCode = isAuth ? 401 : isForbidden ? 403 : isNotFound ? 404 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error en el servidor al actualizar la conversación.',
      error: error.message,
    })
  }
}
