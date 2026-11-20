import { Router } from 'express'
import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  updateEventStatus,
  addEventComment,
  deleteEventComment,
} from '../controllers/event.controller.js'
import { authenticate, optionalAuthenticate, authorizeRole } from '../middlewares/auth.middleware.js'

export const eventRouter = Router()

// Listado de eventos (oculta eventos 'Hidden' para usuarios no administradores)
eventRouter.get('/', optionalAuthenticate, getEvents)

// Creacion de eventos (exige autenticacion obligatoria)
eventRouter.post('/', authenticate, createEvent)

// Modificacion de eventos (propietario u administrador)
eventRouter.put('/:id', authenticate, updateEvent)

// Eliminacion de eventos (propietario dentro del plazo permitido o administrador)
eventRouter.delete('/:id', authenticate, deleteEvent)

// Moderacion de estado del evento (exclusivo para administradores)
eventRouter.patch('/:id/status', authenticate, authorizeRole('Administrador'), updateEventStatus)

// Comentarios en eventos (requiere autenticacion)
eventRouter.post('/:id/comments', authenticate, addEventComment)
eventRouter.delete('/:id/comments/:commentId', authenticate, deleteEventComment)

