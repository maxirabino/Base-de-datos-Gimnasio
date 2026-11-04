const express = require('express');
const { query } = require('../db');
const { asyncHandler, APPLY_ULTIMO_PAGO, ESTADO_CUOTA_SQL } = require('../utils');

const router = express.Router();

router.use(
  asyncHandler(async (req, res, next) => {
    const result = await query(
      `SELECT s.id_socio, s.nombre, s.apellidos, s.documento,
              up.tipo_plan, up.fecha_vencimiento, ${ESTADO_CUOTA_SQL} AS estado_cuota
       FROM Socios s ${APPLY_ULTIMO_PAGO}
       WHERE s.id_socio = @id`,
      { id: req.session.user.idSocio }
    );
    const socio = result.recordset[0];
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
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const id = req.socio.id_socio;
    const [resumen, ingresos, pagos] = await Promise.all([
      query(
        `SELECT
           (SELECT COUNT(*) FROM Control_Ingresos
             WHERE id_socio = @id AND fecha >= DATEADD(DAY, -30, CAST(GETDATE() AS DATE))) AS asistencias_30d,
           (SELECT COUNT(*) FROM Rutinas_Personalizadas WHERE id_socio = @id) AS rutinas,
           (SELECT TOP 1 peso_kg FROM Evolucion_Fisica WHERE id_socio = @id
             ORDER BY fecha_registro DESC, id_evolucion DESC) AS peso,
           (SELECT TOP 1 porcentaje_grasa FROM Evolucion_Fisica WHERE id_socio = @id
             ORDER BY fecha_registro DESC, id_evolucion DESC) AS grasa`,
        { id }
      ),
      query(
        `SELECT TOP 5 ci.fecha, ci.hora_ingreso, ci.hora_egreso, sd.nombre_sede
         FROM Control_Ingresos ci
         JOIN Sedes sd ON sd.id_sede = ci.id_sede
         WHERE ci.id_socio = @id
         ORDER BY ci.fecha DESC, ci.hora_ingreso DESC`,
        { id }
      ),
      query(
        `SELECT TOP 4 m.tipo_plan, p.monto_abonado, p.fecha_pago, p.fecha_vencimiento,
                CASE WHEN p.fecha_vencimiento >= CAST(GETDATE() AS DATE) THEN 'vigente' ELSE 'vencido' END AS estado
         FROM Pagos p JOIN Membresias m ON m.id_membresia = p.id_membresia
         WHERE p.id_socio = @id
         ORDER BY p.fecha_pago DESC, p.id_pago DESC`,
        { id }
      ),
    ]);

    res.render('socio/dashboard', {
      title: 'Mi panel',
      stats: resumen.recordset[0],
      ingresos: ingresos.recordset,
      ultimosPagos: pagos.recordset,
      active: 'resumen',
    });
  })
);

router.get(
  '/rutinas',
  asyncHandler(async (req, res) => {
    const asignaciones = await query(
      `SELECT rp.id_asignacion, rp.fecha_asignacion, rp.observaciones,
              r.id_rutina, r.nombre_rutina, r.objetivo, r.nivel, r.duracion_semanas,
              e.nombre + ' ' + e.apellido AS entrenador
       FROM Rutinas_Personalizadas rp
       JOIN Rutinas r ON r.id_rutina = rp.id_rutina
       JOIN Entrenadores e ON e.id_entrenador = rp.id_entrenador
       WHERE rp.id_socio = @id
       ORDER BY rp.fecha_asignacion DESC, rp.id_asignacion DESC`,
      { id: req.socio.id_socio }
    );
    const ejercicios = await query(
      `SELECT id_rutina, nombre_ejercicio, grupo_muscular, series, repeticiones, carga_kg
       FROM Ejercicios
       WHERE id_rutina IN (SELECT id_rutina FROM Rutinas_Personalizadas WHERE id_socio = @id)
       ORDER BY id_ejercicio`,
      { id: req.socio.id_socio }
    );
    const porRutina = new Map();
    for (const ej of ejercicios.recordset) {
      if (!porRutina.has(ej.id_rutina)) porRutina.set(ej.id_rutina, []);
      porRutina.get(ej.id_rutina).push(ej);
    }
    const rutinas = asignaciones.recordset.map((a) => ({ ...a, ejercicios: porRutina.get(a.id_rutina) || [] }));

    res.render('socio/rutinas', { title: 'Mis rutinas', rutinas, active: 'rutinas' });
  })
);

router.get(
  '/evolucion',
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT fecha_registro, peso_kg, porcentaje_grasa, masa_muscular_kg, observaciones
       FROM Evolucion_Fisica WHERE id_socio = @id
       ORDER BY fecha_registro DESC, id_evolucion DESC`,
      { id: req.socio.id_socio }
    );
    res.render('socio/evolucion', { title: 'Mi evolución', registros: result.recordset, active: 'evolucion' });
  })
);

router.get(
  '/pagos',
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT m.tipo_plan, p.monto_abonado, p.metodo_pago, p.fecha_pago, p.fecha_vencimiento,
              CASE WHEN p.fecha_vencimiento >= CAST(GETDATE() AS DATE) THEN 'vigente' ELSE 'vencido' END AS estado
       FROM Pagos p JOIN Membresias m ON m.id_membresia = p.id_membresia
       WHERE p.id_socio = @id
       ORDER BY p.fecha_pago DESC, p.id_pago DESC`,
      { id: req.socio.id_socio }
    );
    res.render('socio/pagos', { title: 'Mi membresía', pagos: result.recordset, active: 'pagos' });
  })
);

module.exports = router;
