const router  = require('express').Router()
const { auth, soloAdmin } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')

const authCtrl     = require('../controllers/authController')
const clientesCtrl = require('../controllers/clientesController')
const vehiculosCtrl= require('../controllers/vehiculosController')
const ordenesCtrl  = require('../controllers/ordenesController')
const fotosCtrl    = require('../controllers/fotosController')
const waCtrl       = require('../controllers/whatsappController')
const finCtrl      = require('../controllers/finanzasController')

// ── Auth ──────────────────────────────────────────────────
router.post('/auth/login',    authCtrl.login)
router.get ('/auth/me',       auth, authCtrl.me)
router.post('/auth/registro', auth, soloAdmin, authCtrl.registro)

// ── Dashboard ─────────────────────────────────────────────
router.get('/dashboard', auth, finCtrl.dashboard)

// ── Clientes ──────────────────────────────────────────────
router.get   ('/clientes',     auth, clientesCtrl.listar)
router.post  ('/clientes',     auth, clientesCtrl.crear)
router.get   ('/clientes/:id', auth, clientesCtrl.obtener)
router.put   ('/clientes/:id', auth, clientesCtrl.actualizar)
router.delete('/clientes/:id', auth, soloAdmin, clientesCtrl.eliminar)

// ── Vehículos ─────────────────────────────────────────────
router.get('/vehiculos/:clienteId', auth, vehiculosCtrl.listar)
router.post('/vehiculos',           auth, vehiculosCtrl.crear)
router.put ('/vehiculos/:id',       auth, vehiculosCtrl.actualizar)

// ── Órdenes ───────────────────────────────────────────────
router.get   ('/ordenes',                   auth, ordenesCtrl.listar)
router.post  ('/ordenes',                   auth, ordenesCtrl.crear)
router.get   ('/ordenes/:id',               auth, ordenesCtrl.obtener)
router.put   ('/ordenes/:id/estado',        auth, ordenesCtrl.cambiarEstado)
router.post  ('/ordenes/:id/items',         auth, ordenesCtrl.agregarItem)
router.delete('/ordenes/:id/items/:itemId', auth, ordenesCtrl.eliminarItem)

// ── Fotos ─────────────────────────────────────────────────
router.get   ('/ordenes/:id/fotos', auth, fotosCtrl.listar)
router.post  ('/ordenes/:id/fotos', auth, upload.array('fotos', 10), fotosCtrl.subir)
router.delete('/fotos/:fotoId',     auth, fotosCtrl.eliminar)

// ── WhatsApp ──────────────────────────────────────────────
router.post('/whatsapp/enviar',          auth, waCtrl.enviar)
router.get ('/whatsapp/historial/:ordenId', auth, waCtrl.historial)
router.post('/ordenes/:id/cotizar',      auth, waCtrl.cotizar)

// ── Finanzas ──────────────────────────────────────────────
router.get ('/finanzas/resumen',              auth, finCtrl.resumen)
router.get ('/finanzas/por-dia',              auth, finCtrl.porDia)
router.get ('/finanzas/tecnicos',             auth, finCtrl.porTecnico)
router.post('/finanzas/pagar-comision/:tecnicoId', auth, soloAdmin, finCtrl.pagarComision)
router.put ('/finanzas/:ordenId/pago',        auth, finCtrl.registrarPago)

module.exports = router
