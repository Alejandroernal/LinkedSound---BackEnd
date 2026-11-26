import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { query } from '../config/db.js'

export interface PushNotificationPayload {
  title: string
  body: string
  data?: Record<string, string>
  linkPage?: string
}

let isFirebaseAdminInitialized = false

function initFirebaseAdmin(): boolean {
  if (isFirebaseAdminInitialized) return true
  if (getApps().length > 0) {
    isFirebaseAdminInitialized = true
    return true
  }

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT
    if (serviceAccountJson) {
      const parsed = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson
      if (typeof parsed?.private_key === 'string') {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
      }
      initializeApp({
        credential: cert(parsed),
      })
      isFirebaseAdminInitialized = true
      return true
    }

    const projectId = process.env.FIREBASE_PROJECT_ID || 'linkedsound-a3c4a'
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

    if (projectId && clientEmail && privateKey) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      })
      isFirebaseAdminInitialized = true
      return true
    }
  } catch (err) {
    console.warn('[FCM] Error al inicializar Firebase Admin SDK:', err)
  }

  return false
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
   * Envía la petición push a Firebase Cloud Messaging usando la API v1 moderna (o fallback legacy si se provee).
   */
  async sendToToken(fcmToken: string, payload: PushNotificationPayload): Promise<boolean> {
    if (!fcmToken) return false

    console.log(`[FCM Push Dispatch] Destino: ${fcmToken.slice(0, 15)}... | Titulo: "${payload.title}" | Mensaje: "${payload.body}"`)

    // 1. Intento primario con Firebase Admin SDK (API v1 moderna oficial de Google)
    const adminReady = initFirebaseAdmin()
    if (adminReady) {
      try {
        const stringifiedData: Record<string, string> = {
          linkPage: String(payload.linkPage || 'Discovery'),
        }
        if (payload.data) {
          for (const [k, v] of Object.entries(payload.data)) {
            if (v !== undefined && v !== null) {
              stringifiedData[k] = String(v)
            }
          }
        }

        await getMessaging().send({
          token: fcmToken,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: stringifiedData,
          webpush: {
            notification: {
              title: payload.title,
              body: payload.body,
              icon: '/4147b18c-9b5d-49fe-86fe-07a9023d1d1e.png',
              badge: '/4147b18c-9b5d-49fe-86fe-07a9023d1d1e.png',
            },
            fcmOptions: {
              link: '/',
            },
          },
        })
        console.log(`[FCM v1 Push Exitoso] Destino: ${fcmToken.slice(0, 15)}...`)
        return true
      } catch (adminErr) {
        console.warn('[FCM v1 Push Error]:', adminErr)
      }
    }

    // 2. Intento de respaldo con clave heredada si existe FIREBASE_SERVER_KEY
    const serverKey = process.env.FIREBASE_SERVER_KEY || ''
    if (serverKey) {
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
        console.warn('[FCM Legacy Push Failed]', error)
        return false
      }
    }

    // Sin credenciales configuradas todavía en el entorno, se registra el evento en logs
    return true
  }
}

export const fcmService = new FCMService()
