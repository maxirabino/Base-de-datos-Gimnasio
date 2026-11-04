const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../utils');

const router = express.Router();

async function getSocio(usuarioId) {
  const result = await query(
    `SELECT id_socio AS id, nombre, apellidos AS apellido, documento AS dni FROM Socios WHERE id_socio = @id_socio`,
    { id_socio: usuarioId }
  );
  return result.recordset[0] || null;
}

router.use(asyncHandler(async (req, res, next) => {
  const socio = await getSocio(req.session.user.id);
  if (!socio) {
    return res.status(403).render('error', {
      title: 'Acceso denegado',
      status: 403,
      message: 'Tu usuario no tiene un perfil de socio asociado.',
    });
  }
  req.socio = socio;
  res.locals.socio = socio;
  next();
}));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const socio = req.socio;

    // Consultamos los pagos del socio de forma segura
    const ultimosPagos = await query(
      `SELECT TOP 5 id_pago AS id, ISNULL(monto_abonado, 0) AS monto, fecha_pago, fecha_vencimiento, ISNULL(concepto, 'Cuota') AS concepto 
       FROM Pagos 
       WHERE id_socio = @socio 
       ORDER BY fecha_pago DESC`,
      { socio: socio.id }
    );

    res.render('socio/dashboard', {
      title: 'Mi panel',
      stats: {
        reservas: 0,
        cuotasPendientes: 0,
        deuda: 0,
        pagado: 0,
      },
      proximas: [],
      ultimosPagos: ultimosPagos.recordset,
      active: 'resumen',
    });
  })
);

router.get(
  '/actividades',
  asyncHandler(async (req, res) => {
    res.render('socio/actividades', {
      title: 'Actividades',
      actividades: [],
      active: 'actividades',
    });
  })
);

router.get(
  '/reservas',
  asyncHandler(async (req, res) => {
    res.render('socio/reservas', {
      title: 'Mis reservas',
      reservas: [],
      active: 'reservas',
    });
  })
);

router.get(
  '/pagos',
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT id_pago AS id, ISNULL(monto_abonado, 0) AS monto, fecha_pago, fecha_vencimiento, ISNULL(concepto, 'Cuota') AS concepto 
       FROM Pagos 
       WHERE id_socio = @socio 
       ORDER BY fecha_pago DESC`,
      { socio: req.socio.id }
    );

    res.render('socio/pagos', {
      title: 'Mis cuotas',
      pagos: result.recordset,
      active: 'pagos',
    });
  })
);

module.exports = router;