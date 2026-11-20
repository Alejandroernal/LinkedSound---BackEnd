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

/**
 * Middleware de autorizacion por rol.
 * Valida que el usuario autenticado posea al menos uno de los roles autorizados
 * evaluando tanto el rol funcional (role) como el rol de cuenta (accountRole).
 */
export const authorizeRole = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: 'Acceso no autenticado. Debe iniciar sesion para continuar.',
      })
    }

    const role = req.user.role
    const accountRole = req.user.accountRole

    const hasPermission =
      (role && allowedRoles.includes(role)) ||
      (accountRole && allowedRoles.includes(accountRole))

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        status: 403,
        message: 'Acceso denegado. Se requieren permisos de ' + allowedRoles.join(' o ') + '.',
      })
    }

    next()
  }
}
