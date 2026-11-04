export interface UserAffinityProfile {
  id?: string
  nickname?: string
  role?: string
  interestGenres?: string[]
}

export interface AffinityResult {
  score: number // 50 - 99
  percentage: string // "94%"
  commonGenres: string[]
  reasons: string[]
  summary: string
}

export function calculateAffinity(
  userA: UserAffinityProfile,
  userB: UserAffinityProfile
): AffinityResult {
  const genresA = (userA.interestGenres || []).map((g) => g.toLowerCase().trim())
  const genresB = (userB.interestGenres || []).map((g) => g.toLowerCase().trim())

  // Generos de interes en comun
  const commonGenresSet = new Set<string>()
  for (const ga of genresA) {
    if (genresB.some((gb) => gb === ga || gb.includes(ga) || ga.includes(gb))) {
      const original = (userA.interestGenres || []).find((orig) => orig.toLowerCase().trim() === ga) || ga
      commonGenresSet.add(original)
    }
  }
  const commonGenres = Array.from(commonGenresSet)

  // Calculo del puntaje ponderado
  let baseScore = 60 // Afinidad base para perfiles en la plataforma

  // Bono por generos en comun (Hasta 30 puntos)
  if (commonGenres.length > 0) {
    baseScore += Math.min(30, commonGenres.length * 10)
  }

  // Bono por roles complementarios (Hasta 15 puntos)
  const roleA = (userA.role || '').toLowerCase()
  const roleB = (userB.role || '').toLowerCase()

  if (
    (roleA.includes('productor') && roleB.includes('artista')) ||
    (roleA.includes('artista') && roleB.includes('productor')) ||
    (roleA.includes('ambos') || roleB.includes('ambos'))
  ) {
    baseScore += 15
  } else if (roleA && roleB && roleA === roleB) {
    baseScore += 8
  }

  // Limitar puntaje final entre 55 y 99%
  const finalScore = Math.min(99, Math.max(55, Math.round(baseScore)))
  const percentage = `${finalScore}%`

  // Razones y explicacion
  const reasons: string[] = []
  if (commonGenres.length > 0) {
    reasons.push(`Generos afines: ${commonGenres.slice(0, 3).join(', ')}`)
  }

  let summary = 'Afinidad en estilos y colaboraciones musicales.'
  if (commonGenres.length > 0) {
    summary = `Comparten interes en ${commonGenres.slice(0, 2).join(' y ')}.`
  }

  return {
    score: finalScore,
    percentage,
    commonGenres,
    reasons,
    summary,
  }
}
