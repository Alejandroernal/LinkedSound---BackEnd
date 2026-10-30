import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: pg.Pool | undefined
}

const connectionString = process.env.DATABASE_URL || ''
const requiresSsl = connectionString.includes('sslmode=require') || connectionString.includes(':6543')

const pool =
  globalForPrisma.pool ??
  new pg.Pool({
    connectionString,
    ssl: requiresSsl ? { rejectUnauthorized: false } : false,
  })

const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.pool = pool
}
