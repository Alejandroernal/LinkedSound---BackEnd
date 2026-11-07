import type { Request, Response } from 'express'
import { eventService, formatEventResponse } from '../services/event.service.js'

export { formatEventResponse }

export const getEvents = async (_req: Request, res: Response) => {
  try {
    const events = await eventService.getAllEvents()
    return res.status(200).json({
      success: true,
      events,
    })
  } catch (error: any) {
    console.error('Error al obtener eventos:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al consultar los eventos en la base de datos.',
      error: error.message,
    })
  }
}

export const createEvent = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user?.userId || (req as any).user?.id
    const newEvent = await eventService.createEvent(currentUserId, req.body)

    return res.status(201).json({
      success: true,
      message: 'Evento creado exitosamente',
      event: newEvent,
    })
  } catch (error: any) {
    console.error('Error al crear evento:', error)
    const isValidation = error.message.includes('obligatorios') ||
      error.message.includes('formato') ||
      error.message.includes('caracteres') ||
      error.message.includes('dígitos') ||
      error.message.includes('imagen')
    const statusCode = isValidation ? 400 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error en el servidor al crear el evento.',
      error: error.message,
    })
  }
}

export const updateEvent = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const currentUserId = (req as any).user?.userId || (req as any).user?.id
    const currentUserRole = (req as any).user?.accountRole || (req as any).user?.role

    const updated = await eventService.updateEvent(id, currentUserId, currentUserRole, req.body)
    return res.status(200).json({
      success: true,
      message: 'Evento actualizado exitosamente',
      event: updated,
    })
  } catch (error: any) {
    console.error('Error al actualizar evento:', error)
    const isNotFound = error.message.includes('no encontrado')
    const isForbidden = error.message.includes('permisos')
    const statusCode = isNotFound ? 404 : isForbidden ? 403 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al actualizar el evento.',
      error: error.message,
    })
  }
}

export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const currentUserId = (req as any).user?.userId || (req as any).user?.id
    const currentUserRole = (req as any).user?.accountRole || (req as any).user?.role

    const result = await eventService.deleteEvent(id, currentUserId, currentUserRole)
    return res.status(200).json({
      success: true,
      message: result.message,
    })
  } catch (error: any) {
    console.error('Error al eliminar evento:', error)
    const isNotFound = error.message.includes('no encontrado')
    const isForbidden = error.message.includes('permisos')
    const statusCode = isNotFound ? 404 : isForbidden ? 403 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al eliminar el evento.',
      error: error.message,
    })
  }
}

export const addEventComment = async (req: Request, res: Response) => {
  try {
    const eventId = String(req.params.id)
    const currentUserId = (req as any).user?.userId || (req as any).user?.id
    const { content } = req.body

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado.' })
    }

    const comment = await eventService.addComment(eventId, currentUserId, content)
    return res.status(201).json({
      success: true,
      comment,
    })
  } catch (error: any) {
    console.error('Error al agregar comentario:', error)
    const statusCode = error.message.includes('vacío') ? 400 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al registrar el comentario.',
      error: error.message,
    })
  }
}

export const deleteEventComment = async (req: Request, res: Response) => {
  try {
    const commentId = String(req.params.commentId)
    const currentUserId = (req as any).user?.userId || (req as any).user?.id
    const currentUserRole = (req as any).user?.accountRole || (req as any).user?.role

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado.' })
    }

    const result = await eventService.deleteComment(commentId, currentUserId, currentUserRole)
    return res.status(200).json({
      success: true,
      message: result.message,
    })
  } catch (error: any) {
    console.error('Error al eliminar comentario:', error)
    const isNotFound = error.message.includes('no encontrado')
    const isForbidden = error.message.includes('permisos')
    const statusCode = isNotFound ? 404 : isForbidden ? 403 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al eliminar el comentario.',
      error: error.message,
    })
  }
}
