// server/api/db-test.get.ts
import db from '../db'
import { withAuthHandler } from '../utils/api'

export default withAuthHandler(async () => {
  const rows = await db.query('SELECT 1 AS ok')

  return {
    code: 200,
    message: '数据库连接成功',
    data: rows
  }
})
