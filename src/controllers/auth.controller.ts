import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { authService, formatUserResponse } from '../services/auth.service.js'
import {
  updateProfile as updateProfilePerfiles,
  getGenres as getGenresPerfiles,
  getUsers as getUsersPerfiles,
} from './perfiles.controller.js'

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

    const user = await authService.getUserById(userId)
    return res.status(200).json({
      success: true,
      user,
    })
  } catch (error: any) {
    console.error('Error al obtener usuario autenticado:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener datos del usuario',
    })
  }
}

export const updateProfile = updateProfilePerfiles
export const getGenres = getGenresPerfiles
export const getUsers = getUsersPerfiles
