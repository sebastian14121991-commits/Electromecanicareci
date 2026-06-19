const db = require('../config/db')
const { cloudinary } = require('../config/cloudinary')

// GET /api/ordenes/:id/fotos
const listar = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM orden_fotos WHERE orden_id = $1 ORDER BY created_at',
      [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
}

// POST /api/ordenes/:id/fotos
const subir = async (req, res) => {
  try {
    const { id } = req.params
    const { etapa, descripcion } = req.body
    const archivos = req.files || []

    if (!archivos.length) return res.status(400).json({ error: 'No se enviaron archivos' })

    const fotos = []
    for (const archivo of archivos) {
      const { rows } = await db.query(
        `INSERT INTO orden_fotos (orden_id, url, public_id, etapa, descripcion, subida_por)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, archivo.path, archivo.filename, etapa || null, descripcion || null, req.usuario.id]
      )
      fotos.push(rows[0])
    }

    res.status(201).json(fotos)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al subir fotos' })
  }
}

// DELETE /api/fotos/:fotoId
const eliminar = async (req, res) => {
  try {
    const { fotoId } = req.params
    const { rows: [foto] } = await db.query('SELECT * FROM orden_fotos WHERE id = $1', [fotoId])
    if (!foto) return res.status(404).json({ error: 'Foto no encontrada' })

    if (foto.public_id) {
      await cloudinary.uploader.destroy(foto.public_id).catch(() => {})
    }

    await db.query('DELETE FROM orden_fotos WHERE id = $1', [fotoId])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' })
  }
}

module.exports = { listar, subir, eliminar }
