import { query } from '../config/db.js'

export interface ActivityItem {
  id: string
  user: string
  action: string
  timestamp: string
  exactTimestamp: string
  ip: string
  device: string
  module: 'Perfil' | 'Explorer' | 'Sistema'
}

export class ActivityService {
  /**
   * Obtiene los últimos logs de actividad del sistema mediante consulta SQL directa.
   */
  async getAllActivities(): Promise<ActivityItem[]> {
    const sql = `
      SELECT 
        l.id,
        l."userId",
        l.action,
        l.ip,
        l.device,
        l.module,
        l."createdAt",
        u.nickname,
        u."firstName",
        u."lastName",
        u.role,
        u."accountRole"
      FROM "UserActivityLog" l
      LEFT JOIN "User" u ON l."userId" = u.id
      ORDER BY l."createdAt" DESC
      LIMIT 100;
    `
    const { rows } = await query(sql)

    return rows.map((act: any) => {
      const createdDate = new Date(act.createdAt)
      const day = String(createdDate.getDate()).padStart(2, '0')
      const month = String(createdDate.getMonth() + 1).padStart(2, '0')
      const year = createdDate.getFullYear()
      const hours = String(createdDate.getHours()).padStart(2, '0')
      const minutes = String(createdDate.getMinutes()).padStart(2, '0')
      const seconds = String(createdDate.getSeconds()).padStart(2, '0')
      const exactFormatted = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`

      const userName = act.nickname || (act.firstName ? `${act.firstName} ${act.lastName || ''}`.trim() : null)
        ? (act.accountRole === 'Administrador' || act.role === 'Administrador')
          ? `Administrador (${act.nickname || 'Admin'})`
          : act.nickname || `${act.firstName} ${act.lastName || ''}`.trim()
        : 'Sistema'

      return {
        id: act.id,
        user: userName,
        action: act.action,
        timestamp: 'Reciente',
        exactTimestamp: exactFormatted,
        ip: act.ip || '127.0.0.1',
        device: act.device || 'Navegador Web',
        module: (act.module || 'Sistema') as 'Perfil' | 'Explorer' | 'Sistema',
      }
    })
  }

  /**
   * Registra una acción en la bitácora de actividad.
   * Regla de negocio: La acción es requerida; si no se provee userId, se busca un usuario activo de respaldo.
   */
  async logActivity(data: {
    userId?: string
    action: string
    ip?: string
    device?: string
    module?: string
  }): Promise<any> {
    const trimmedAction = String(data.action || '').trim()
    if (!trimmedAction) {
      throw new Error('La acción es obligatoria para registrar en el log.')
    }

    let targetUserId = data.userId

    if (!targetUserId) {
      // Buscar usuario activo mediante SQL directo
      const userRes = await query(`
        SELECT u.id 
        FROM "User" u
        INNER JOIN "UserStatus" s ON u."statusId" = s.id
        WHERE s.name = 'Active'
        LIMIT 1;
      `)
      if (rowsExist(userRes)) {
        targetUserId = userRes.rows[0].id
      } else {
        throw new Error('No hay usuarios disponibles para asociar la actividad.')
      }
    }

    const insertSql = `
      INSERT INTO "UserActivityLog" (id, "userId", action, ip, device, module, "createdAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING *;
    `
    const insertRes = await query(insertSql, [
      targetUserId,
      trimmedAction,
      data.ip || '127.0.0.1',
      data.device || 'Web Browser',
      String(data.module || 'Sistema').trim(),
    ])

    return insertRes.rows[0]
  }
}

function rowsExist(res: any): boolean {
  return Array.isArray(res?.rows) && res.rows.length > 0
}

export const activityService = new ActivityService()

