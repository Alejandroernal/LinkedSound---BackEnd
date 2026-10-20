import { Router } from 'express'
import { getActivities, createActivity } from '../controllers/activity.controller.js'
import { optionalAuthenticate } from '../middlewares/auth.middleware.js'

export const activityRouter = Router()

activityRouter.get('/', getActivities)
activityRouter.post('/', optionalAuthenticate, createActivity)
