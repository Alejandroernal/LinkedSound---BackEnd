import { Router } from 'express'
import { healthRouter } from './health.routes.js'
import { authRouter } from './auth.routes.js'
import { uploadRouter } from './upload.routes.js'
import { eventRouter } from './event.routes.js'
import { reportRouter } from './report.routes.js'
import { activityRouter } from './activity.routes.js'
import { conversationRouter } from './conversation.routes.js'
import { interactionRouter } from './interaction.routes.js'

export const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/upload', uploadRouter)
apiRouter.use('/events', eventRouter)
apiRouter.use('/reports', reportRouter)
apiRouter.use('/activity', activityRouter)
apiRouter.use('/conversations', conversationRouter)
apiRouter.use('/interactions', interactionRouter)
