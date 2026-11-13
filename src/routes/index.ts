import { Router } from 'express'
import { healthRouter } from './health.routes.js'
import { authRouter } from './auth.routes.js'
import { perfilesRouter } from './perfiles.routes.js'
import { matchRouter } from './match.routes.js'
import { busquedaRouter } from './busqueda.routes.js'
import { mensajesRouter } from './mensajes.routes.js'
import { uploadRouter } from './upload.routes.js'
import { eventRouter } from './event.routes.js'
import { reportRouter } from './report.routes.js'
import { activityRouter } from './activity.routes.js'
import { notificationRouter } from './notification.routes.js'
import { trackRouter } from './track.routes.js'

export const apiRouter = Router()

// 1. Módulos Nucleares según Arquitectura Unificada
apiRouter.use('/auth', authRouter)
apiRouter.use('/perfiles', perfilesRouter)
apiRouter.use('/match', matchRouter)
apiRouter.use('/busqueda', busquedaRouter)
apiRouter.use('/mensajes', mensajesRouter)

// 2. Compatibilidad y Aliases REST
apiRouter.use('/interactions', matchRouter)
apiRouter.use('/conversations', mensajesRouter)
apiRouter.use('/search', busquedaRouter)

// 3. Módulos Complementarios
apiRouter.use('/events', eventRouter)
apiRouter.use('/tracks', trackRouter)
apiRouter.use('/reports', reportRouter)
apiRouter.use('/activity', activityRouter)
apiRouter.use('/notifications', notificationRouter)
apiRouter.use('/upload', uploadRouter)
apiRouter.use('/health', healthRouter)
