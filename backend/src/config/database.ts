import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'code_collab',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
})

export const query = async <T = any>(sql: string, params?: any[]): Promise<T> => {
    const [rows] = await pool.execute(sql, params);
    return rows as T;
}

export const getConnection = async () => {
    return await pool.getConnection();
}

export default pool;