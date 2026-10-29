const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../utils');

const router = express.Router();

const ORDER_DIAS = `CASE a.dia_semana
  WHEN 'Lunes' THEN 1 WHEN 'Martes' THEN 2 WHEN 'Miércoles' THEN 3
  WHEN 'Jueves' THEN 4 WHEN 'Viernes' THEN 5 WHEN 'Sábado' THEN 6
  WHEN 'Domingo' THEN 7 ELSE 8 END`;

async function getSocio(usuarioId) {
  const result = await query(
    `SELECT id, nombre, apellido, dni FROM socios WHERE usuario_id = @usuario_id`,
    { usuario_id: usuarioId }
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
    const [reservas, pendientes, pagado, proximas, ultimosPagos] = await Promise.all([
      query(
        `SELECT COUNT(*) AS total
         FROM inscripciones i
         JOIN actividades a ON a.id = i.actividad_id
         WHERE i.socio_id = @socio AND i.estado = 'confirmada' AND a.activa = 1`,
        { socio: socio.id }
      ),
      query(
        `SELECT COUNT(*) AS cantidad, ISNULL(SUM(monto), 0) AS total
         FROM pagos
         WHERE socio_id = @socio AND estado IN ('pendiente', 'vencido')`,
        { socio: socio.id }
      ),
      query(
        `SELECT ISNULL(SUM(monto), 0) AS total
         FROM pagos WHERE socio_id = @socio AND estado = 'pagado'`,
        { socio: socio.id }
      ),
      query(
        `SELECT TOP 4 a.nombre, a.dia_semana, a.hora_inicio, a.hora_fin, a.sala,
                p.nombre + ' ' + p.apellido AS profesor
         FROM inscripciones i
         JOIN actividades a ON a.id = i.actividad_id
         LEFT JOIN profesores p ON p.id = a.profesor_id
         WHERE i.socio_id = @socio AND i.estado = 'confirmada' AND a.activa = 1
         ORDER BY ${ORDER_DIAS}, a.hora_inicio`,
        { socio: socio.id }
      ),
      query(
        `SELECT TOP 4 concepto, monto, fecha_pago, fecha_vencimiento, estado
         FROM pagos
         WHERE socio_id = @socio
         ORDER BY ISNULL(fecha_pago, fecha_vencimiento) DESC, id DESC`,
        { socio: socio.id }
      ),
    ]);

    res.render('socio/dashboard', {
      title: 'Mi panel',
      stats: {
        reservas: reservas.recordset[0].total,
        cuotasPendientes: pendientes.recordset[0].cantidad,
        deuda: pendientes.recordset[0].total,
        pagado: pagado.recordset[0].total,
      },
      proximas: proximas.recordset,
      ultimosPagos: ultimosPagos.recordset,
      active: 'resumen',
    });
  })
);

router.get(
  '/actividades',
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT a.*, p.nombre + ' ' + p.apellido AS profesor,
              (SELECT COUNT(*) FROM inscripciones i
                WHERE i.actividad_id = a.id AND i.estado = 'confirmada') AS inscriptos,
              mi.id AS mi_inscripcion_id,
              mi.estado AS mi_estado
       FROM actividades a
       LEFT JOIN profesores p ON p.id = a.profesor_id
       LEFT JOIN inscripciones mi ON mi.actividad_id = a.id AND mi.socio_id = @socio
       WHERE a.activa = 1
       ORDER BY ${ORDER_DIAS}, a.hora_inicio`,
      { socio: req.socio.id }
    );

    res.render('socio/actividades', {
      title: 'Actividades',
      actividades: result.recordset,
      active: 'actividades',
    });
  })
);

router.post(
  '/reservas/:actividadId',
  asyncHandler(async (req, res) => {
    const actividadId = Number(req.params.actividadId);
    const socioId = req.socio.id;

    const actividad = await query(
      `SELECT id, cupo,
              (SELECT COUNT(*) FROM inscripciones i
                WHERE i.actividad_id = actividades.id AND i.estado = 'confirmada') AS inscriptos
       FROM actividades WHERE id = @id AND activa = 1`,
      { id: actividadId }
    );
    const clase = actividad.recordset[0];
    if (!clase) {
      req.flash('error', 'La actividad no existe o no está disponible.');
      return res.redirect('/socio/actividades');
    }

    const existente = await query(
      `SELECT id, estado FROM inscripciones
       WHERE socio_id = @socio AND actividad_id = @actividad`,
      { socio: socioId, actividad: actividadId }
    );

    if (existente.recordset[0]) {
      if (existente.recordset[0].estado === 'confirmada') {
        req.flash('info', 'Ya tenés una reserva en esa clase.');
      } else {
        await query(
          `UPDATE inscripciones
           SET estado = 'confirmada', fecha_reserva = SYSDATETIME()
           WHERE id = @id`,
          { id: existente.recordset[0].id }
        );
        req.flash('success', 'Reserva reactivada correctamente.');
      }
      return res.redirect('/socio/actividades');
    }

    if (clase.inscriptos >= clase.cupo) {
      req.flash('error', 'La clase está completa. Probá con otra actividad.');
      return res.redirect('/socio/actividades');
    }

    await query(
      `INSERT INTO inscripciones (socio_id, actividad_id)
       VALUES (@socio, @actividad)`,
      { socio: socioId, actividad: actividadId }
    );
    req.flash('success', '¡Reserva confirmada! Nos vemos en el gimnasio.');
    res.redirect('/socio/actividades');
  })
);

router.post(
  '/reservas/:id/cancelar',
  asyncHandler(async (req, res) => {
    const result = await query(
      `UPDATE inscripciones
       SET estado = 'cancelada'
       WHERE id = @id AND socio_id = @socio AND estado = 'confirmada'`,
      { id: Number(req.params.id), socio: req.socio.id }
    );
    if (result.rowsAffected[0] > 0) {
      req.flash('success', 'Reserva cancelada.');
    } else {
      req.flash('error', 'No se pudo cancelar esa reserva.');
    }
    const back = String(req.body.redirect || '');
    res.redirect(back.startsWith('/socio') ? back : '/socio/reservas');
  })
);

router.get(
  '/reservas',
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT i.id, i.estado, i.fecha_reserva,
              a.nombre, a.dia_semana, a.hora_inicio, a.hora_fin, a.sala, a.precio,
              p.nombre + ' ' + p.apellido AS profesor
       FROM inscripciones i
       JOIN actividades a ON a.id = i.actividad_id
       LEFT JOIN profesores p ON p.id = a.profesor_id
       WHERE i.socio_id = @socio
       ORDER BY ${ORDER_DIAS}, a.hora_inicio`,
      { socio: req.socio.id }
    );

    res.render('socio/reservas', {
      title: 'Mis reservas',
      reservas: result.recordset,
      active: 'reservas',
    });
  })
);

router.get(
  '/pagos',
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT id, concepto, monto, metodo_pago, fecha_pago, fecha_vencimiento, estado
       FROM pagos
       WHERE socio_id = @socio
       ORDER BY ISNULL(fecha_pago, fecha_vencimiento) DESC, id DESC`,
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
