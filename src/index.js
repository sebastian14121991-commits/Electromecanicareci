require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const routes  = require('./routes')

const app  = express()
const PORT = process.env.PORT || 4000

// ── CORS ──────────────────────────────────────────────────
const origenes = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:3000',
]

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origenes.includes(origin) || origin.endsWith('.vercel.app')) {
      cb(null, true)
    } else {
      cb(new Error(`CORS bloqueado: ${origin}`))
    }
  },
  credentials: true,
}))

// ── Body parsers ──────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Health check ──────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, ts: new Date() }))

// ── API ───────────────────────────────────────────────────
app.use('/api', routes)

// ── 404 ───────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Ruta no encontrada: ${req.path}` }))

// ── Error handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Error interno del servidor' })
})

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🔧 MechPro Backend corriendo en http://localhost:${PORT}`)
  console.log(`   DB: ${process.env.DATABASE_URL ? '✓ configurada' : '✗ falta DATABASE_URL'}`)
  console.log(`   JWT: ${process.env.JWT_SECRET ? '✓ configurado' : '✗ falta JWT_SECRET'}`)
  console.log(`   Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? '✓ configurado' : '⚠ sin configurar (fotos deshabilitadas)'}`)
  console.log(`   WhatsApp: ${process.env.WA_TOKEN ? '✓ configurado' : '⚠ sin configurar (mensajes deshabilitados)'}\n`)
})
