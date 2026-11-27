import { Router } from 'express'
import { getActivities, createActivity } from '../controllers/activity.controller.js'
import { authenticate, authorizeRole } from '../middlewares/auth.middleware.js'

export const activityRouter = Router()

// Registro de actividad y auditoria: exclusivo para administradores autenticados
activityRouter.get('/', authenticate, authorizeRole('Administrador'), getActivities)
activityRouter.post('/', authenticate, authorizeRole('Administrador'), createActivity)
