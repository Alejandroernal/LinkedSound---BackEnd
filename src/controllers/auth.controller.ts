import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { authService, formatUserResponse } from '../services/auth.service.js'

export { formatUserResponse }

export const register = async (req: Request, res: Response) => {
  try {
    const result = await authService.register(req.body)
    return res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      ...result,
    })
  } catch (error: any) {
    console.error('Error al registrar usuario:', error)
    const statusCode = error.statusCode || (error.message.includes('obligatorios') ? 400 : 500)
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error en el servidor al registrar el usuario',
      error: error.message,
    })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    const result = await authService.login(email, password)
    return res.status(200).json({
      success: true,
      message: 'Inicio de sesion exitoso',
      ...result,
    })
  } catch (error: any) {
    console.error('Error al iniciar sesion:', error)
    const statusCode = error.statusCode || (error.message.includes('ingresar') ? 400 : 500)
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error en el servidor al iniciar sesion',
      error: error.message,
    })
  }
}

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado',
      })
    }

    const user = await authService.getMe(userId)
    return res.status(200).json({
      success: true,
      user,
    })
  } catch (error: any) {
    console.error('Error al obtener perfil:', error)
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al obtener el perfil del usuario',
      error: error.message,
    })
  }
}

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado',
      })
    }

    const updatedUser = await authService.updateProfile(userId, req.body)
    return res.status(200).json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: updatedUser,
    })
  } catch (error: any) {
    console.error('Error al actualizar perfil:', error)
    const isValidation = error.message.includes('maximo') || error.message.includes('valida')
    const statusCode = error.statusCode || (isValidation ? 400 : 500)
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al actualizar el perfil',
      error: error.message,
    })
  }
}

export const getGenres = async (_req: Request, res: Response) => {
  try {
    const genres = await authService.getGenres()
    return res.status(200).json({
      success: true,
      genres,
    })
  } catch (error: any) {
    console.error('Error al obtener generos:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al obtener los generos',
      error: error.message,
    })
  }
}

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId
    const currentUserRole = req.user?.accountRole || req.user?.role
    const includeSelf = req.query.all === 'true'

    const users = await authService.getUsers(currentUserId, currentUserRole, includeSelf)
    return res.status(200).json({
      success: true,
      users,
    })
  } catch (error: any) {
    console.error('Error al obtener usuarios:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al consultar usuarios en la base de datos.',
      error: error.message,
    })
  }
}
