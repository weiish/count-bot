const mysql = require('mysql')
const keys = require('../config/keys')
const util = require('util');
const connection = mysql.createConnection({
    host: keys.DB_HOST,
    user: keys.DB_USER,
    password: keys.DB_PASS,
    database: keys.DB_NAME,
    charset: 'utf8mb4'
})
const query = util.promisify(connection.query).bind(connection);

connection.connect((err) => {
    if (err) throw err;
    console.log('Database Connected')
})

module.exports = { connection, query}