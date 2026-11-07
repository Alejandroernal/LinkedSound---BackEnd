import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const globalForDb = globalThis as unknown as {
  dbPool: pg.Pool | undefined
}

const connectionString = process.env.DATABASE_URL || ''
const requiresSsl = connectionString.includes('sslmode=require') || connectionString.includes(':6543')

export const pool =
  globalForDb.dbPool ??
  new pg.Pool({
    connectionString,
    ssl: requiresSsl ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.dbPool = pool
}

/**
 * Ejecuta una consulta SQL parametrizada directamente en PostgreSQL.
 * @param text Sentencia SQL con marcadores de posición ($1, $2, etc.)
 * @param params Arreglo opcional de parámetros
 */
export const query = async <T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> => {
  return pool.query<T>(text, params)
}

/**
 * Obtiene un cliente dedicado del pool para transacciones compuestas (BEGIN / COMMIT / ROLLBACK).
 */
export const getClient = async (): Promise<pg.PoolClient> => {
  return pool.connect()
}
