const db = require('../config/db')

const enviarMensajeWA = async (telefono, mensaje) => {
  const token   = process.env.WA_TOKEN
  const phoneId = process.env.WA_PHONE_ID

  if (!token || !phoneId) {
    throw new Error('WhatsApp no configurado. Agrega WA_TOKEN y WA_PHONE_ID al .env')
  }

  // Limpiar número: quitar espacios, guiones
  const numero = telefono.replace(/[\s\-()]/g, '')

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numero,
        type: 'text',
        text: { body: mensaje },
      }),
    }
  )

  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Error enviando WhatsApp')
  return data
}

// POST /api/whatsapp/enviar
const enviar = async (req, res) => {
  try {
    const { telefono, mensaje, orden_id, cliente_id, tipo = 'manual' } = req.body
    if (!telefono || !mensaje) return res.status(400).json({ error: 'Teléfono y mensaje requeridos' })

    let wabaId = null
    let estado = 'enviado'

    try {
      const waRes = await enviarMensajeWA(telefono, mensaje)
      wabaId = waRes?.messages?.[0]?.id
    } catch (err) {
      estado = 'fallido'
      // Guardar igualmente el intento
    }

    await db.query(
      `INSERT INTO whatsapp_mensajes (orden_id, cliente_id, telefono, tipo, mensaje, estado, waba_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [orden_id || null, cliente_id || null, telefono, tipo, mensaje, estado, wabaId]
    )

    if (estado === 'fallido') {
      return res.status(502).json({ error: 'No se pudo enviar el mensaje. Verifica la configuración del token.' })
    }

    res.json({ ok: true, waba_id: wabaId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}

// GET /api/whatsapp/historial/:ordenId
const historial = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM whatsapp_mensajes WHERE orden_id = $1 ORDER BY created_at DESC',
      [req.params.ordenId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// POST /api/ordenes/:id/cotizar  — envía cotización automática
const cotizar = async (req, res) => {
  try {
    const { id } = req.params

    const { rows: [orden] } = await db.query(
      `SELECT o.*, c.nombre AS cliente_nombre, c.telefono,
              v.marca, v.modelo, v.placa,
              f.total_orden
       FROM ordenes o
       JOIN clientes c ON c.id = o.cliente_id
       JOIN vehiculos v ON v.id = o.vehiculo_id
       LEFT JOIN orden_finanzas f ON f.orden_id = o.id
       WHERE o.id = $1`, [id]
    )
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })

    const { rows: items } = await db.query(
      'SELECT * FROM orden_items WHERE orden_id = $1', [id]
    )

    const lineas = items.map(i =>
      `• ${i.descripcion}: $${parseFloat(i.subtotal).toFixed(2)}`
    ).join('\n')

    const mensaje = `Hola ${orden.cliente_nombre}, le enviamos la cotización de Electromecánica RECI para su vehículo ${orden.marca} ${orden.modelo} (${orden.placa || 'sin placa'}):\n\n${lineas}\n\nTOTAL: $${parseFloat(orden.total_orden || 0).toFixed(2)}\n\nResponda *SI* para aprobar o llámenos para más detalles. 🔧`

    await enviarMensajeWA(orden.telefono, mensaje).catch(() => {})

    await db.query(
      'UPDATE ordenes SET cotizacion_enviada=TRUE, estado=\'esperando_aprobacion\', updated_at=NOW() WHERE id=$1',
      [id]
    )

    res.json({ ok: true, mensaje })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}

module.exports = { enviar, historial, cotizar }
