import { Router } from 'express'
import { getConversations, getMessages, sendMessage } from '../controllers/conversation.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

export const conversationRouter = Router()

conversationRouter.get('/', authenticate, getConversations)
conversationRouter.get('/:id/messages', authenticate, getMessages)
conversationRouter.post('/:id/messages', authenticate, sendMessage)
