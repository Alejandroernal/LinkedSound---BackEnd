import { describe, it } from 'node:test'
import assert from 'node:assert'

describe('Modulo de Moderacion y Reportes (Reglas de Negocio)', () => {
  it('debe validar la regla de exclusion mutua XOR entre reportedUserId y reportedEventId', () => {
    // Caso valido: solo usuario
    const validateTarget = (reportedUserId: string | null, reportedEventId: string | null) => {
      if ((!reportedUserId && !reportedEventId) || (reportedUserId && reportedEventId)) {
        throw new Error('El reporte debe vincularse obligatoriamente a un usuario o a un evento valido, pero no a ambos ni a ninguno.')
      }
      return true
    }

    assert.strictEqual(validateTarget('user-uuid', null), true)
    assert.strictEqual(validateTarget(null, 'event-uuid'), true)

    assert.throws(() => {
      validateTarget(null, null)
    }, /vincularse obligatoriamente/)

    assert.throws(() => {
      validateTarget('user-uuid', 'event-uuid')
    }, /vincularse obligatoriamente/)
  })

  it('debe exigir justificacion administrativa obligatoria para estados terminales Resolved o Dismissed', () => {
    const validateResolution = (status: string, adminComment?: string) => {
      if ((status === 'Resolved' || status === 'Dismissed') && (!adminComment || !adminComment.trim())) {
        throw new Error('El comentario de resolucion o justificacion del Administrador es obligatorio.')
      }
      return true
    }

    assert.strictEqual(validateResolution('Pending', undefined), true)
    assert.strictEqual(validateResolution('Resolved', 'Cuenta suspendida por conducta inapropiada'), true)
    assert.strictEqual(validateResolution('Dismissed', 'Denuncia sin fundamentos probatorios'), true)

    assert.throws(() => {
      validateResolution('Resolved', '')
    }, /justificacion del Administrador es obligatorio/)

    assert.throws(() => {
      validateResolution('Dismissed', '   ')
    }, /justificacion del Administrador es obligatorio/)
  })
})
