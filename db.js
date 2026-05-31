const { Pool } = require('pg');
require('dotenv').config(); // Esto carga las variables de tu archivo .env

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.connect()
  .then(() => console.log('Conexión exitosa a la base de datos de la Municipalidad'))
  .catch(err => console.error('Error conectando a la base de datos', err.stack));

module.exports = pool;