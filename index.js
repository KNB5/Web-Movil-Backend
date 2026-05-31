const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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

// ==========================================
// ENDPOINTS PARA AUTENTICACIÓN (EP 2.2 / 2.3)
// ==========================================

// 1. POST: Registro de usuario
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nombre, apellido, rut, email, region, comuna, password } = req.body;

    // Validación básica de campos
    if (!nombre || !apellido || !rut || !email || !region || !comuna || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Verificar si el correo ya está registrado
    const userExist = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [email]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
    }

    // Encriptar la contraseña con bcrypt
    const saltRounds = 10;
    const contrasenaHash = await bcrypt.hash(password, saltRounds);

    // Rol por defecto: 1 (usuario)
    const idRolUsuario = 1;

    // Insertar el nuevo usuario en la base de datos
    const result = await pool.query(
      `INSERT INTO usuarios (id_rol, nombre, apellido, correo, contrasena_hash, region, comuna, rut) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [idRolUsuario, nombre, apellido, email, contrasenaHash, region, comuna, rut]
    );

    const newUser = result.rows[0];

    // Generar el token JWT
    const token = jwt.sign(
      { id: newUser.id_usuario, email: newUser.correo, role: 'user' },
      process.env.JWT_SECRET || 'una_clave_secreta_muy_segura_para_los_tokens',
      { expiresIn: '24h' }
    );

    // Retornar en el formato que espera el Frontend
    res.status(201).json({
      user: {
        id: newUser.id_usuario.toString(),
        nombre: newUser.nombre,
        apellido: newUser.apellido,
        email: newUser.correo,
        rut: newUser.rut,
        region: newUser.region,
        comuna: newUser.comuna,
        role: 'user'
      },
      token
    });
  } catch (error) {
    console.error('Error en registro:', error.message);
    res.status(500).json({ error: 'Error interno del servidor en el registro' });
  }
});

// 2. POST: Inicio de sesión
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }

    // Buscar al usuario en la base de datos
    const userResult = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas (correo no encontrado)' });
    }

    const user = userResult.rows[0];

    // Comparar la contraseña (soporte flexible para texto plano y bcrypt hashes)
    let isMatch = false;
    if (user.contrasena_hash.startsWith('$2b$') || user.contrasena_hash.startsWith('$2a$')) {
      isMatch = await bcrypt.compare(password, user.contrasena_hash);
    } else {
      isMatch = (password === user.contrasena_hash); // Para usuarios creados a mano en pgAdmin
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas (contraseña incorrecta)' });
    }

    // Obtener el nombre del rol del usuario
    const roleResult = await pool.query('SELECT nombre_rol FROM roles WHERE id_rol = $1', [user.id_rol]);
    const roleName = roleResult.rows.length > 0 && roleResult.rows[0].nombre_rol === 'administrador' ? 'admin' : 'user';

    // Generar el token JWT
    const token = jwt.sign(
      { id: user.id_usuario, email: user.correo, role: roleName },
      process.env.JWT_SECRET || 'una_clave_secreta_muy_segura_para_los_tokens',
      { expiresIn: '24h' }
    );

    // Retornar en el formato que espera el Frontend
    res.status(200).json({
      user: {
        id: user.id_usuario.toString(),
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.correo,
        rut: user.rut,
        region: user.region,
        comuna: user.comuna,
        role: roleName
      },
      token
    });
  } catch (error) {
    console.error('Error en login:', error.message);
    res.status(500).json({ error: 'Error interno del servidor en el inicio de sesión' });
  }
});

// 3. PUT: Actualizar perfil del usuario
app.put('/api/auth/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, email } = req.body;

    if (!nombre || !apellido || !email) {
      return res.status(400).json({ error: 'Nombre, apellido y correo son obligatorios' });
    }

    // Verificar si el correo está siendo utilizado por otro usuario
    const emailCheck = await pool.query(
      'SELECT * FROM usuarios WHERE correo = $1 AND id_usuario <> $2',
      [email, id]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya está en uso por otro usuario' });
    }

    // Actualizar el usuario en la base de datos
    const result = await pool.query(
      `UPDATE usuarios 
       SET nombre = $1, apellido = $2, correo = $3 
       WHERE id_usuario = $4 RETURNING *`,
      [nombre, apellido, email, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const updatedUser = result.rows[0];

    // Obtener el rol del usuario
    const roleResult = await pool.query('SELECT nombre_rol FROM roles WHERE id_rol = $1', [updatedUser.id_rol]);
    const roleName = roleResult.rows.length > 0 && roleResult.rows[0].nombre_rol === 'administrador' ? 'admin' : 'user';

    // Retornar el usuario actualizado en el formato que espera el Frontend
    res.status(200).json({
      id: updatedUser.id_usuario.toString(),
      nombre: updatedUser.nombre,
      apellido: updatedUser.apellido,
      email: updatedUser.correo,
      rut: updatedUser.rut,
      region: updatedUser.region,
      comuna: updatedUser.comuna,
      role: roleName
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error.message);
    res.status(500).json({ error: 'Error interno del servidor al actualizar perfil' });
  }
});

// Encender el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});