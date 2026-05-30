const express = require('express');
const cors = require('cors');
const pool = require('./db');

// Inicializar la aplicación
const app = express();
const PORT = 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Endpoint de prueba
app.get('/', (req, res) => {
  res.send('¡El backend de la Plataforma Municipal está vivo!');
});

// ==========================================
// ENDPOINTS PARA CARPETAS (EP 2.3)
// ==========================================

// 1. GET: Obtener todas las carpetas
app.get('/api/carpetas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM carpetas ORDER BY id_carpeta ASC');
    // 200 OK
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error.message);
    // 500 Internal Server Error
    res.status(500).json({ error: 'Error en el servidor al obtener las carpetas' });
  }
});

// 2. GET: Obtener una carpeta por ID
app.get('/api/carpetas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM carpetas WHERE id_carpeta = $1', [id]);
    
    if (result.rows.length === 0) {
      // 404 Not Found
      return res.status(404).json({ error: 'Carpeta no encontrada' });
    }
    
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 3. POST: Crear una nueva carpeta
app.post('/api/carpetas', async (req, res) => {
  try {
    const { nombre_carpeta } = req.body;
    
    // Validación básica
    if (!nombre_carpeta) {
      // 400 Bad Request
      return res.status(400).json({ error: 'El nombre de la carpeta es obligatorio' });
    }

    const result = await pool.query(
      'INSERT INTO carpetas (nombre_carpeta) VALUES ($1) RETURNING *',
      [nombre_carpeta]
    );
    
    // 201 Created
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Error al crear la carpeta' });
  }
});

// 4. PUT: Actualizar el nombre de una carpeta existente
app.put('/api/carpetas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_carpeta } = req.body;

    if (!nombre_carpeta) {
      return res.status(400).json({ error: 'El nuevo nombre es obligatorio' });
    }

    const result = await pool.query(
      'UPDATE carpetas SET nombre_carpeta = $1 WHERE id_carpeta = $2 RETURNING *',
      [nombre_carpeta, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Carpeta no encontrada para actualizar' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Error al actualizar la carpeta' });
  }
});

// 5. DELETE: Eliminar una carpeta
app.delete('/api/carpetas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM carpetas WHERE id_carpeta = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Carpeta no encontrada para eliminar' });
    }

    res.status(200).json({ mensaje: 'Carpeta eliminada exitosamente', carpeta: result.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Error al eliminar la carpeta (puede contener documentos)' });
  }
});

// Encender el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});