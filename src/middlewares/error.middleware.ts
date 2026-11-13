import { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  statusCode?: number
}

export const errorMiddleware = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500
  const message = err.message || 'Error interno del servidor'

  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message,
  })
}

export const errorHandler = errorMiddleware

