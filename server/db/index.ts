import mysql from 'mysql2/promise'

const isProduction = process.env.NODE_ENV === 'production'
const port = Number(process.env.DB_PORT || 3306)
const requiredEnvKeys = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']
const missingEnvKeys = requiredEnvKeys.filter((key) => !process.env[key])

if (isProduction && missingEnvKeys.length) {
    throw new Error(`生产环境必须设置 ${missingEnvKeys.join(', ')}`)
}

if (!Number.isInteger(port) || port <= 0) {
    throw new Error('DB_PORT 必须是有效端口号')
}

export const db = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port,
    user: process.env.DB_USER || 'chess',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'chess_game',
    waitForConnections: true,
    connectionLimit: 10
})

const verifyDatabaseConnection = async () => {
    try {
        await db.query('SELECT 1')
        console.log('数据库连接成功')
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('数据库连接失败:', message || err, '请检查 DB_HOST、DB_PORT、DB_USER、DB_PASSWORD、DB_NAME')
        if (isProduction) {
            process.exit(1)
        }
    }
}

void verifyDatabaseConnection()

export default {
    query: async (sql: string, params: unknown[] = []) => {
        const [rows] = await db.query(sql, params)
        return rows
    }
}
