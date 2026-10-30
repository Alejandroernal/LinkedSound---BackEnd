interface SpotifyArtistResult {
  id: string
  spotifyId: string
  name: string
  imageUrl: string | null
  spotifyUrl: string
  genres: string[]
  popularity?: number
  followers?: number
}

// Catalogo de respaldo curado en caso de ausencia de credenciales Spotify en desarrollo
const CURATED_ARTISTS_FALLBACK: SpotifyArtistResult[] = [
  {
    id: 'sp-daft-punk',
    spotifyId: '4tZwfgrHOc3mvqYxwDOCn1',
    name: 'Daft Punk',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/4tZwfgrHOc3mvqYxwDOCn1',
    genres: ['electro', 'filter house', 'synthpop', 'electronic'],
    popularity: 88,
  },
  {
    id: 'sp-bizarrap',
    spotifyId: '716NhGYqD1jl2WVsQ10HNv',
    name: 'Bizarrap',
    imageUrl: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/716NhGYqD1jl2WVsQ10HNv',
    genres: ['argentine hip hop', 'trap latino', 'electronic trap', 'edm'],
    popularity: 86,
  },
  {
    id: 'sp-calvin-harris',
    spotifyId: '7CajNmpbOovFoOoasH2HaY',
    name: 'Calvin Harris',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/7CajNmpbOovFoOoasH2HaY',
    genres: ['dance pop', 'edm', 'electropop', 'house', 'pop dance'],
    popularity: 89,
  },
  {
    id: 'sp-deorro',
    spotifyId: '57eD5nK0m93hO4m34u0k29',
    name: 'Deorro',
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/57eD5nK0m93hO4m34u0k29',
    genres: ['electro house', 'edm', 'melbourne bounce', 'dance pop'],
    popularity: 76,
  },
  {
    id: 'sp-david-guetta',
    spotifyId: '1Cs0zKBU1kc0i8ypK3B9ai',
    name: 'David Guetta',
    imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/1Cs0zKBU1kc0i8ypK3B9ai',
    genres: ['dance pop', 'edm', 'pop dance', 'house'],
    popularity: 91,
  },
  {
    id: 'sp-skrillex',
    spotifyId: '5he5w2ok4TkQgEG3TkY4CE',
    name: 'Skrillex',
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/5he5w2ok4TkQgEG3TkY4CE',
    genres: ['brostep', 'complextro', 'edm', 'electronic trap'],
    popularity: 84,
  },
  {
    id: 'sp-deadmau5',
    spotifyId: '2CIMQHirSU0MQqyYHq0eOx',
    name: 'deadmau5',
    imageUrl: 'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/2CIMQHirSU0MQqyYHq0eOx',
    genres: ['electro house', 'progressive house', 'edm', 'electronic'],
    popularity: 78,
  },
  {
    id: 'sp-martin-garrix',
    spotifyId: '60d2Qnm3EVuoBkRmQBzg--o',
    name: 'Martin Garrix',
    imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/60d2Qnm3EVuoBkRmQBzg--o',
    genres: ['dutch edm', 'edm', 'pop dance', 'progressive house'],
    popularity: 85,
  },
  {
    id: 'sp-fred-again',
    spotifyId: '4oLeDaDmikFebvgvdQuqsa',
    name: 'Fred again..',
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/4oLeDaDmikFebvgvdQuqsa',
    genres: ['uk dance', 'electronic', 'house', 'indie soul'],
    popularity: 85,
  },
  {
    id: 'sp-peggy-gou',
    spotifyId: '4o4jN44wD5JqBmsK9w9qg3',
    name: 'Peggy Gou',
    imageUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/4o4jN44wD5JqBmsK9w9qg3',
    genres: ['deep house', 'nu disco', 'house', 'indie electronic'],
    popularity: 81,
  },
  {
    id: 'sp-tiesto',
    spotifyId: '2o5jDhtHVPhrJdv3cEQ99Z',
    name: 'Tiësto',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/2o5jDhtHVPhrJdv3cEQ99Z',
    genres: ['big room', 'dance pop', 'dutch edm', 'edm', 'house', 'pop dance', 'trance'],
    popularity: 87,
  },
  {
    id: 'sp-charlotte-de-witte',
    spotifyId: '22WZ7MFF4ehraSZJU0T5qe',
    name: 'Charlotte de Witte',
    imageUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/22WZ7MFF4ehraSZJU0T5qe',
    genres: ['techno', 'acid techno', 'dark techno', 'peak time techno'],
    popularity: 75,
  },
  {
    id: 'sp-boris-brejcha',
    spotifyId: '6vWDO969PvNqNYHIOW5v0m',
    name: 'Boris Brejcha',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/6vWDO969PvNqNYHIOW5v0m',
    genres: ['minimal techno', 'high-tech minimal', 'techno'],
    popularity: 74,
  },
  {
    id: 'sp-bad-bunny',
    spotifyId: '4q3ewBCX7sLwd24euqV69X',
    name: 'Bad Bunny',
    imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/4q3ewBCX7sLwd24euqV69X',
    genres: ['reggaeton', 'trap latino', 'urbano latino'],
    popularity: 96,
  },
  {
    id: 'sp-the-weeknd',
    spotifyId: '1Xyo4u8uXC1ZmMpatF05PJ',
    name: 'The Weeknd',
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/1Xyo4u8uXC1ZmMpatF05PJ',
    genres: ['canadian contemporary r&b', 'canadian pop', 'pop', 'synthpop'],
    popularity: 95,
  },
  {
    id: 'sp-gorillaz',
    spotifyId: '3AA28KZvwAUc0bTN93sc2d',
    name: 'Gorillaz',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/3AA28KZvwAUc0bTN93sc2d',
    genres: ['alternative rock', 'art pop', 'indie rock'],
    popularity: 84,
  },
  {
    id: 'sp-cerati',
    spotifyId: '1QOmebzgL0IRioF2O9UpZM',
    name: 'Gustavo Cerati',
    imageUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/1QOmebzgL0IRioF2O9UpZM',
    genres: ['rock en espanol', 'argentine rock', 'latin alternative'],
    popularity: 80,
  },
  {
    id: 'sp-rufus-du-sol',
    spotifyId: '5Pb27ujIyYb33zBqVysBkj',
    name: 'RÜFÜS DU SOL',
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&q=80',
    spotifyUrl: 'https://open.spotify.com/artist/5Pb27ujIyYb33zBqVysBkj',
    genres: ['australian dance', 'indie dance', 'live electronic'],
    popularity: 81,
  },
]

let cachedSpotifyToken: { token: string; expiresAt: number } | null = null

async function getSpotifyAppToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return null
  }

  if (cachedSpotifyToken && cachedSpotifyToken.expiresAt > Date.now() + 60000) {
    return cachedSpotifyToken.token
  }

  try {
    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    })

    if (!res.ok) {
      console.warn('Spotify Auth Token error:', res.status, res.statusText)
      return null
    }

    const data: any = await res.json()
    if (data.access_token) {
      cachedSpotifyToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      }
      return data.access_token
    }
    return null
  } catch (err: any) {
    console.warn('Could not contact Spotify token service:', err?.message)
    return null
  }
}

export async function searchSpotifyArtists(query: string, limit: number = 8): Promise<SpotifyArtistResult[]> {
  const cleanQuery = query.trim().toLowerCase()
  if (!cleanQuery) return []

  const token = await getSpotifyAppToken()

  if (token) {
    try {
      const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(cleanQuery)}&type=artist&limit=${limit}`
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data: any = await response.json()
        const items = data?.artists?.items || []
        if (Array.isArray(items) && items.length > 0) {
          return items.map((a: any) => ({
            id: a.id,
            spotifyId: a.id,
            name: a.name,
            imageUrl: a.images?.[0]?.url || a.images?.[1]?.url || null,
            spotifyUrl: a.external_urls?.spotify || `https://open.spotify.com/artist/${a.id}`,
            genres: Array.isArray(a.genres) ? a.genres : [],
            popularity: a.popularity,
            followers: a.followers?.total,
          }))
        }
      }
    } catch (err: any) {
      console.warn('Spotify search request failed, using curated catalog:', err?.message)
    }
  }

  // Fallback con catalogo curado
  const results = CURATED_ARTISTS_FALLBACK.filter((artist) => {
    const inName = artist.name.toLowerCase().includes(cleanQuery)
    const inGenres = artist.genres.some((g) => g.toLowerCase().includes(cleanQuery))
    return inName || inGenres
  })

  // Si no encontro coincidencias exactas y hay busqueda, retornar los primeros ordenados
  if (results.length === 0) {
    return CURATED_ARTISTS_FALLBACK.slice(0, limit)
  }

  return results.slice(0, limit)
}

