import fs from 'fs'
import path from 'path'
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

async function main() {
  const connectionString = process.env.DATABASE_URL || ''
  const requiresSsl = connectionString.includes('sslmode=require') || connectionString.includes(':6543')
  const client = new pg.Client({
    connectionString,
    ssl: requiresSsl ? { rejectUnauthorized: false } : false,
  })

  await client.connect()
  console.log('Conectado a Supabase!')

  const sqlPath = path.resolve('insert_mock_data.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  console.log('Ejecutando insert_mock_data.sql...')
  await client.query(sql)
  console.log('insert_mock_data.sql ejecutado con exito!')

  const userRes = await client.query('SELECT count(*) FROM "User"')
  console.log('Usuarios en BD:', userRes.rows[0].count)

  const eventRes = await client.query('SELECT count(*) FROM "Event"')
  console.log('Eventos en BD:', eventRes.rows[0].count)

  await client.end()
}

main().catch((err) => {
  console.error('Error al ejecutar mock data:', err)
  process.exit(1)
})

