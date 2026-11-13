export interface ConversationModel {
  id: string
  user1Id: string
  user2Id: string
  pinned: boolean
  muted: boolean
  blocked: boolean
  createdAt: Date
  updatedAt: Date
}

export interface MessageModel {
  id: string
  conversationId: string
  senderId: string
  text?: string | null
  isRead: boolean
  readAt?: Date | null
  attachmentUrl?: string | null
  attachmentType?: string | null
  attachmentName?: string | null
  attachmentSize?: string | null
  createdAt: Date
}

export interface SendMessageDTO {
  text?: string
  attachmentUrl?: string
  attachmentType?: string
  attachmentName?: string
  attachmentSize?: string
}

