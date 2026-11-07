import type { Request, Response } from 'express'
import { trackService } from '../services/track.service.js'

export const getSnippetTypes = async (_req: Request, res: Response) => {
  try {
    const snippetTypes = await trackService.getSnippetTypes()
    return res.status(200).json({
      success: true,
      snippetTypes,
    })
  } catch (error: any) {
    console.error('Error al obtener tipos de snippet:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al consultar los tipos de snippet en la base de datos.',
      error: error.message,
    })
  }
}

export const getMusicalKeys = async (_req: Request, res: Response) => {
  try {
    const musicalKeys = await trackService.getMusicalKeys()
    return res.status(200).json({
      success: true,
      musicalKeys,
    })
  } catch (error: any) {
    console.error('Error al obtener tonalidades musicales:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al consultar las tonalidades musicales en la base de datos.',
      error: error.message,
    })
  }
}

export const getTrackOptions = async (_req: Request, res: Response) => {
  try {
    const options = await trackService.getTrackOptions()
    return res.status(200).json({
      success: true,
      ...options,
    })
  } catch (error: any) {
    console.error('Error al obtener opciones de tracks:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al consultar las opciones de tracks en la base de datos.',
      error: error.message,
    })
  }
}
