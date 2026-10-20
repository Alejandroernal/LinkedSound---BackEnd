import { Router } from 'express'
import { likeUser, passUser, getMatches, getUserInteractions } from '../controllers/interaction.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

export const interactionRouter = Router()

interactionRouter.post('/like', authenticate, likeUser)
interactionRouter.post('/pass', authenticate, passUser)
interactionRouter.get('/matches', authenticate, getMatches)
interactionRouter.get('/status', authenticate, getUserInteractions)
