import { query } from '../config/db.js'

export interface FormattedReport {
  id: string
  reporterUser: string
  reportedUser: string
  reportedUserId: string | null
  reportedEventId: string | null
  reason: string
  details: string
  date: string
  status: 'Pending' | 'Resolved' | 'Dismissed'
  severity: 'Low' | 'Medium' | 'High'
  origin: 'Discovery' | 'Explorer'
  targetType: 'Perfil' | 'Evento'
  adminComment?: string
}

export interface CreateReportInput {
  reporterUserId?: string
  targetName: string
  targetType?: 'Perfil' | 'Evento'
  reason: string
  details: string
  severity?: string
  origin?: string
}

export interface UpdateReportInput {
  id: string
  status?: string
  adminComment?: string
  severity?: string
}

export class ReportService {
  /**
   * Obtiene todos los reportes con sus entidades relacionadas mediante SQL directo.
   */
  async getAllReports(): Promise<FormattedReport[]> {
    const sql = `
      SELECT 
        r.id,
        r."reporterUserId",
        r."reportedUserId",
        r."reportedEventId",
        r.reason,
        r.details,
        r.severity,
        r.origin,
        r."adminComment",
        r."createdAt",
        rs.name AS status_name,
        u_rep.nickname AS reporter_nickname,
        u_rep."firstName" AS reporter_firstname,
        u_rep."lastName" AS reporter_lastname,
        u_tgt.nickname AS reported_user_nickname,
        u_tgt."firstName" AS reported_user_firstname,
        u_tgt."lastName" AS reported_user_lastname,
        e_tgt.title AS reported_event_title,
        e_tgt.nickname AS reported_event_nickname
      FROM "Report" r
      LEFT JOIN "ReportStatus" rs ON r."statusId" = rs.id
      LEFT JOIN "User" u_rep ON r."reporterUserId" = u_rep.id
      LEFT JOIN "User" u_tgt ON r."reportedUserId" = u_tgt.id
      LEFT JOIN "Event" e_tgt ON r."reportedEventId" = e_tgt.id
      ORDER BY r."createdAt" DESC;
    `
    const { rows } = await query(sql)

    return rows.map((r: any) => {
      const reporterName = r.reporter_nickname ||
        (r.reporter_firstname ? `${r.reporter_firstname} ${r.reporter_lastname || ''}`.trim() : null) ||
        'Usuario Anonimo'

      const isEvent = Boolean(r.reportedEventId)
      let reportedTargetName = 'Desconocido'

      if (isEvent) {
        reportedTargetName = r.reported_event_title || r.reported_event_nickname || 'Evento'
      } else if (r.reportedUserId) {
        reportedTargetName = r.reported_user_nickname ||
          (r.reported_user_firstname ? `${r.reported_user_firstname} ${r.reported_user_lastname || ''}`.trim() : null) ||
          'Usuario'
      }

      const createdDate = new Date(r.createdAt)
      const day = String(createdDate.getDate()).padStart(2, '0')
      const month = String(createdDate.getMonth() + 1).padStart(2, '0')
      const year = createdDate.getFullYear()
      const formattedDate = `${year}-${month}-${day}`

      return {
        id: r.id,
        reporterUser: reporterName,
        reportedUser: reportedTargetName,
        reportedUserId: r.reportedUserId,
        reportedEventId: r.reportedEventId,
        reason: r.reason,
        details: r.details,
        date: formattedDate,
        status: (r.status_name || 'Pending') as 'Pending' | 'Resolved' | 'Dismissed',
        severity: (r.severity || 'Medium') as 'Low' | 'Medium' | 'High',
        origin: (r.origin || 'Discovery') as 'Discovery' | 'Explorer',
        targetType: (isEvent ? 'Evento' : 'Perfil') as 'Perfil' | 'Evento',
        adminComment: r.adminComment || undefined,
      }
    })
  }

  /**
   * Crea un reporte aplicando las reglas de negocio y la restricción de exclusión mutua XOR.
   */
  async createReport(input: CreateReportInput): Promise<any> {
    const trimmedReason = String(input.reason || '').trim()
    const trimmedDetails = String(input.details || '').trim()

    if (!trimmedReason || !trimmedDetails) {
      throw new Error('Motivo y detalles son obligatorios para enviar el reporte.')
    }

    let reporterUserId = input.reporterUserId

    // Regla de negocio: Si no se suministra ID del reportero, asociar un usuario activo
    if (!reporterUserId) {
      const activeUserRes = await query(`
        SELECT u.id 
        FROM "User" u
        INNER JOIN "UserStatus" s ON u."statusId" = s.id
        WHERE s.name = 'Active'
        LIMIT 1;
      `)
      if (activeUserRes.rows.length > 0) {
        reporterUserId = activeUserRes.rows[0].id
      } else {
        throw new Error('No hay usuarios registrados para asociar el reporte.')
      }
    }

    let reportedUserId: string | null = null
    let reportedEventId: string | null = null
    const targetType = input.targetType === 'Evento' ? 'Evento' : 'Perfil'
    const targetName = String(input.targetName || '').trim()

    // Regla de resolución de destino
    if (targetType === 'Evento') {
      const eventRes = await query(`
        SELECT id FROM "Event"
        WHERE LOWER(title) = LOWER($1) OR LOWER(nickname) = LOWER($1)
        LIMIT 1;
      `, [targetName])
      if (eventRes.rows.length > 0) {
        reportedEventId = eventRes.rows[0].id
      }
    } else {
      const userRes = await query(`
        SELECT id FROM "User"
        WHERE LOWER(nickname) = LOWER($1) OR LOWER("firstName") = LOWER($1)
        LIMIT 1;
      `, [targetName])
      if (userRes.rows.length > 0) {
        reportedUserId = userRes.rows[0].id
      }
    }

    // Regla de negocio: Validación de exclusión mutua XOR
    if ((!reportedUserId && !reportedEventId) || (reportedUserId && reportedEventId)) {
      throw new Error('El reporte debe vincularse obligatoriamente a un usuario o a un evento válido, pero no a ambos ni a ninguno.')
    }

    // Obtener statusId 'Pending'
    const statusRes = await query(`
      SELECT id FROM "ReportStatus" WHERE name = 'Pending' LIMIT 1;
    `)
    const statusId = statusRes.rows.length > 0 ? statusRes.rows[0].id : null

    const insertSql = `
      INSERT INTO "Report" (
        id,
        "reporterUserId",
        "reportedUserId",
        "reportedEventId",
        reason,
        details,
        severity,
        origin,
        "statusId",
        "createdAt"
      )
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *;
    `
    const insertRes = await query(insertSql, [
      reporterUserId,
      reportedUserId,
      reportedEventId,
      trimmedReason,
      trimmedDetails,
      input.severity || 'Medium',
      input.origin || 'Discovery',
      statusId,
    ])

    return insertRes.rows[0]
  }

  /**
   * Actualiza el estado y resolución administrativa del reporte.
   */
  async updateReport(input: UpdateReportInput): Promise<any> {
    const reportRes = await query(`SELECT * FROM "Report" WHERE id = $1`, [input.id])
    if (reportRes.rows.length === 0) {
      throw new Error('Reporte no encontrado.')
    }

    const { status, adminComment, severity } = input

    // Regla de negocio: Justificación obligatoria para estados terminales
    if ((status === 'Resolved' || status === 'Dismissed') && (!adminComment || !String(adminComment).trim())) {
      throw new Error('El comentario de resolución o justificación del Administrador es obligatorio.')
    }

    let statusId: string | null = null
    if (status) {
      const statusRecord = await query(`SELECT id FROM "ReportStatus" WHERE name = $1 LIMIT 1`, [status])
      if (statusRecord.rows.length > 0) {
        statusId = statusRecord.rows[0].id
      }
    }

    const updateFields: string[] = []
    const updateValues: any[] = [input.id]
    let paramIndex = 2

    if (statusId) {
      updateFields.push(`"statusId" = $${paramIndex++}`)
      updateValues.push(statusId)
    }
    if (adminComment !== undefined) {
      updateFields.push(`"adminComment" = $${paramIndex++}`)
      updateValues.push(adminComment ? String(adminComment).trim() : null)
    }
    if (severity) {
      updateFields.push(`severity = $${paramIndex++}`)
      updateValues.push(severity)
    }

    if (updateFields.length === 0) {
      return reportRes.rows[0]
    }

    const updateSql = `
      UPDATE "Report"
      SET ${updateFields.join(', ')}
      WHERE id = $1
      RETURNING *;
    `
    const updated = await query(updateSql, updateValues)
    return updated.rows[0]
  }
}

export const reportService = new ReportService()

