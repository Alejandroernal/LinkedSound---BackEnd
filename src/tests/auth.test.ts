import { describe, it } from 'node:test'
import assert from 'node:assert'
import { hashPassword, comparePassword } from '../utils/password.js'
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
})
