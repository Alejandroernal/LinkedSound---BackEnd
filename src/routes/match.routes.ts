import { Router } from 'express'
import {
  likeUser,
  passUser,
  unmatch,
  getMatches,
  getUserInteractions,
  resetInteractions,
  getAffinityPreview,
} from '../controllers/match.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

export const matchRouter = Router()

matchRouter.use(authenticate)

matchRouter.post('/like', likeUser)
matchRouter.post('/pass', passUser)
matchRouter.post('/unmatch', unmatch)
matchRouter.get('/matches', getMatches)
matchRouter.get('/status', getUserInteractions)
matchRouter.post('/reset', resetInteractions)
matchRouter.post('/afinidad', getAffinityPreview)

