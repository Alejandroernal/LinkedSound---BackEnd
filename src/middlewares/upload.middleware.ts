import multer from 'multer'

const storage = multer.memoryStorage()

export const uploadImage = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos de imagen'))
    }
  },
})

export const uploadAudio = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB para archivos WAV/FLAC/MP3/OGG
  },
  fileFilter: (_req, file, cb) => {
    const isAudioMime = file.mimetype.startsWith('audio/') || file.mimetype === 'application/ogg'
    const isAudioExt = /\.(wav|mp3|flac|ogg)$/i.test(file.originalname)
    if (isAudioMime || isAudioExt) {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos de audio (.WAV, .MP3, .FLAC, .OGG)'))
    }
  },
})
