import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import { busquedaService } from '../services/busqueda.service.js'

export const buscar = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId
    const {
      q,
      texto,
      genero,
      rol,
      lat,
      lon,
      radio,
      limit,
      offset,
    } = req.query

    const resultados = await busquedaService.buscarCreadores({
      texto: typeof q === 'string' ? q : typeof texto === 'string' ? texto : undefined,
      genero: typeof genero === 'string' ? genero : undefined,
      rol: typeof rol === 'string' ? rol : undefined,
      latitud: lat ? parseFloat(String(lat)) : undefined,
      longitud: lon ? parseFloat(String(lon)) : undefined,
      radioKm: radio ? parseFloat(String(radio)) : 50,
      excludeUserId: currentUserId,
      limit: limit ? parseInt(String(limit), 10) : 20,
      offset: offset ? parseInt(String(offset), 10) : 0,
    })

    return res.status(200).json({
      success: true,
      total: resultados.length,
      creadores: resultados,
    })
  } catch (error: any) {
    console.error('Error en busqueda:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Error al ejecutar busqueda de creadores',
    })
  }
}

