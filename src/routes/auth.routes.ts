import { Router } from 'express'
import { register, login, getMe, updateProfile, getGenres, getUsers } from '../controllers/auth.controller.js'
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware.js'

export const authRouter = Router()

authRouter.post('/register', register)
authRouter.post('/login', login)
authRouter.get('/me', authenticate, getMe)
authRouter.put('/profile', authenticate, updateProfile)
authRouter.get('/genres', getGenres)
authRouter.get('/users', optionalAuthenticate, getUsers)
