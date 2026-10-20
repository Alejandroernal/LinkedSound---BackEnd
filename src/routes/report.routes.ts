import { Router } from 'express'
import { getReports, createReport, updateReport } from '../controllers/report.controller.js'
import { optionalAuthenticate } from '../middlewares/auth.middleware.js'

export const reportRouter = Router()

reportRouter.get('/', getReports)
reportRouter.post('/', optionalAuthenticate, createReport)
reportRouter.patch('/:id', optionalAuthenticate, updateReport)
