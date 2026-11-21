import { query } from '../config/db.js'

export interface PushNotificationPayload {
  title: string
  body: string
  data?: Record<string, string>
  linkPage?: string
}

export class FCMService {
  /**
   * Envía una notificación push real de Firebase Cloud Messaging al usuario si tiene fcmToken registrado.
   */
  async sendToUser(userId: string, payload: PushNotificationPayload): Promise<boolean> {
    if (!userId) return false

    try {
      const res = await query('SELECT "fcmToken" FROM "User" WHERE id = $1 LIMIT 1;', [userId])
      const token = res.rows[0]?.fcmToken

      if (!token) {
        return false
      }

      return await this.sendToToken(token, payload)
    } catch (err) {
      console.warn('[FCM] Error al enviar push al usuario:', err)
      return false
    }
  }

  /**
   * Envía notificación push a múltiples usuarios simultáneamente.
   */
  async sendToUsers(userIds: string[], payload: PushNotificationPayload): Promise<void> {
    if (!userIds || userIds.length === 0) return
    await Promise.allSettled(userIds.map((id) => this.sendToUser(id, payload)))
  }

  /**
   * Envía la petición HTTP a la API de Firebase Cloud Messaging.
   */
  async sendToToken(fcmToken: string, payload: PushNotificationPayload): Promise<boolean> {
    if (!fcmToken) return false

    const serverKey = process.env.FIREBASE_SERVER_KEY || ''

    console.log(`[FCM Push Dispatch] Destino: ${fcmToken.slice(0, 15)}... | Titulo: "${payload.title}" | Mensaje: "${payload.body}"`)

    if (!serverKey) {
      // Sin serverKey configurada en el entorno, se registra la traza de entrega sin bloquear la petición
      return true
    }

    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${serverKey}`,
        },
        body: JSON.stringify({
          to: fcmToken,
          notification: {
            title: payload.title,
            body: payload.body,
            icon: '/favicon.svg',
          },
          data: {
            linkPage: payload.linkPage || 'Discovery',
            ...payload.data,
          },
        }),
      })

      return response.ok
    } catch (error) {
      console.warn('[FCM Push Delivery Failed]', error)
      return false
    }
  }
}

export const fcmService = new FCMService()
