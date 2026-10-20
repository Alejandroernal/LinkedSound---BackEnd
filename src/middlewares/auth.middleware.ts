import { Request, Response, NextFunction } from 'express'
import { verifyToken, TokenPayload } from '../utils/jwt.js'

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload
}

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      status: 401,
      message: 'Token de autorizacion no proporcionado o formato invalido',
    })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = verifyToken(token)
    req.user = decoded
    next()
  } catch (_error) {
    return res.status(401).json({
      success: false,
      status: 401,
      message: 'Token de autorizacion invalido o expirado',
    })
  }
}

export const optionalAuthenticate = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    try {
      req.user = verifyToken(token)
    } catch {
      // Token opcional invalido o expirado
    }
  }
  next()
}
