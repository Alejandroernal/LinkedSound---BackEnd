export interface InteractionModel {
  id: string
  senderId: string
  receiverId: string
  isLike: boolean
  createdAt: Date
}

export interface MatchModel {
  id: string
  user1Id: string
  user2Id: string
  affinityPercent?: string | null
  matchedAt: Date
  createdAt: Date
}

export interface AffinityResult {
  score: number // 50 - 99
  percentage: string // "94%"
  commonGenres: string[]
  reasons: string[]
  summary: string
}

export interface ProximityResult {
  distanceKm: number
  isNearby: boolean
  formattedDistance: string
}

export interface UserMatchProfile {
  id: string
  nickname: string
  role?: string
  interestGenres?: string[]
  latitude?: number | null
  longitude?: number | null
  location?: string
}

