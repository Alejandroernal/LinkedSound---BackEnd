import { Router } from 'express'
import {
  getProfile,
  updateProfile,
  getGenres,
  getUsers,
  updateUserStatus,
  deleteUser,
} from '../controllers/perfiles.controller.js'
import { authenticate, authorizeRole } from '../middlewares/auth.middleware.js'

export const perfilesRouter = Router()

// Perfil propio o de otro creador
perfilesRouter.get('/me', authenticate, getProfile)
perfilesRouter.get('/genres', getGenres)
perfilesRouter.get('/users', authenticate, getUsers)
perfilesRouter.get('/:id', authenticate, getProfile)
perfilesRouter.put('/', authenticate, updateProfile)

// Administracion de cuentas: suspension, reactivacion o baja
perfilesRouter.patch('/:id/status', authenticate, authorizeRole('Administrador'), updateUserStatus)
perfilesRouter.delete('/:id', authenticate, authorizeRole('Administrador'), deleteUser)

