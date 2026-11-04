import jwt, { SignOptions } from 'jsonwebtoken'
import { config } from '../config/environment.js'

export interface TokenPayload {
  userId: string
  id?: string
  email: string
  role: string
  accountRole?: string
}

export const generateToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: config.jwt.expiresIn as any,
  }
  const effectiveId = payload.userId || payload.id || ''
  return jwt.sign(
    {
      userId: effectiveId,
      id: effectiveId,
      email: payload.email,
      role: payload.role,
      accountRole: payload.accountRole || 'Usuario',
    },
    config.jwt.secret,
    options
  )
}

export const verifyToken = (token: string): TokenPayload => {
  const decoded = jwt.verify(token, config.jwt.secret) as any
  const effectiveId = decoded.userId || decoded.id || ''
  return {
    userId: effectiveId,
    id: effectiveId,
    email: decoded.email,
    role: decoded.role,
    accountRole: decoded.accountRole || (decoded.role === 'Administrador' ? 'Administrador' : 'Usuario'),
  }
}
