const mysql = require('mysql')
const keys = require('../config/keys')
const util = require('util');
const pool = mysql.createPool({
    connectionLimit: 5,
    host: keys.DB_HOST,
    user: keys.DB_USER,
    password: keys.DB_PASS,
    database: keys.DB_NAME,
    charset: 'utf8mb4'
})

// Ping database to check for common exception errors.
pool.getConnection((err, connection) => {
    if (err) {
      if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.error('Database connection was closed.')
      }
      if (err.code === 'ER_CON_COUNT_ERROR') {
        console.error('Database has too many connections.')
      }
      if (err.code === 'ECONNREFUSED') {
        console.error('Database connection was refused.')
      }
    }
  
    if (connection) connection.release()
  
    return
  })

const query = util.promisify(pool.query).bind(pool);

module.exports = { pool, query}