import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import { config } from './config/environment.js'
import { apiRouter } from './routes/index.js'
import { errorHandler } from './middlewares/errorHandler.js'

export const createApp = (): Application => {
  const app = express()

  // Middlewares globales
  app.use(
    cors({
      origin: config.clientUrl,
      credentials: true,
    })
  )
  app.use(express.json({ limit: '50mb' }))
  app.use(express.urlencoded({ extended: true, limit: '50mb' }))

  // Rutas base de la API
  app.use('/api', apiRouter)

  // Manejo de rutas no encontradas (404)
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      status: 404,
      message: 'Route not found',
    })
  })

  // Middleware de gestion de errores
  app.use(errorHandler)

  return app
}
