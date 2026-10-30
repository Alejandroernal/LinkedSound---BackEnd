import { Router } from 'express'
import { searchArtists } from '../controllers/spotify.controller.js'

const router = Router()

router.get('/artists', searchArtists)

export default router

