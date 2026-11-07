import { query } from '../config/db.js'

export class TrackService {
  /**
   * Obtiene los tipos de fragmentos musicales ordenados por precedencia.
   */
  async getSnippetTypes() {
    const res = await query(`
      SELECT id, name, description, "order", "createdAt"
      FROM "SnippetType"
      ORDER BY "order" ASC;
    `)
    return res.rows
  }

  /**
   * Obtiene las tonalidades musicales armónicas disponibles.
   */
  async getMusicalKeys() {
    const res = await query(`
      SELECT id, name, description, "order", "createdAt"
      FROM "MusicalKey"
      ORDER BY "order" ASC;
    `)
    return res.rows
  }

  /**
   * Obtiene conjuntamente las opciones de configuración para snippets y tonalidades.
   */
  async getTrackOptions() {
    const [snippetTypes, musicalKeys] = await Promise.all([
      this.getSnippetTypes(),
      this.getMusicalKeys(),
    ])

    return { snippetTypes, musicalKeys }
  }
}

export const trackService = new TrackService()

