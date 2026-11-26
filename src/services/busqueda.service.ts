import { query } from '../config/db.js'

export interface BusquedaFiltros {
  texto?: string
  genero?: string
  rol?: string
  latitud?: number
  longitud?: number
  radioKm?: number
  excludeUserId?: string
  limit?: number
  offset?: number
}

export class BusquedaService {
  /**
   * Realiza búsquedas avanzadas y consultas geoespaciales con PostGIS.
   */
  async buscarCreadores(filtros: BusquedaFiltros) {
    const {
      texto,
      genero,
      rol,
      latitud,
      longitud,
      radioKm = 50,
      excludeUserId,
      limit = 20,
      offset = 0,
    } = filtros

    const conditions: string[] = []
    const params: any[] = []
    let pIdx = 1

    if (excludeUserId) {
      conditions.push(`u.id <> $${pIdx++}`)
      params.push(excludeUserId)
    }

    if (texto && texto.trim()) {
      const q = `%${texto.trim().toLowerCase()}%`
      conditions.push(`(
        LOWER(u."firstName") LIKE $${pIdx} OR
        LOWER(u."lastName") LIKE $${pIdx} OR
        LOWER(u.nickname) LIKE $${pIdx} OR
        LOWER(COALESCE(u.description, '')) LIKE $${pIdx}
      )`)
      params.push(q)
      pIdx++
    }

    if (rol && rol.trim()) {
      conditions.push(`EXISTS (
        SELECT 1 FROM "UserRole" ur
        JOIN "Role" r ON ur."roleId" = r.id
        WHERE ur."userId" = u.id AND LOWER(r.name) = LOWER($${pIdx})
      )`)
      params.push(rol.trim())
      pIdx++
    }

    if (genero && genero.trim()) {
      conditions.push(`EXISTS (
        SELECT 1 FROM "ProfileGenre" pg
        JOIN "Genre" g ON pg."genreId" = g.id
        WHERE pg."userId" = u.id AND (LOWER(g.slug) = LOWER($${pIdx}) OR LOWER(g.name) = LOWER($${pIdx}))
      )`)
      params.push(genero.trim())
      pIdx++
    }

    // Excluir cuentas suspendidas, baneadas o inactivas
    conditions.push(`(s.name IS NULL OR s.name NOT IN ('Suspended', 'Banned', 'Inactive'))`)

    // RF-01 / RF-02: Exigir al menos una pista de SoundCloud vinculada en Track para visibilidad en matching
    conditions.push(`EXISTS (
      SELECT 1 FROM "Track" t 
      WHERE t."userId" = u.id 
        AND t."soundcloudLink" IS NOT NULL 
        AND TRIM(t."soundcloudLink") <> ''
    )`)

    let distanceSelect = 'NULL AS "distanciaKm"'
    if (latitud != null && longitud != null) {
      const radioMetros = Math.max(1, radioKm) * 1000
      conditions.push(`l.geo_point IS NOT NULL`)
      conditions.push(`ST_DWithin(l.geo_point, ST_SetSRID(ST_MakePoint($${pIdx}, $${pIdx + 1}), 4326)::geography, $${pIdx + 2})`)
      distanceSelect = `ROUND((ST_Distance(l.geo_point, ST_SetSRID(ST_MakePoint($${pIdx}, $${pIdx + 1}), 4326)::geography) / 1000)::numeric, 1) AS "distanciaKm"`
      params.push(longitud, latitud, radioMetros)
      pIdx += 3
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const sql = `
      SELECT 
        u.id, u."firstName", u."lastName", u.nickname, u."profileImage", u.description,
        u."soundcloudUrl", u."spotifyUrl", u."createdAt",
        COALESCE(
          (SELECT r.name FROM "UserRole" ur JOIN "Role" r ON ur."roleId" = r.id WHERE ur."userId" = u.id LIMIT 1),
          'Artista'
        ) AS role,
        l."formattedAddress" AS location, l.city, l.province, l.country,
        ST_Y(l.geo_point::geometry) AS latitude,
        ST_X(l.geo_point::geometry) AS longitude,
        ${distanceSelect}
      FROM "User" u
      LEFT JOIN "UserStatus" s ON u."statusId" = s.id
      LEFT JOIN "Location" l ON u."locationId" = l.id
      ${whereClause}
      ORDER BY 
        ${latitud != null && longitud != null ? '"distanciaKm" ASC NULLS LAST,' : ''}
        u."createdAt" DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++};
    `
    params.push(limit, offset)

    const result = await query(sql, params)
    const userIds = result.rows.map((r: any) => r.id)

    const genresMap = new Map<string, string[]>()
    const tracksMap = new Map<string, any[]>()
    if (userIds.length > 0) {
      const [genresRes, tracksRes] = await Promise.all([
        query(`
          SELECT pg."userId", g.name
          FROM "ProfileGenre" pg
          JOIN "Genre" g ON pg."genreId" = g.id
          WHERE pg."userId" = ANY($1::uuid[]);
        `, [userIds]),
        query(`
          SELECT
            t.id, t.title, t.plays, t.duration, t."audioUrl", t."soundcloudLink",
            t.format, t."snippetType", t.bpm, t.key, t."fileSize", t."order", t."userId",
            g.name AS genre_name
          FROM "Track" t
          LEFT JOIN "TrackGenre" tg ON tg."trackId" = t.id
          LEFT JOIN "Genre" g ON tg."genreId" = g.id
          WHERE t."userId" = ANY($1::uuid[])
          ORDER BY t."userId", t."order" ASC;
        `, [userIds]),
      ])

      for (const row of genresRes.rows) {
        if (!genresMap.has(row.userId)) genresMap.set(row.userId, [])
        genresMap.get(row.userId)!.push(row.name)
      }

      for (const row of tracksRes.rows) {
        if (!tracksMap.has(row.userId)) tracksMap.set(row.userId, [])
        tracksMap.get(row.userId)!.push({
          id: row.id,
          title: row.title || 'Track Destacado',
          plays: typeof row.plays === 'number' ? `${row.plays.toLocaleString()} reproducciones` : String(row.plays || '0'),
          duration: row.duration || '0:30',
          genre: row.genre_name || 'Destacado',
          audioUrl: row.audioUrl || '',
          soundcloudLink: row.soundcloudLink || '',
          format: row.format || 'MP3',
          snippetType: row.snippetType || 'Snippet Demo',
          bpm: row.bpm || '',
          key: row.key || '',
          fileSize: row.fileSize || '',
          order: typeof row.order === 'number' ? row.order : 0,
        })
      }
    }

    return result.rows.map((u: any) => ({
      ...u,
      interestGenres: genresMap.get(u.id) || [],
      tracks: tracksMap.get(u.id) || [],
    }))
  }
}

export const busquedaService = new BusquedaService()

