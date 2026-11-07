import { query } from '../config/db.js'

export interface FormattedNotification {
  id: string
  title: string
  message: string
  read: boolean
  isRead: boolean
  readAt: string | null
  type: string
  linkPage: string
  timestamp: string
  createdAt: string
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'Justo ahora'
  if (diffMin < 60) return `Hace ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`
  if (diffHour < 24) return `Hace ${diffHour} ${diffHour === 1 ? 'hora' : 'horas'}`
  return `Hace ${diffDay} ${diffDay === 1 ? 'dia' : 'dias'}`
}

export class NotificationService {
  /**
   * Obtiene las notificaciones ordenadas cronológicamente para un usuario dado.
   */
  async getUserNotifications(userId: string): Promise<FormattedNotification[]> {
    if (!userId) {
      throw new Error('Identificador de usuario inválido.')
    }

    const sql = `
      SELECT id, title, message, "isRead", "readAt", type, "linkPage", "createdAt"
      FROM "Notification"
      WHERE "userId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 40;
    `
    const { rows } = await query(sql, [userId])

    return rows.map((n: any) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      read: Boolean(n.isRead),
      isRead: Boolean(n.isRead),
      readAt: n.readAt,
      type: n.type,
      linkPage: n.linkPage || 'Discovery',
      timestamp: formatRelativeTime(new Date(n.createdAt)),
      createdAt: n.createdAt,
    }))
  }

  /**
   * Marca una notificación específica como leída registrando readAt.
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const sql = `
      UPDATE "Notification"
      SET "isRead" = true, "readAt" = CURRENT_TIMESTAMP
      WHERE id = $1 AND "userId" = $2;
    `
    await query(sql, [notificationId, userId])
  }

  /**
   * Marca todas las notificaciones pendientes de un usuario como leídas.
   */
  async markAllAsRead(userId: string): Promise<void> {
    const sql = `
      UPDATE "Notification"
      SET "isRead" = true, "readAt" = CURRENT_TIMESTAMP
      WHERE "userId" = $1 AND "isRead" = false;
    `
    await query(sql, [userId])
  }

  /**
   * Elimina todas las notificaciones de un usuario.
   */
  async clearNotifications(userId: string): Promise<void> {
    const sql = `
      DELETE FROM "Notification"
      WHERE "userId" = $1;
    `
    await query(sql, [userId])
  }

  /**
   * Crea una notificación para un usuario (utilizado por matching, eventos, reportes).
   */
  async createNotification(data: {
    userId: string
    title: string
    message: string
    type: string
    linkPage?: string
  }): Promise<any> {
    const sql = `
      INSERT INTO "Notification" (id, "userId", title, message, type, "linkPage", "isRead", "createdAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP)
      RETURNING *;
    `
    const res = await query(sql, [
      data.userId,
      data.title,
      data.message,
      data.type,
      data.linkPage || 'Discovery',
    ])
    return res.rows[0]
  }
}

export const notificationService = new NotificationService()

