import { Router } from 'express'
import { uploadFile, uploadAudioFile } from '../controllers/upload.controller.js'
import { uploadImage, uploadAudio } from '../middlewares/upload.middleware.js'
import { authenticate } from '../middlewares/auth.middleware.js'

export const uploadRouter = Router()

// Subida de imagen protegida con autenticacion
uploadRouter.post('/image', authenticate, uploadImage.single('image'), uploadFile)

// Subida de archivo de audio protegida (.wav, .mp3, .flac, .ogg)
uploadRouter.post('/audio', authenticate, uploadAudio.single('audio'), uploadAudioFile)

