import type { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'

export const getSnippetTypes = async (_req: Request, res: Response) => {
  try {
    const snippetTypes = await prisma.snippetType.findMany({
      orderBy: { order: 'asc' },
    })

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
    const musicalKeys = await prisma.musicalKey.findMany({
      orderBy: { order: 'asc' },
    })

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
    const [snippetTypes, musicalKeys] = await Promise.all([
      prisma.snippetType.findMany({ orderBy: { order: 'asc' } }),
      prisma.musicalKey.findMany({ orderBy: { order: 'asc' } }),
    ])

    return res.status(200).json({
      success: true,
      snippetTypes,
      musicalKeys,
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

