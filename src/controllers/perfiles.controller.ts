import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { perfilesService, sanitizePublicProfile } from '../services/perfiles.service.js'

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = (req.params.id ? String(req.params.id) : null) || req.user?.userId
    if (!userId) {
      return res.status(400).json({ success: false, message: 'ID de usuario no proporcionado' })
    }

    const user = await perfilesService.getProfileById(userId)
    if (!user) {
      return res.status(404).json({ success: false, message: 'Perfil no encontrado' })
    }

    const isSelf = req.user?.userId === userId
    const isAdmin = req.user?.accountRole === 'Administrador'
    const safeUser = isSelf || isAdmin ? user : sanitizePublicProfile(user)

    return res.status(200).json({ success: true, user: safeUser })
  } catch (error: any) {
    console.error('Error al obtener perfil:', error)
    return res.status(500).json({ success: false, message: error.message || 'Error al obtener perfil' })
  }
}

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    }

    const updatedUser = await perfilesService.updateProfile(userId, req.body)
    return res.status(200).json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: updatedUser,
    })
  } catch (error: any) {
    console.error('Error al actualizar perfil:', error)
    const isValidation =
      error.message.includes('maximo') ||
      error.message.includes('valida') ||
      error.message.includes('valido') ||
      error.message.includes('obligatorio')
    const isConflict = error.message.includes('ya esta')
    const statusCode = error.statusCode || (isConflict ? 409 : isValidation ? 400 : 500)
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al actualizar el perfil',
      error: error.message,
    })
  }
}

export const getGenres = async (_req: Request, res: Response) => {
  try {
    const genres = await perfilesService.getGenres()
    return res.status(200).json({ success: true, genres })
  } catch (error: any) {
    console.error('Error al obtener generos:', error)
    return res.status(500).json({ success: false, message: 'Error al obtener generos', error: error.message })
  }
}

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId
    const isAdmin = req.user?.accountRole === 'Administrador'
    const requestedAll = req.query.all === 'true'

    if (requestedAll && !isAdmin) {
      return res.status(403).json({
        success: false,
        status: 403,
        message: 'Acceso denegado. Se requieren permisos de Administrador para listar todos los usuarios.',
      })
    }

    const currentUserRole = isAdmin ? 'Administrador' : req.user?.role
    const users = await perfilesService.getUsers(currentUserId, currentUserRole, isAdmin && requestedAll)
    return res.status(200).json({ success: true, users })
  } catch (error: any) {
    console.error('Error al listar creadores:', error)
    return res.status(500).json({ success: false, message: 'Error al listar usuarios', error: error.message })
  }
}

export const updateUserStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminUserId = req.user?.userId || ''
    const targetUserId = String(req.params.id)
    const { status, justification } = req.body

    const updatedUser = await perfilesService.updateUserStatus(adminUserId, targetUserId, status, justification)
    return res.status(200).json({
      success: true,
      message: 'Estado de cuenta actualizado exitosamente',
      user: updatedUser,
    })
  } catch (error: any) {
    console.error('Error al actualizar estado de cuenta:', error)
    const isValidation = error.message.includes('obligatoria') || error.message.includes('invalido')
    const isNotFound = error.message.includes('no encontrado')
    const statusCode = isNotFound ? 404 : isValidation ? 400 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al actualizar estado del usuario',
      error: error.message,
    })
  }
}

export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminUserId = req.user?.userId || ''
    const targetUserId = String(req.params.id)

    const result = await perfilesService.deleteUser(adminUserId, targetUserId)
    return res.status(200).json(result)
  } catch (error: any) {
    console.error('Error al dar de baja usuario:', error)
    const isNotFound = error.message.includes('no encontrado')
    return res.status(isNotFound ? 404 : 500).json({
      success: false,
      message: error.message || 'Error al dar de baja el usuario',
      error: error.message,
    })
  }
}
