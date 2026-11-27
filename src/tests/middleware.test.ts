import { describe, it } from 'node:test'
import assert from 'node:assert'
import { authorizeRole, AuthenticatedRequest } from '../middlewares/auth.middleware.js'
import type { Response } from 'express'

describe('Middleware de Autorizacion por Rol (authorizeRole)', () => {
  const createMockResponse = () => {
    const res: any = {
      statusCode: 200,
      jsonBody: null,
      status(code: number) {
        this.statusCode = code
        return this
      },
      json(data: any) {
        this.jsonBody = data
        return this
      },
    }
    return res as Response & { statusCode: number; jsonBody: any }
  }

  it('debe permitir el acceso si el rol de cuenta es Administrador', () => {
    const req: AuthenticatedRequest = {
      user: {
        userId: 'admin-id',
        email: 'admin@linkedsound.com',
        role: 'Artista',
        accountRole: 'Administrador',
      },
    } as any

    const res = createMockResponse()
    let calledNext = false
    const next = () => {
      calledNext = true
    }

    const middleware = authorizeRole('Administrador')
    middleware(req, res, next)

    assert.strictEqual(calledNext, true)
    assert.strictEqual(res.statusCode, 200)
  })

  it('debe rechazar con 401 si no hay usuario autenticado en la peticion', () => {
    const req: AuthenticatedRequest = {} as any
    const res = createMockResponse()
    let calledNext = false
    const next = () => {
      calledNext = true
    }

    const middleware = authorizeRole('Administrador')
    middleware(req, res, next)

    assert.strictEqual(calledNext, false)
    assert.strictEqual(res.statusCode, 401)
    assert.strictEqual(res.jsonBody?.success, false)
    assert.ok(res.jsonBody?.message.includes('Acceso no autenticado'))
  })

  it('debe rechazar con 403 si el usuario tiene rol comun y la ruta exige Administrador', () => {
    const req: AuthenticatedRequest = {
      user: {
        userId: 'user-id',
        email: 'usuario@linkedsound.com',
        role: 'Artista',
        accountRole: 'Usuario',
      },
    } as any

    const res = createMockResponse()
    let calledNext = false
    const next = () => {
      calledNext = true
    }

    const middleware = authorizeRole('Administrador')
    middleware(req, res, next)

    assert.strictEqual(calledNext, false)
    assert.strictEqual(res.statusCode, 403)
    assert.strictEqual(res.jsonBody?.success, false)
    assert.ok(res.jsonBody?.message.includes('Acceso denegado'))
  })

  it('debe rechazar con 403 si role intenta suplantar Administrador pero accountRole es Usuario', () => {
    const req: AuthenticatedRequest = {
      user: {
        userId: 'spoof-id',
        email: 'spoof@linkedsound.com',
        role: 'Administrador',
        accountRole: 'Usuario',
      },
    } as any

    const res = createMockResponse()
    let calledNext = false
    const next = () => {
      calledNext = true
    }

    const middleware = authorizeRole('Administrador')
    middleware(req, res, next)

    assert.strictEqual(calledNext, false)
    assert.strictEqual(res.statusCode, 403)
  })
})
