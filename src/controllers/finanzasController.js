const db = require('../config/db')

// GET /api/dashboard
const dashboard = async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0]

    const { rows: [metricas] } = await db.query(`
      SELECT
        COUNT(DISTINCT o.id) FILTER (WHERE DATE(o.fecha_entrada) = $1) AS ordenes_hoy,
        COALESCE(SUM(f.total_orden) FILTER (WHERE DATE(o.fecha_entrada) = $1 AND f.pagado), 0) AS ingresos_hoy,
        COALESCE(SUM(f.ganancia_neta) FILTER (WHERE DATE(o.fecha_entrada) = $1 AND f.pagado), 0) AS ganancia_hoy,
        COUNT(*) FILTER (WHERE o.estado = 'en_proceso') AS en_proceso
      FROM ordenes o
      LEFT JOIN orden_finanzas f ON f.orden_id = o.id
    `, [hoy])

    const { rows: tecnicos } = await db.query(`
      SELECT u.id, u.nombre,
        COUNT(o.id) FILTER (WHERE DATE(o.fecha_entrada) = $1) AS trabajos_hoy,
        COALESCE(SUM(c.monto) FILTER (WHERE DATE(o.fecha_entrada) = $1), 0) AS comision_hoy
      FROM usuarios u
      JOIN ordenes o ON o.tecnico_id = u.id
      LEFT JOIN comisiones c ON c.tecnico_id = u.id AND c.orden_id = o.id
      WHERE u.rol = 'tecnico' AND u.activo = TRUE
      GROUP BY u.id, u.nombre
      HAVING COUNT(o.id) FILTER (WHERE DATE(o.fecha_entrada) = $1) > 0
      ORDER BY trabajos_hoy DESC
    `, [hoy])

    res.json({ metricas, tecnicos })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// GET /api/finanzas/resumen
const resumen = async (req, res) => {
  try {
    const ahora = new Date()
    const desde = req.query.desde || new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0]
    const hasta = req.query.hasta || ahora.toISOString().split('T')[0]

    const { rows: [r] } = await db.query(`
      SELECT
        COALESCE(SUM(f.total_orden), 0)        AS ingresos_brutos,
        COALESCE(SUM(f.ganancia_neta), 0)      AS ganancia_neta,
        COALESCE(SUM(f.comision_tecnico), 0)   AS total_comisiones,
        COALESCE(AVG(f.total_orden), 0)        AS ticket_promedio,
        COUNT(DISTINCT o.id)                   AS total_ordenes,
        COUNT(*) FILTER (WHERE o.estado = 'entregado') AS ordenes_entregadas
      FROM ordenes o
      JOIN orden_finanzas f ON f.orden_id = o.id
      WHERE DATE(o.fecha_entrada) BETWEEN $1 AND $2
    `, [desde, hasta])

    res.json(r)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// GET /api/finanzas/por-dia
const porDia = async (req, res) => {
  try {
    const ahora = new Date()
    const desde = req.query.desde || new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const hasta = req.query.hasta || ahora.toISOString().split('T')[0]

    const { rows } = await db.query(`
      SELECT
        DATE(o.fecha_entrada) AS dia,
        COALESCE(SUM(f.total_orden), 0)   AS ingresos,
        COALESCE(SUM(f.ganancia_neta), 0) AS ganancia,
        COUNT(o.id)                        AS ordenes
      FROM ordenes o
      LEFT JOIN orden_finanzas f ON f.orden_id = o.id
      WHERE DATE(o.fecha_entrada) BETWEEN $1 AND $2
      GROUP BY DATE(o.fecha_entrada)
      ORDER BY dia
    `, [desde, hasta])

    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// GET /api/finanzas/tecnicos
const porTecnico = async (req, res) => {
  try {
    const ahora = new Date()
    const desde = req.query.desde || new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0]
    const hasta = req.query.hasta || ahora.toISOString().split('T')[0]

    const { rows } = await db.query(`
      SELECT
        u.id, u.nombre,
        COUNT(DISTINCT o.id) AS trabajos,
        COALESCE(SUM(f.total_mano_obra), 0)                         AS mano_obra_total,
        COALESCE(SUM(f.comision_tecnico), 0)                        AS comisiones_generadas,
        COALESCE(SUM(c.monto) FILTER (WHERE c.pagada = TRUE), 0)    AS comisiones_pagadas,
        COALESCE(SUM(c.monto) FILTER (WHERE c.pagada = FALSE), 0)   AS comisiones_pendientes
      FROM usuarios u
      LEFT JOIN ordenes o ON o.tecnico_id = u.id
        AND DATE(o.fecha_entrada) BETWEEN $1 AND $2
      LEFT JOIN orden_finanzas f ON f.orden_id = o.id
      LEFT JOIN comisiones c ON c.tecnico_id = u.id AND c.orden_id = o.id
      WHERE u.rol = 'tecnico' AND u.activo = TRUE
      GROUP BY u.id, u.nombre
      ORDER BY comisiones_generadas DESC
    `, [desde, hasta])

    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// POST /api/finanzas/pagar-comision/:tecnicoId
const pagarComision = async (req, res) => {
  try {
    const { tecnicoId } = req.params
    const { hasta_fecha } = req.body

    await db.query(
      `UPDATE comisiones SET pagada=TRUE, fecha_pago=NOW()
       WHERE tecnico_id=$1 AND pagada=FALSE
       ${hasta_fecha ? 'AND created_at <= $2' : ''}`,
      hasta_fecha ? [tecnicoId, hasta_fecha] : [tecnicoId]
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// PUT /api/finanzas/:ordenId/pago
const registrarPago = async (req, res) => {
  try {
    const { ordenId } = req.params
    const { metodo_pago } = req.body

    await db.query(
      `UPDATE orden_finanzas SET pagado=TRUE, metodo_pago=$1, fecha_pago=NOW(), updated_at=NOW()
       WHERE orden_id=$2`,
      [metodo_pago, ordenId]
    )

    // Registrar comisión si tiene técnico
    const { rows: [orden] } = await db.query(
      'SELECT tecnico_id FROM ordenes WHERE id=$1', [ordenId]
    )
    if (orden?.tecnico_id) {
      const { rows: [fin] } = await db.query(
        'SELECT comision_tecnico FROM orden_finanzas WHERE orden_id=$1', [ordenId]
      )
      if (fin?.comision_tecnico > 0) {
        await db.query(
          `INSERT INTO comisiones (tecnico_id, orden_id, monto)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [orden.tecnico_id, ordenId, fin.comision_tecnico]
        )
      }
    }

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error del servidor' })
  }
}

module.exports = { dashboard, resumen, porDia, porTecnico, pagarComision, registrarPago }
