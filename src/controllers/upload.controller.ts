import { Response } from 'express'
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { uploadToCloudinary } from '../services/upload.service.js'

export const uploadFile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se recibio ningun archivo para subir',
      })
    }

    const folder = (req.query.folder as string) || 'linkedsound/uploads'
    const result = await uploadToCloudinary(req.file.buffer, { folder })

    res.status(200).json({
      success: true,
      message: 'Archivo subido exitosamente a Cloudinary',
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error al subir el archivo a Cloudinary',
      error: error.message,
    })
  }
}

export const uploadAudioFile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se recibio ningun archivo de audio para subir',
      })
    }

    const folder = (req.query.folder as string) || 'linkedsound/tracks'
    const ext = req.file.originalname.split('.').pop()?.toLowerCase() || 'mp3'

    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resourceType: 'auto',
    })

    const durationSec = result.duration ? Math.round(result.duration) : 30
    const mins = Math.floor(durationSec / 60)
    const secs = durationSec % 60
    const formattedDuration = `${mins}:${secs < 10 ? '0' : ''}${secs}`

    const sizeMb = (req.file.size / (1024 * 1024)).toFixed(1)
    const formattedSize = `${sizeMb} MB`

    res.status(200).json({
      success: true,
      message: 'Archivo de audio subido exitosamente a Cloudinary',
      url: result.secure_url,
      publicId: result.public_id,
      format: ext.toUpperCase(),
      bytes: result.bytes,
      duration: formattedDuration,
      fileSize: formattedSize,
      originalName: req.file.originalname,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error al subir el archivo de audio a Cloudinary',
      error: error.message,
    })
  }
}
