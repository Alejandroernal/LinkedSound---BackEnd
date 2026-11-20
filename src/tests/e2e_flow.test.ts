import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { query } from '../config/db.js'
import bcrypt from 'bcrypt'

describe('Flujo Completo E2E: Registro -> Onboarding -> Discovery -> Match -> Chat', () => {
  it('debe ejecutar el ciclo de vida completo de dos usuarios de forma secuencial', async () => {
    const timestamp = Date.now()
    const userAEmail = `e2e_artist_${timestamp}@linkedsound.test`
    const userBEmail = `e2e_producer_${timestamp}@linkedsound.test`
    const testPassword = 'Password123'

    const passwordHash = await bcrypt.hash(testPassword, 10)

    // Obtener statusId Activo
    const statusRes = await query('SELECT id FROM "UserStatus" WHERE name = \'Active\' LIMIT 1;')
    const activeStatusId = statusRes.rows[0]?.id

    // 1. Registro de Usuario A (Artista) y Usuario B (Productor)
    const resA = await query(`
      INSERT INTO "User" (id, email, password, "firstName", "lastName", nickname, "statusId", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, 'ArtistaE2E', 'Test', $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, email;
    `, [userAEmail, passwordHash, `art_${timestamp}`, activeStatusId])
    assert.ok(resA.rows[0]?.id, 'Usuario A debe crearse correctamente')
    const userAId = resA.rows[0].id

    const resB = await query(`
      INSERT INTO "User" (id, email, password, "firstName", "lastName", nickname, "statusId", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, 'ProductorE2E', 'Test', $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, email;
    `, [userBEmail, passwordHash, `prod_${timestamp}`, activeStatusId])
    assert.ok(resB.rows[0]?.id, 'Usuario B debe crearse correctamente')
    const userBId = resB.rows[0].id

    try {
      // 2. Onboarding: Asignación de Roles y Pistas
      await query(`
        INSERT INTO "UserRole" ("userId", "roleId")
        SELECT $1, id FROM "Role" WHERE name = 'Artista' LIMIT 1;
      `, [userAId])

      await query(`
        INSERT INTO "UserRole" ("userId", "roleId")
        SELECT $1, id FROM "Role" WHERE name = 'Productor' LIMIT 1;
      `, [userBId])

      await query(`
        INSERT INTO "Track" (id, "userId", title, "soundcloudLink", duration, "order", "createdAt")
        VALUES (gen_random_uuid(), $1, 'Demo E2E', 'https://soundcloud.com/test/demo', '3:00', 1, CURRENT_TIMESTAMP);
      `, [userAId])

      await query(`
        INSERT INTO "Track" (id, "userId", title, "soundcloudLink", duration, "order", "createdAt")
        VALUES (gen_random_uuid(), $1, 'Beat E2E', 'https://soundcloud.com/test/beat', '2:20', 1, CURRENT_TIMESTAMP);
      `, [userBId])

      const tracksCheck = await query('SELECT COUNT(*) FROM "Track" WHERE "userId" IN ($1, $2)', [userAId, userBId])
      assert.equal(Number(tracksCheck.rows[0].count), 2, 'Ambos usuarios deben tener pistas para discovery')

      // 3. Discovery: Usuario A explora y encuentra a Usuario B en el radar
      const candidateQuery = await query(`
        SELECT u.id, u.nickname, u."firstName"
        FROM "User" u
        WHERE u.id = $1
          AND EXISTS (SELECT 1 FROM "Track" t WHERE t."userId" = u.id AND t."soundcloudLink" IS NOT NULL);
      `, [userBId])

      assert.equal(candidateQuery.rows.length, 1, 'Usuario B debe ser visible y seleccionable en Discovery')
      assert.equal(candidateQuery.rows[0].id, userBId)

      // 4. Match: Interacción unilateral genera notificación; respuesta mutua genera Match y Conversación
      await query(`
        INSERT INTO "Interaction" (id, "senderId", "receiverId", "isLike", "createdAt")
        VALUES (gen_random_uuid(), $1, $2, true, CURRENT_TIMESTAMP)
        ON CONFLICT ("senderId", "receiverId") DO UPDATE SET "isLike" = true;
      `, [userAId, userBId])

      await query(`
        INSERT INTO "Notification" (id, "userId", title, message, type, "linkPage", "senderId", "isRead", "createdAt")
        VALUES (gen_random_uuid(), $1, 'Solicitud de Match', 'ArtistaFlow quiere conectar y colaborar contigo.', 'match_request', 'Discovery', $2, false, CURRENT_TIMESTAMP);
      `, [userBId, userAId])

      const notifRes = await query('SELECT * FROM "Notification" WHERE "userId" = $1 AND "senderId" = $2', [userBId, userAId])
      assert.equal(notifRes.rows.length, 1, 'Usuario B debe recibir la notificación de solicitud con senderId')

      // Usuario B acepta el match
      await query(`
        INSERT INTO "Interaction" (id, "senderId", "receiverId", "isLike", "createdAt")
        VALUES (gen_random_uuid(), $1, $2, true, CURRENT_TIMESTAMP)
        ON CONFLICT ("senderId", "receiverId") DO UPDATE SET "isLike" = true;
      `, [userBId, userAId])

      const [u1, u2] = [userAId, userBId].sort()

      const matchInsert = await query(`
        INSERT INTO "Match" (id, "user1Id", "user2Id", "affinityPercent", "matchedAt", "createdAt")
        VALUES (gen_random_uuid(), $1, $2, 92, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id;
      `, [u1, u2])
      assert.ok(matchInsert.rows[0]?.id, 'Debe registrarse el Match mutuo')

      const convInsert = await query(`
        INSERT INTO "Conversation" (id, "user1Id", "user2Id", pinned, muted, blocked, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, $2, false, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id;
      `, [u1, u2])
      assert.ok(convInsert.rows[0]?.id, 'Debe crearse la Conversación mutua')
      const conversationId = convInsert.rows[0].id

      // 5. Chat: Intercambio de mensajes en tiempo real
      const msg1 = await query(`
        INSERT INTO "Message" (id, "conversationId", "senderId", "text", "isRead", "createdAt")
        VALUES (gen_random_uuid(), $1, $2, 'Hola! Vi tu perfil de productor y me interesa colaborar.', false, CURRENT_TIMESTAMP)
        RETURNING id, "text";
      `, [conversationId, userAId])
      assert.ok(msg1.rows[0]?.id, 'Mensaje 1 debe persistirse')

      const msg2 = await query(`
        INSERT INTO "Message" (id, "conversationId", "senderId", "text", "isRead", "createdAt")
        VALUES (gen_random_uuid(), $1, $2, 'Genial! Escuche tu demo, armemos algo esta semana.', false, CURRENT_TIMESTAMP)
        RETURNING id, "text";
      `, [conversationId, userBId])
      assert.ok(msg2.rows[0]?.id, 'Mensaje 2 debe persistirse')

      const history = await query(`
        SELECT id, "senderId", "text"
        FROM "Message"
        WHERE "conversationId" = $1
        ORDER BY "createdAt" ASC;
      `, [conversationId])

      assert.equal(history.rows.length, 2, 'Historial debe contener exactamente 2 mensajes')
      assert.equal(history.rows[0].senderId, userAId)
      assert.equal(history.rows[1].senderId, userBId)

      // Limpieza ordenada
      await query('DELETE FROM "Message" WHERE "conversationId" = $1', [conversationId])
      await query('DELETE FROM "Conversation" WHERE id = $1', [conversationId])
      await query('DELETE FROM "Match" WHERE ("user1Id" = $1 AND "user2Id" = $2) OR ("user1Id" = $2 AND "user2Id" = $1)', [userAId, userBId])
    } finally {
      await query('DELETE FROM "Interaction" WHERE "senderId" IN ($1, $2) OR "receiverId" IN ($1, $2)', [userAId, userBId])
      await query('DELETE FROM "Notification" WHERE "userId" IN ($1, $2)', [userAId, userBId])
      await query('DELETE FROM "Track" WHERE "userId" IN ($1, $2)', [userAId, userBId])
      await query('DELETE FROM "UserRole" WHERE "userId" IN ($1, $2)', [userAId, userBId])
      await query('DELETE FROM "User" WHERE id IN ($1, $2)', [userAId, userBId])
    }
  })
})
