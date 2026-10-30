export interface UserAffinityProfile {
  id?: string
  nickname?: string
  role?: string
  interestGenres?: string[]
  favoriteArtists?: Array<{
    id?: string
    spotifyId?: string
    name: string
    genres?: string[]
  }>
}

export interface AffinityResult {
  score: number // 50 - 99
  percentage: string // "94%"
  commonArtists: string[]
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

  const artistsA = userA.favoriteArtists || []
  const artistsB = userB.favoriteArtists || []

  // 1. Artistas en comun
  const commonArtistsSet = new Set<string>()
  for (const a of artistsA) {
    const aName = a.name.toLowerCase().trim()
    const match = artistsB.find((b) => {
      if (a.spotifyId && b.spotifyId && a.spotifyId === b.spotifyId) return true
      return aName === b.name.toLowerCase().trim()
    })
    if (match) {
      commonArtistsSet.add(a.name)
    }
  }
  const commonArtists = Array.from(commonArtistsSet)

  // 2. Generos de interes en comun
  const commonGenresSet = new Set<string>()
  for (const ga of genresA) {
    if (genresB.some((gb) => gb === ga || gb.includes(ga) || ga.includes(gb))) {
      // Capitalizar primer letra para presentacion
      const original = (userA.interestGenres || []).find((orig) => orig.toLowerCase().trim() === ga) || ga
      commonGenresSet.add(original)
    }
  }

  // 3. Generos derivados de los artistas de Spotify
  const artistGenresA = new Set<string>()
  artistsA.forEach((a) => (a.genres || []).forEach((g) => artistGenresA.add(g.toLowerCase().trim())))

  const artistGenresB = new Set<string>()
  artistsB.forEach((b) => (b.genres || []).forEach((g) => artistGenresB.add(g.toLowerCase().trim())))

  const sharedSpotifyGenres = new Set<string>()
  artistGenresA.forEach((ga) => {
    if (artistGenresB.has(ga)) {
      sharedSpotifyGenres.add(ga)
      commonGenresSet.add(ga.charAt(0).toUpperCase() + ga.slice(1))
    }
  })

  const commonGenres = Array.from(commonGenresSet)

  // 4. Calculo del puntaje ponderado
  let baseScore = 55 // Afinidad base para usuarios de la misma red

  // Bono por artistas en comun (Hasta 30 puntos)
  if (commonArtists.length > 0) {
    baseScore += Math.min(30, commonArtists.length * 15)
  }

  // Bono por generos en comun (Hasta 25 puntos)
  if (commonGenres.length > 0) {
    baseScore += Math.min(25, commonGenres.length * 8)
  }

  // Bono por generos de Spotify en comun (Hasta 15 puntos)
  if (sharedSpotifyGenres.size > 0) {
    baseScore += Math.min(15, sharedSpotifyGenres.size * 4)
  }

  // Bono por roles complementarios (Hasta 10 puntos)
  const roleA = (userA.role || '').toLowerCase()
  const roleB = (userB.role || '').toLowerCase()

  if (
    (roleA.includes('productor') && roleB.includes('artista')) ||
    (roleA.includes('artista') && roleB.includes('productor')) ||
    (roleA.includes('ambos') || roleB.includes('ambos'))
  ) {
    baseScore += 10
  } else if (roleA && roleB && roleA === roleB) {
    baseScore += 6
  }

  // Limitar puntaje final entre 55 y 99%
  const finalScore = Math.min(99, Math.max(55, Math.round(baseScore)))
  const percentage = `${finalScore}%`

  // Razones y explicacion
  const reasons: string[] = []
  if (commonArtists.length > 0) {
    reasons.push(`Artistas en común: ${commonArtists.join(', ')}`)
  }
  if (commonGenres.length > 0) {
    reasons.push(`Géneros afines: ${commonGenres.slice(0, 3).join(', ')}`)
  }

  let summary = 'Afinidad en estilos y colaboraciones musicales.'
  if (commonArtists.length > 0 && commonGenres.length > 0) {
    summary = `Coinciden en ${commonArtists[0]} y estilos de ${commonGenres[0]}.`
  } else if (commonArtists.length > 0) {
    summary = `Ambos siguen a ${commonArtists.join(' y ')}.`
  } else if (commonGenres.length > 0) {
    summary = `Comparten interés en ${commonGenres.slice(0, 2).join(' y ')}.`
  }

  return {
    score: finalScore,
    percentage,
    commonArtists,
    commonGenres,
    reasons,
    summary,
  }
}

