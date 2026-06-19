const bcrypt = require('bcryptjs')
const jwt    = require('jsonwebtoken')
const db     = require('../config/db')

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })

    const { rows } = await db.query(
      'SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE',
      [email.toLowerCase().trim()]
    )
    const usuario = rows[0]
    if (!usuario) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const ok = await bcrypt.compare(password, usuario.password_hash)
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre, email: usuario.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    )

    res.json({
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, avatar_url: usuario.avatar_url },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// GET /api/auth/me
const me = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, nombre, email, telefono, rol, avatar_url FROM usuarios WHERE id = $1',
      [req.usuario.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// POST /api/auth/registro (solo admin puede crear usuarios)
const registro = async (req, res) => {
  try {
    const { nombre, email, password, telefono, rol = 'tecnico' } = req.body
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Nombre, email y contraseña requeridos' })
    if (!['admin', 'tecnico'].includes(rol)) return res.status(400).json({ error: 'Rol inválido' })

    const hash = await bcrypt.hash(password, 10)
    const { rows } = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, telefono, rol)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, email, telefono, rol`,
      [nombre.trim(), email.toLowerCase().trim(), hash, telefono || null, rol]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' })
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
}

module.exports = { login, me, registro }
