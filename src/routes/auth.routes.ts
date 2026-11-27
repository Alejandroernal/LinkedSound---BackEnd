import { Router } from 'express'
import {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  getGenres,
  getUsers,
  forgotPassword,
  verifyResetCode,
  resetPassword,
} from '../controllers/auth.controller.js'
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware.js'

export const authRouter = Router()

authRouter.post('/register', register)
authRouter.post('/login', login)
authRouter.post('/forgot-password', forgotPassword)
authRouter.post('/verify-reset-code', verifyResetCode)
authRouter.post('/reset-password', resetPassword)
authRouter.get('/me', authenticate, getMe)
authRouter.put('/profile', authenticate, updateProfile)
authRouter.put('/change-password', authenticate, changePassword)
authRouter.get('/genres', getGenres)
authRouter.get('/users', optionalAuthenticate, getUsers)
