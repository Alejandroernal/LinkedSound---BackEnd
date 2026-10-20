import { Router } from 'express'
import { getEvents, createEvent, updateEvent, deleteEvent } from '../controllers/event.controller.js'
import { optionalAuthenticate } from '../middlewares/auth.middleware.js'

export const eventRouter = Router()

eventRouter.get('/', getEvents)
eventRouter.post('/', optionalAuthenticate, createEvent)
eventRouter.put('/:id', optionalAuthenticate, updateEvent)
eventRouter.delete('/:id', optionalAuthenticate, deleteEvent)

