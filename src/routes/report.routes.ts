import { Router } from 'express'
import { getReports, createReport, updateReport } from '../controllers/report.controller.js'
import { authenticate, authorizeRole } from '../middlewares/auth.middleware.js'

export const reportRouter = Router()

// Consultar reportes: exclusivo para administradores
reportRouter.get('/', authenticate, authorizeRole('Administrador'), getReports)

// Crear reporte: disponible para usuarios autenticados
reportRouter.post('/', authenticate, createReport)

// Moderar / actualizar resolucion de reporte: exclusivo para administradores
reportRouter.patch('/:id', authenticate, authorizeRole('Administrador'), updateReport)
