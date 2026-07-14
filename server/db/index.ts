import mysql from 'mysql2/promise'
export const db = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'ks11012019',
    database: 'chess_game',
    waitForConnections: true,
    connectionLimit: 10
})


const testDBConnection = async () => {
    try {
        await db.query('SELECT 1');
        console.log('数据库连接成功')
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('数据库连接失败:', message || err)
        process.exit(1)
    }
}

testDBConnection()

export default {
    query: async (sql: string, params: unknown[] = []) => {
        const [rows] = await db.query(sql, params);
        return rows;
    }
}
