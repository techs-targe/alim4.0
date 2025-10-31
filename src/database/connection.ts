import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// データベースファイルのパス
const DB_PATH = process.env.DB_PATH || './data/alim.db'

let db: Database.Database | null = null

/**
 * データベース接続を取得
 */
export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { verbose: console.log })

    // WALモードを有効化（パフォーマンス向上）
    db.pragma('journal_mode = WAL')

    console.log(`📦 Database connected: ${DB_PATH}`)
  }

  return db
}

/**
 * データベース初期化（スキーマ適用）
 */
export function initializeDatabase(): void {
  const db = getDatabase()

  // スキーマファイルを読み込んで実行
  const schemaPath = join(__dirname, 'schema.sql')
  const schema = readFileSync(schemaPath, 'utf-8')

  // セミコロンで分割して各SQL文を実行
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  for (const statement of statements) {
    db.exec(statement)
  }

  console.log('✅ Database schema initialized')
}

/**
 * データベース接続をクローズ
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    console.log('📦 Database connection closed')
  }
}

/**
 * トランザクション実行
 */
export function transaction<T>(fn: (db: Database.Database) => T): T {
  const db = getDatabase()
  const txn = db.transaction(fn)
  return txn(db)
}
