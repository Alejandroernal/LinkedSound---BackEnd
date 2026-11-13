export interface LocationModel {
  id: string
  formattedAddress: string
  country?: string | null
  province?: string | null
  city?: string | null
  streetAddress?: string | null
  latitude?: number | null
  longitude?: number | null
  geo_point?: any
  srid?: number
  createdAt: Date
  updatedAt: Date
}

export interface GenreModel {
  id: string
  name: string
  slug: string
  description?: string | null
  createdAt: Date
}

export interface TrackSnippetModel {
  id: string
  title: string
  plays: number | string
  duration: string
  audioUrl?: string | null
  soundcloudLink?: string | null
  userId?: string | null
  eventId?: string | null
  format?: string | null
  snippetType?: string | null
  bpm?: string | null
  key?: string | null
  fileSize?: string | null
  order?: number
  snippetTypeId?: string | null
  musicalKeyId?: string | null
  createdAt?: Date
}

export interface PerfilResponse {
  id: string
  email: string
  firstName: string
  lastName: string
  nickname: string
  role: string
  accountRole: string
  profileImage?: string | null
  description?: string | null
  soundcloudUrl?: string | null
  spotifyUrl?: string | null
  location: string
  locationId?: string | null
  country?: string
  province?: string
  city?: string
  streetAddress?: string
  latitude?: number | null
  longitude?: number | null
  status: string
  interestGenres: string[]
  tracks: TrackSnippetModel[]
  createdAt: Date
  updatedAt: Date
}

export interface UpdateProfileDTO {
  firstName?: string
  lastName?: string
  nickname?: string
  password?: string
  role?: string
  accountRole?: string
  location?: string
  country?: string
  province?: string
  city?: string
  streetAddress?: string
  latitude?: number | string
  longitude?: number | string
  interestGenres?: string[]
  description?: string
  soundcloudUrl?: string
  spotifyUrl?: string
  profileImage?: string | null
  tracks?: any[]
  trackUrl?: string
}
