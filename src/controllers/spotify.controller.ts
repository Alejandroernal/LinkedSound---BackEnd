import type { Request, Response } from 'express'
import { searchSpotifyArtists } from '../services/spotify.service.js'

export const searchArtists = async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : ''
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 10

    if (!query.trim()) {
      return res.status(200).json({
        success: true,
        artists: [],
      })
    }

    const artists = await searchSpotifyArtists(query, isNaN(limit) ? 10 : limit)

    return res.status(200).json({
      success: true,
      artists,
    })
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al buscar artistas en Spotify',
      error: error.message,
    })
  }
}

