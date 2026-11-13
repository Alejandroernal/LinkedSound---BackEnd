import { Router } from 'express'
import { buscar } from '../controllers/busqueda.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

export const busquedaRouter = Router()

// Búsqueda avanzada y geoespacial por radio (PostGIS)
busquedaRouter.get('/', authenticate, buscar)

