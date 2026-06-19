const db = require('../config/db')

// GET /api/ordenes
const listar = async (req, res) => {
  try {
    const { estado, tecnico_id, buscar, limit = 50, offset = 0 } = req.query
    const conditions = []
    const params = []
    let i = 1

    if (estado) { conditions.push(`o.estado = $${i++}`); params.push(estado) }
    if (tecnico_id) { conditions.push(`o.tecnico_id = $${i++}`); params.push(tecnico_id) }
    if (buscar) {
      conditions.push(`(c.nombre ILIKE $${i} OR v.placa ILIKE $${i} OR CAST(o.numero AS TEXT) ILIKE $${i})`)
      params.push(`%${buscar}%`); i++
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

    const { rows } = await db.query(
      `SELECT o.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
              v.marca, v.modelo, v.placa, v.color,
              u.nombre AS tecnico_nombre,
              f.total_orden, f.pagado
       FROM ordenes o
       JOIN clientes c ON c.id = o.cliente_id
       JOIN vehiculos v ON v.id = o.vehiculo_id
       LEFT JOIN usuarios u ON u.id = o.tecnico_id
       LEFT JOIN orden_finanzas f ON f.orden_id = o.id
       ${where}
       ORDER BY o.fecha_entrada DESC
       LIMIT $${i} OFFSET $${i+1}`,
      [...params, parseInt(limit), parseInt(offset)]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// GET /api/ordenes/:id
const obtener = async (req, res) => {
  try {
    const { id } = req.params

    const { rows: [orden] } = await db.query(
      `SELECT o.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
              v.marca, v.modelo, v.placa, v.color, v.anio,
              u.nombre AS tecnico_nombre,
              f.total_piezas, f.total_mano_obra, f.total_orden,
              f.comision_tecnico, f.ganancia_neta, f.metodo_pago, f.pagado
       FROM ordenes o
       JOIN clientes c ON c.id = o.cliente_id
       JOIN vehiculos v ON v.id = o.vehiculo_id
       LEFT JOIN usuarios u ON u.id = o.tecnico_id
       LEFT JOIN orden_finanzas f ON f.orden_id = o.id
       WHERE o.id = $1`, [id]
    )
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })

    const { rows: items } = await db.query(
      'SELECT * FROM orden_items WHERE orden_id = $1 ORDER BY created_at', [id]
    )

    const { rows: fotos } = await db.query(
      'SELECT * FROM orden_fotos WHERE orden_id = $1 ORDER BY created_at', [id]
    )

    const { rows: historial } = await db.query(
      `SELECT h.*, u.nombre AS usuario_nombre
       FROM orden_historial h
       LEFT JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.orden_id = $1 ORDER BY h.created_at DESC`, [id]
    )

    res.json({ ...orden, items, fotos, historial })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// POST /api/ordenes
const crear = async (req, res) => {
  try {
    const {
      cliente_id, vehiculo_id, tecnico_id,
      tipo_servicio, prioridad = 'normal',
      problema_cliente, fecha_estimada, notas_internas
    } = req.body

    if (!cliente_id || !vehiculo_id) return res.status(400).json({ error: 'Cliente y vehículo requeridos' })

    const { rows } = await db.query(
      `INSERT INTO ordenes
         (cliente_id, vehiculo_id, tecnico_id, admin_id, tipo_servicio, prioridad, problema_cliente, fecha_estimada, notas_internas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [cliente_id, vehiculo_id, tecnico_id || null, req.usuario.id,
       tipo_servicio || null, prioridad, problema_cliente || null,
       fecha_estimada || null, notas_internas || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// PUT /api/ordenes/:id/estado
const cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params
    const { estado, notas } = req.body
    const estadosValidos = ['pendiente','en_proceso','esperando_aprobacion','aprobado','listo','entregado','cancelado']
    if (!estadosValidos.includes(estado)) return res.status(400).json({ error: 'Estado inválido' })

    await db.query(
      'SELECT cambiar_estado_orden($1, $2, $3, $4)',
      [id, estado, req.usuario.id, notas || null]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// POST /api/ordenes/:id/items
const agregarItem = async (req, res) => {
  try {
    const { id } = req.params
    const { descripcion, tipo = 'pieza', cantidad = 1, precio_unit, notas } = req.body
    if (!descripcion || precio_unit === undefined) return res.status(400).json({ error: 'Descripción y precio requeridos' })

    const { rows } = await db.query(
      `INSERT INTO orden_items (orden_id, descripcion, tipo, cantidad, precio_unit, notas)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, descripcion, tipo, cantidad, precio_unit, notas || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// DELETE /api/ordenes/:id/items/:itemId
const eliminarItem = async (req, res) => {
  try {
    const { itemId } = req.params
    await db.query('DELETE FROM orden_items WHERE id = $1', [itemId])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
}

module.exports = { listar, obtener, crear, cambiarEstado, agregarItem, eliminarItem }
