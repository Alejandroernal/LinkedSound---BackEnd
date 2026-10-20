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
