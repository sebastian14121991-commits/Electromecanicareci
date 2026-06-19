const db = require('../config/db')

// GET /api/vehiculos/:clienteId
const listar = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM vehiculos WHERE cliente_id = $1 ORDER BY created_at DESC',
      [req.params.clienteId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// POST /api/vehiculos
const crear = async (req, res) => {
  try {
    const { cliente_id, marca, modelo, anio, placa, color, vin, kilometraje, notas } = req.body
    if (!cliente_id || !marca || !modelo) return res.status(400).json({ error: 'Cliente, marca y modelo requeridos' })

    const { rows } = await db.query(
      `INSERT INTO vehiculos (cliente_id, marca, modelo, anio, placa, color, vin, kilometraje, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [cliente_id, marca.trim(), modelo.trim(), anio || null, placa || null, color || null, vin || null, kilometraje || null, notas || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// PUT /api/vehiculos/:id
const actualizar = async (req, res) => {
  try {
    const { id } = req.params
    const { marca, modelo, anio, placa, color, vin, kilometraje, notas } = req.body

    const { rows } = await db.query(
      `UPDATE vehiculos SET marca=$1, modelo=$2, anio=$3, placa=$4, color=$5, vin=$6,
         kilometraje=$7, notas=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [marca, modelo, anio || null, placa || null, color || null, vin || null, kilometraje || null, notas || null, id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Vehículo no encontrado' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
}

module.exports = { listar, crear, actualizar }
