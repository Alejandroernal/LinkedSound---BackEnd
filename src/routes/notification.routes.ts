import { Router } from 'express'
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearNotifications,
} from '../controllers/notification.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

export const notificationRouter = Router()

notificationRouter.get('/', authenticate, getNotifications)
notificationRouter.patch('/:id/read', authenticate, markAsRead)
notificationRouter.patch('/read-all', authenticate, markAllAsRead)
notificationRouter.delete('/', authenticate, clearNotifications)
