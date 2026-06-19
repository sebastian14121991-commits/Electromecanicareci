const db = require('../config/db')

// GET /api/clientes
const listar = async (req, res) => {
  try {
    const { buscar = '', page = 1 } = req.query
    const limit = 20
    const offset = (parseInt(page) - 1) * limit

    let query, params
    if (buscar.trim()) {
      query = `
        SELECT c.*, COUNT(o.id) AS total_ordenes
        FROM clientes c
        LEFT JOIN ordenes o ON o.cliente_id = c.id
        WHERE c.activo = TRUE
          AND (c.nombre ILIKE $1 OR c.telefono ILIKE $1 OR c.cedula ILIKE $1)
        GROUP BY c.id
        ORDER BY c.nombre
        LIMIT $2 OFFSET $3
      `
      params = [`%${buscar}%`, limit, offset]
    } else {
      query = `
        SELECT c.*, COUNT(o.id) AS total_ordenes
        FROM clientes c
        LEFT JOIN ordenes o ON o.cliente_id = c.id
        WHERE c.activo = TRUE
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT $1 OFFSET $2
      `
      params = [limit, offset]
    }

    const { rows } = await db.query(query, params)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// GET /api/clientes/:id
const obtener = async (req, res) => {
  try {
    const { id } = req.params

    const { rows: [cliente] } = await db.query(
      'SELECT * FROM clientes WHERE id = $1 AND activo = TRUE', [id]
    )
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' })

    const { rows: vehiculos } = await db.query(
      'SELECT * FROM vehiculos WHERE cliente_id = $1 ORDER BY created_at DESC', [id]
    )

    const { rows: ordenes } = await db.query(
      `SELECT o.*, v.marca, v.modelo, v.placa, f.total_orden
       FROM ordenes o
       JOIN vehiculos v ON v.id = o.vehiculo_id
       LEFT JOIN orden_finanzas f ON f.orden_id = o.id
       WHERE o.cliente_id = $1
       ORDER BY o.created_at DESC
       LIMIT 20`, [id]
    )

    res.json({ ...cliente, vehiculos, ordenes })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// POST /api/clientes
const crear = async (req, res) => {
  try {
    const { nombre, telefono, email, cedula, direccion, notas } = req.body
    if (!nombre || !telefono) return res.status(400).json({ error: 'Nombre y teléfono requeridos' })

    const { rows } = await db.query(
      `INSERT INTO clientes (nombre, telefono, email, cedula, direccion, notas)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [nombre.trim(), telefono.trim(), email || null, cedula || null, direccion || null, notas || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// PUT /api/clientes/:id
const actualizar = async (req, res) => {
  try {
    const { id } = req.params
    const { nombre, telefono, email, cedula, direccion, notas } = req.body

    const { rows } = await db.query(
      `UPDATE clientes SET
         nombre=$1, telefono=$2, email=$3, cedula=$4, direccion=$5, notas=$6, updated_at=NOW()
       WHERE id=$7 AND activo=TRUE RETURNING *`,
      [nombre, telefono, email || null, cedula || null, direccion || null, notas || null, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// DELETE /api/clientes/:id (soft delete)
const eliminar = async (req, res) => {
  try {
    const { id } = req.params
    await db.query('UPDATE clientes SET activo=FALSE WHERE id=$1', [id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar }
