import { describe, it } from 'node:test'
import assert from 'node:assert'

describe('Modulo de Mensajeria (Paginacion de Historial)', () => {
  it('debe calcular paginacion real con valores validos', () => {
    const totalMessages = 145
    const limit = 20
    const page = 3

    const totalPages = Math.ceil(totalMessages / limit)
    const offset = (page - 1) * limit
    const hasMore = offset + limit < totalMessages

    assert.strictEqual(totalPages, 8)
    assert.strictEqual(offset, 40)
    assert.strictEqual(hasMore, true)
  })

  it('debe ajustar pagina minima y limite maximo permitido', () => {
    const rawPage = -5
    const rawLimit = 500

    const validPage = Math.max(1, rawPage)
    const validLimit = Math.max(1, Math.min(rawLimit, 100))

    assert.strictEqual(validPage, 1)
    assert.strictEqual(validLimit, 100)
  })

  it('debe determinar correctamente cuando se alcanza la ultima pagina', () => {
    const totalMessages = 45
    const limit = 50
    const page = 1

    const totalPages = Math.ceil(totalMessages / limit)
    const offset = (page - 1) * limit
    const hasMore = offset + totalMessages < totalMessages

    assert.strictEqual(totalPages, 1)
    assert.strictEqual(hasMore, false)
  })
})
