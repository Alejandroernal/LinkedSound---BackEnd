import { Router } from 'express'
import {
  getProfile,
  updateProfile,
  getGenres,
  getUsers,
} from '../controllers/perfiles.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

export const perfilesRouter = Router()

// Perfil propio o de otro creador
perfilesRouter.get('/me', authenticate, getProfile)
perfilesRouter.get('/genres', getGenres)
perfilesRouter.get('/users', authenticate, getUsers)
perfilesRouter.get('/:id', authenticate, getProfile)
perfilesRouter.put('/', authenticate, updateProfile)

