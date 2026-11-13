export interface Usuario {
  id: string
  email: string
  password?: string
  firstName: string
  lastName: string
  nickname: string
  accountRole: 'Usuario' | 'Administrador'
  profileImage?: string | null
  description?: string | null
  soundcloudUrl?: string | null
  spotifyUrl?: string | null
  soundcloudHandle?: string | null
  locationId?: string | null
  statusId: string
  reportsCount: number
  createdAt: Date
  updatedAt: Date
}

export interface Role {
  id: string
  name: 'Artista' | 'Productor' | 'Administrador'
  description?: string | null
  createdAt: Date
}

export interface UserRole {
  userId: string
  roleId: string
  assignedAt: Date
}

export interface UserStatus {
  id: string
  name: 'Active' | 'Suspended' | 'Pending Approval' | 'Banned'
  description?: string | null
  createdAt: Date
}

export interface JwtPayload {
  userId: string
  email: string
  role?: string
  accountRole?: string
}

