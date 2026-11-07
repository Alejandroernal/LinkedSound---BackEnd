import { UploadApiResponse } from 'cloudinary'
import { cloudinary } from '../config/cloudinary.js'

export interface UploadOptions {
  folder?: string
  resourceType?: 'image' | 'video' | 'raw' | 'auto'
}

export const uploadToCloudinary = (
  fileBuffer: Buffer,
  options: UploadOptions = { folder: 'linkedsound', resourceType: 'auto' }
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'linkedsound',
        resource_type: options.resourceType || 'auto',
      },
      (error, result) => {
        if (error) {
          return reject(error)
        }
        if (!result) {
          return reject(new Error('No response received from Cloudinary'))
        }
        resolve(result)
      }
    )

    uploadStream.end(fileBuffer)
  })
}

export const uploadBase64ToCloudinary = async (
  base64String: string,
  folder = 'linkedsound/avatars'
): Promise<string> => {
  if (!base64String) return ''
  // Si no es un data url base64 (ej. es una url http), devolverlo directo
  if (
    !base64String.startsWith('data:image') &&
    !base64String.startsWith('data:audio') &&
    !base64String.startsWith('data:video')
  ) {
    return base64String
  }

  try {
    const isAudio = base64String.startsWith('data:audio')
    const uploadPromise = cloudinary.uploader.upload(base64String, {
      folder,
      resource_type: isAudio ? 'video' : 'auto',
    })
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Cloudinary upload timed out')), 6000)
    )
    const result = await Promise.race([uploadPromise, timeoutPromise])
    return result.secure_url
  } catch (err) {
    console.warn('Cloudinary upload omitido o tardo demasiado, guardando imagen local/data-url:', err)
    return base64String
  }
}
