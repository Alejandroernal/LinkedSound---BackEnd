import { Router } from 'express'
import {
  getSnippetTypes,
  getMusicalKeys,
  getTrackOptions,
} from '../controllers/track.controller.js'

export const trackRouter = Router()

trackRouter.get('/options', getTrackOptions)
trackRouter.get('/snippet-types', getSnippetTypes)
trackRouter.get('/musical-keys', getMusicalKeys)

