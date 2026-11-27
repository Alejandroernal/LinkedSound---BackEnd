import { Request, Response, NextFunction } from 'express'
import { verifyToken, TokenPayload } from '../utils/jwt.js'
import { getMusicalRoleSql } from '../utils/userRoleSql.js'
import { query } from '../config/db.js'

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload
}

interface LiveUserState {
  id: string
  email: string
  accountRole: string
  role: string
  statusName: string
}

async function fetchLiveUserState(userId: string): Promise<LiveUserState | null> {
  const res = await query(
    `
    SELECT u.id, u.email, u."accountRole",
           COALESCE(s.name, 'Active') AS status_name,
           ${getMusicalRoleSql('u')} AS role
    FROM "User" u
    LEFT JOIN "UserStatus" s ON u."statusId" = s.id
    WHERE u.id = $1
    LIMIT 1;
    `,
    [userId]
  )
  if (res.rows.length === 0) return null
  const row = res.rows[0]
  return {
    id: row.id,
    email: row.email,
    accountRole: row.accountRole || 'Usuario',
    role: row.role || 'Artista',
    statusName: row.status_name || 'Active',
  }
}

function getBlockedStatusMessage(statusName: string): string | null {
  if (statusName === 'Suspended') {
    return 'Tu cuenta se encuentra suspendida temporalmente por un administrador.'
  }
  if (statusName === 'Banned') {
    return 'Tu cuenta ha sido bloqueada permanentemente por infringir las normas de la comunidad.'
  }
  if (statusName === 'Inactive') {
    return 'Tu cuenta se encuentra dada de baja.'
  }
  return null
}

export const authenticate = async (
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

  let decoded: TokenPayload
  try {
    decoded = verifyToken(token)
  } catch (_error) {
    return res.status(401).json({
      success: false,
      status: 401,
      message: 'Token de autorizacion invalido o expirado',
    })
  }

  try {
    const liveUser = await fetchLiveUserState(decoded.userId)
    if (!liveUser) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: 'Sesion invalida. La cuenta asociada al token ya no existe.',
      })
    }

    const blockedMsg = getBlockedStatusMessage(liveUser.statusName)
    if (blockedMsg) {
      return res.status(403).json({
        success: false,
        status: 403,
        message: blockedMsg,
      })
    }

    // Reemplazar rol y accountRole del token por los valores vigentes en base de datos
    req.user = {
      ...decoded,
      userId: liveUser.id,
      email: liveUser.email,
      role: liveUser.role,
      accountRole: liveUser.accountRole,
    }
    next()
  } catch (dbErr) {
    console.error('[AuthMiddleware] Error validando estado de usuario en DB:', dbErr)
    return res.status(500).json({
      success: false,
      status: 500,
      message: 'Error al validar la sesion del usuario.',
    })
  }
}

export const optionalAuthenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    try {
      const decoded = verifyToken(token)
      const liveUser = await fetchLiveUserState(decoded.userId)
      if (liveUser && !getBlockedStatusMessage(liveUser.statusName)) {
        req.user = {
          ...decoded,
          userId: liveUser.id,
          email: liveUser.email,
          role: liveUser.role,
          accountRole: liveUser.accountRole,
        }
      }
    } catch {
      // Token opcional invalido, expirado o usuario bloqueado
    }
  }
  next()
}

/**
 * Middleware de autorizacion por rol.
 * Para privilegios administrativos ('Administrador'), exige estrictamente accountRole === 'Administrador'.
 * Para roles musicales/funcionales, evalua role o accountRole.
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

    const hasPermission = allowedRoles.some((allowed) => {
      if (allowed === 'Administrador') {
        return accountRole === 'Administrador'
      }
      return accountRole === allowed || role === allowed
    })

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
