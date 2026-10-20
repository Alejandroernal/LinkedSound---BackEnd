import { Router } from 'express'
import { uploadFile } from '../controllers/upload.controller.js'
import { uploadImage } from '../middlewares/upload.middleware.js'
import { authenticate } from '../middlewares/auth.middleware.js'

export const uploadRouter = Router()

// Subida de imagen protegida con autenticacion
uploadRouter.post('/image', authenticate, uploadImage.single('image'), uploadFile)
