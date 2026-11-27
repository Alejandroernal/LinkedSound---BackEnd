import { describe, it } from 'node:test'
import assert from 'node:assert'
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password.js'
import { generateToken, verifyToken } from '../utils/jwt.js'

describe('Modulo de Autenticacion y Seguridad (Password y JWT)', () => {
  it('debe hashear contrasenas con bcrypt y verificarlas correctamente', async () => {
    const rawPassword = 'MiPasswordSeguro123'
    const hash = await hashPassword(rawPassword)

    assert.notStrictEqual(hash, rawPassword)
    assert.ok(hash.startsWith('$2'))

    const isMatch = await comparePassword(rawPassword, hash)
    assert.strictEqual(isMatch, true)

    const isWrong = await comparePassword('ContrasenaIncorrecta', hash)
    assert.strictEqual(isWrong, false)
  })

  it('debe generar y decodificar tokens JWT preservando payload de usuario y roles', () => {
    const payload = {
      userId: '11111111-2222-3333-4444-555555555555',
      email: 'productor@linkedsound.com',
      role: 'Productor',
      accountRole: 'Administrador',
    }

    const token = generateToken(payload)
    assert.ok(typeof token === 'string' && token.length > 20)

    const decoded = verifyToken(token)
    assert.strictEqual(decoded.userId, payload.userId)
    assert.strictEqual(decoded.email, payload.email)
    assert.strictEqual(decoded.role, payload.role)
    assert.strictEqual(decoded.accountRole, payload.accountRole)
  })

  it('debe rechazar tokens alterados o invalidos', () => {
    const validToken = generateToken({
      userId: 'test-user-id',
      email: 'test@linkedsound.com',
      role: 'Artista',
    })

    const tamperedToken = validToken.slice(0, -5) + 'xxxxx'
    assert.throws(() => {
      verifyToken(tamperedToken)
    })
  })

  it('debe rechazar solicitudes de recuperacion si el correo no existe en la base de datos', async () => {
    const { authService } = await import('../services/auth.service.js')
    await assert.rejects(
      async () => {
        await authService.forgotPassword('correo_totalmente_inexistente_9999@linkedsound.test')
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 404)
        assert.ok(err.message.includes('No existe ninguna cuenta'))
        return true
      }
    )
  })

  it('debe validar la complejidad minima de la nueva contrasena al restablecer', async () => {
    const { authService } = await import('../services/auth.service.js')
    await assert.rejects(
      async () => {
        await authService.resetPassword('test@linkedsound.test', '123456', 'corta')
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400)
        assert.ok(err.message.includes('8 caracteres'))
        return true
      }
    )
  })

  it('debe aplicar las mismas reglas de complejidad de contrasena en util, registro y cambio desde perfil', async () => {
    assert.ok(validatePasswordStrength('Abc123')?.includes('8 caracteres'))
    assert.ok(validatePasswordStrength('minuscula1')?.includes('mayuscula'))
    assert.ok(validatePasswordStrength('MAYUSCULA1')?.includes('minuscula'))
    assert.ok(validatePasswordStrength('SinNumeroA')?.includes('numero'))
    assert.strictEqual(validatePasswordStrength('Segura123'), null)

    const { authService } = await import('../services/auth.service.js')

    await assert.rejects(
      async () => {
        await authService.register({
          email: 'weak.pass@linkedsound.test',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          nickname: 'weak_pass_user',
        })
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400)
        assert.ok(err.message.includes('mayuscula'))
        return true
      }
    )

    await assert.rejects(
      async () => {
        await authService.changePassword('00000000-0000-0000-0000-000000000000', 'Actual123', 'debil')
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 400)
        assert.ok(err.message.includes('8 caracteres'))
        return true
      }
    )
  })
})
