import { Router } from 'express'
import {
  getUserConversations,
  getConversationMessages,
  sendMessage,
  updateConversationStatus,
  deleteConversation,
} from '../controllers/mensajes.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

export const mensajesRouter = Router()

mensajesRouter.use(authenticate)

mensajesRouter.get('/', getUserConversations)
mensajesRouter.get('/:id/messages', getConversationMessages)
mensajesRouter.post('/:id/messages', sendMessage)
mensajesRouter.patch('/:id', updateConversationStatus)
mensajesRouter.delete('/:id', deleteConversation)

