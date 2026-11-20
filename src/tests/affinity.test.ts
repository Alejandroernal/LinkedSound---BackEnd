import { describe, it } from 'node:test'
import assert from 'node:assert'
import { calculateAffinity, calculateProximity } from '../services/match.service.js'

describe('Modulo de Afinidad y Proximidad (match.service)', () => {
  it('debe calcular similitud de Jaccard del 100% cuando comparten los mismos generos', () => {
    const userA = { role: 'Artista', interestGenres: ['Trap', 'Hip Hop', 'R&B'] }
    const userB = { role: 'Artista', interestGenres: ['trap', 'hip hop', 'r&b'] }

    const result = calculateAffinity(userA, userB)
    assert.strictEqual(result.commonGenres.length, 3)
    // Con Jaccard = 1.0 (50 pts), mismo rol (+8), proximidad neutral (+5), base (20) = 83%
    assert.strictEqual(result.score, 83)
    assert.strictEqual(result.percentage, '83%')
    assert.ok(result.summary.includes('100%'))
  })

  it('debe calcular Coeficiente de Jaccard parcial para generos parcialmente coincidentes', () => {
    // Interseccion: ['Rock'] (1), Union: ['Rock', 'Pop', 'Indie'] (3) -> J = 1/3 = 0.333
    const userA = { role: 'Artista', interestGenres: ['Rock', 'Pop'] }
    const userB = { role: 'Artista', interestGenres: ['Rock', 'Indie'] }

    const result = calculateAffinity(userA, userB)
    assert.strictEqual(result.commonGenres.length, 1)
    assert.strictEqual(result.commonGenres[0], 'Rock')
    // J = 1/3 (~17 pts) + rol (+8) + neutral (+5) + base (20) = 50%
    assert.strictEqual(result.score, 50)
    assert.strictEqual(result.percentage, '50%')
  })

  it('debe otorgar bonificacion maxima por complementariedad de roles (Productor + Artista)', () => {
    const userA = { role: 'Productor', interestGenres: ['Techno'] }
    const userB = { role: 'Artista', interestGenres: ['Techno'] }

    const result = calculateAffinity(userA, userB)
    assert.ok(result.reasons.some((r) => r.includes('complementariedad de roles')))
    // 50 (Jaccard 1.0) + 15 (roles complementarios) + 5 (neutral) + 20 = 90%
    assert.strictEqual(result.score, 90)
  })

  it('debe incorporar la proximidad geografica cercana en el calculo de afinidad', () => {
    const userA = { role: 'Productor', interestGenres: ['House'] }
    const userB = { role: 'Artista', interestGenres: ['House'] }

    // Proximidad de 15 km (otorga 15 pts en vez del neutral de 5 pts)
    const resultClose = calculateAffinity(userA, userB, 15)
    // 50 + 15 + 15 + 20 = 100 clamped to 99%
    assert.strictEqual(resultClose.score, 99)
    assert.ok(resultClose.reasons.some((r) => r.includes('15 km')))

    // Proximidad lejana de 600 km (otorga 0 pts)
    const resultFar = calculateAffinity(userA, userB, 600)
    // 50 + 15 + 0 + 20 = 85%
    assert.strictEqual(resultFar.score, 85)
  })

  it('debe calcular la distancia geodésica mediante Haversine correctamente', () => {
    // Obelisco Buenos Aires (-34.6037, -58.3816) a La Plata (-34.9205, -57.9536) ~ 53 km
    const proximity = calculateProximity(-34.6037, -58.3816, -34.9205, -57.9536)
    assert.ok(proximity.distanceKm > 45 && proximity.distanceKm < 60)
    assert.strictEqual(proximity.isNearby, false) // radio es 50 km

    // Mismo punto
    const samePoint = calculateProximity(-34.6037, -58.3816, -34.6037, -58.3816)
    assert.strictEqual(samePoint.distanceKm, 0)
    assert.strictEqual(samePoint.isNearby, true)
    assert.strictEqual(samePoint.formattedDistance, 'A menos de 1 km')
  })

  it('debe manejar coordenadas nulas o indefinidas de forma segura', () => {
    const nullResult = calculateProximity(null, null, -34.6037, -58.3816)
    assert.strictEqual(nullResult.distanceKm, -1)
    assert.strictEqual(nullResult.isNearby, false)
    assert.strictEqual(nullResult.formattedDistance, 'Distancia no disponible')
  })
})
