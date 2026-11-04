const express = require('express');
const { query } = require('../db');
const { clean, toNumberOrNull, asyncHandler, APPLY_ULTIMO_PAGO, ESTADO_CUOTA_SQL } = require('../utils');

const router = express.Router();

router.use(
  asyncHandler(async (req, res, next) => {
    const result = await query(
      `SELECT id_entrenador, nombre, apellido, especialidad, certificaciones
       FROM Entrenadores WHERE id_entrenador = @id`,
      { id: req.session.user.idEntrenador }
    );
    const entrenador = result.recordset[0];
    if (!entrenador) {
      return res.status(403).render('error', {
        title: 'Acceso denegado',
        status: 403,
        message: 'Tu usuario no tiene un perfil de entrenador asociado.',
      });
    }
    req.entrenador = entrenador;
    res.locals.entrenador = entrenador;
    next();
  })
);

async function cargarFormularioAsignacion() {
  const [socios, rutinas] = await Promise.all([
    query(`SELECT id_socio, nombre + ' ' + apellidos AS nombre, documento FROM Socios ORDER BY apellidos, nombre`),
    query(`SELECT id_rutina, nombre_rutina, nivel FROM Rutinas ORDER BY nombre_rutina`),
  ]);
  return { socios: socios.recordset, rutinas: rutinas.recordset };
}

async function cargarAsignaciones(idEntrenador) {
  const result = await query(
    `SELECT rp.id_asignacion, rp.fecha_asignacion, rp.observaciones,
            s.id_socio, s.nombre + ' ' + s.apellidos AS socio,
            r.nombre_rutina, r.nivel, r.objetivo
     FROM Rutinas_Personalizadas rp
     JOIN Socios s ON s.id_socio = rp.id_socio
     JOIN Rutinas r ON r.id_rutina = rp.id_rutina
     WHERE rp.id_entrenador = @id
     ORDER BY rp.fecha_asignacion DESC, rp.id_asignacion DESC`,
    { id: idEntrenador }
  );
  return result.recordset;
}

async function renderDashboard(req, res, { errors = [], old = {}, status = 200 } = {}) {
  const [asignaciones, form] = await Promise.all([
    cargarAsignaciones(req.entrenador.id_entrenador),
    cargarFormularioAsignacion(),
  ]);
  res.status(status).render('entrenador/dashboard', {
    title: 'Panel del entrenador',
    asignaciones,
    totalSocios: new Set(asignaciones.map((a) => a.id_socio)).size,
    ...form,
    errors,
    old,
  });
}

router.get('/', asyncHandler((req, res) => renderDashboard(req, res)));

router.post(
  '/asignar',
  asyncHandler(async (req, res) => {
    const data = {
      id_socio: toNumberOrNull(req.body.id_socio),
      id_rutina: toNumberOrNull(req.body.id_rutina),
      observaciones: clean(req.body.observaciones),
    };
    const errors = [];
    if (!data.id_socio) errors.push('Seleccioná un socio.');
    if (!data.id_rutina) errors.push('Seleccioná una rutina.');
    if (data.observaciones.length > 250) errors.push('Las observaciones admiten hasta 250 caracteres.');

    if (errors.length === 0) {
      const ok = await query(
        `SELECT (SELECT COUNT(*) FROM Socios WHERE id_socio = @s) AS socio,
                (SELECT COUNT(*) FROM Rutinas WHERE id_rutina = @r) AS rutina`,
        { s: data.id_socio, r: data.id_rutina }
      );
      if (!ok.recordset[0].socio || !ok.recordset[0].rutina) errors.push('El socio o la rutina no existen.');
    }
    if (errors.length > 0) return renderDashboard(req, res, { errors, old: data, status: 422 });

    await query(
      `INSERT INTO Rutinas_Personalizadas (id_socio, id_entrenador, id_rutina, observaciones)
       VALUES (@id_socio, @id_entrenador, @id_rutina, @observaciones)`,
      {
        id_socio: data.id_socio,
        id_entrenador: req.entrenador.id_entrenador,
        id_rutina: data.id_rutina,
        observaciones: data.observaciones || null,
      }
    );
    req.flash('success', 'Rutina asignada al socio.');
    res.redirect('/entrenador');
  })
);

async function cargarSocio(req, idSocio) {
  const socioResult = await query(
    `SELECT s.id_socio, s.nombre, s.apellidos, s.documento, s.telefono, s.fecha_nacimiento,
            up.tipo_plan, up.fecha_vencimiento, ${ESTADO_CUOTA_SQL} AS estado_cuota
     FROM Socios s ${APPLY_ULTIMO_PAGO}
     WHERE s.id_socio = @id
       AND EXISTS (SELECT 1 FROM Rutinas_Personalizadas rp
                   WHERE rp.id_socio = s.id_socio AND rp.id_entrenador = @entrenador)`,
    { id: idSocio, entrenador: req.entrenador.id_entrenador }
  );
  return socioResult.recordset[0] || null;
}

async function renderSocio(req, res, socio, { errors = [], old = {}, status = 200 } = {}) {
  const [asignaciones, evolucion] = await Promise.all([
    query(
      `SELECT rp.id_asignacion, rp.fecha_asignacion, rp.observaciones,
              r.id_rutina, r.nombre_rutina, r.objetivo, r.nivel, r.duracion_semanas
       FROM Rutinas_Personalizadas rp
       JOIN Rutinas r ON r.id_rutina = rp.id_rutina
       WHERE rp.id_socio = @id AND rp.id_entrenador = @entrenador
       ORDER BY rp.fecha_asignacion DESC, rp.id_asignacion DESC`,
      { id: socio.id_socio, entrenador: req.entrenador.id_entrenador }
    ),
    query(
      `SELECT fecha_registro, peso_kg, porcentaje_grasa, masa_muscular_kg, observaciones
       FROM Evolucion_Fisica WHERE id_socio = @id
       ORDER BY fecha_registro DESC, id_evolucion DESC`,
      { id: socio.id_socio }
    ),
  ]);
  const ejercicios = await query(
    `SELECT id_rutina, nombre_ejercicio, grupo_muscular, series, repeticiones, carga_kg
     FROM Ejercicios
     WHERE id_rutina IN (SELECT id_rutina FROM Rutinas_Personalizadas
                         WHERE id_socio = @id AND id_entrenador = @entrenador)
     ORDER BY id_ejercicio`,
    { id: socio.id_socio, entrenador: req.entrenador.id_entrenador }
  );
  const porRutina = new Map();
  for (const ej of ejercicios.recordset) {
    if (!porRutina.has(ej.id_rutina)) porRutina.set(ej.id_rutina, []);
    porRutina.get(ej.id_rutina).push(ej);
  }
  res.status(status).render('entrenador/socio', {
    title: `${socio.nombre} ${socio.apellidos}`,
    socioFicha: socio,
    rutinas: asignaciones.recordset.map((a) => ({ ...a, ejercicios: porRutina.get(a.id_rutina) || [] })),
    evolucion: evolucion.recordset,
    errors,
    old,
  });
}

function notFound(res) {
  return res.status(404).render('error', {
    title: 'Socio no encontrado',
    status: 404,
    message: 'No existe ese socio o no tiene rutinas asignadas por vos.',
  });
}

router.get(
  '/socios/:id',
  asyncHandler(async (req, res) => {
    const socio = await cargarSocio(req, Number(req.params.id));
    if (!socio) return notFound(res);
    await renderSocio(req, res, socio);
  })
);

function enRango(n, min, max) {
  return n !== null && n >= min && n <= max;
}

router.post(
  '/socios/:id/evolucion',
  asyncHandler(async (req, res) => {
    const socio = await cargarSocio(req, Number(req.params.id));
    if (!socio) return notFound(res);

    const data = {
      peso_kg: toNumberOrNull(req.body.peso_kg),
      porcentaje_grasa: toNumberOrNull(req.body.porcentaje_grasa),
      masa_muscular_kg: toNumberOrNull(req.body.masa_muscular_kg),
      observaciones: clean(req.body.observaciones),
    };
    const errors = [];
    if (!enRango(data.peso_kg, 1, 999.99)) errors.push('Ingresá un peso válido (kg).');
    if (data.porcentaje_grasa !== null && !enRango(data.porcentaje_grasa, 0, 99.99)) {
      errors.push('El porcentaje de grasa debe estar entre 0 y 99,99.');
    }
    if (data.masa_muscular_kg !== null && !enRango(data.masa_muscular_kg, 0, 999.99)) {
      errors.push('La masa muscular debe estar entre 0 y 999,99 kg.');
    }
    if (data.observaciones.length > 250) errors.push('Las observaciones admiten hasta 250 caracteres.');
    if (errors.length > 0) return renderSocio(req, res, socio, { errors, old: data, status: 422 });

    await query(
      `INSERT INTO Evolucion_Fisica (id_socio, peso_kg, porcentaje_grasa, masa_muscular_kg, observaciones)
       VALUES (@id_socio, @peso, @grasa, @masa, @obs)`,
      {
        id_socio: socio.id_socio,
        peso: data.peso_kg,
        grasa: data.porcentaje_grasa,
        masa: data.masa_muscular_kg,
        obs: data.observaciones || null,
      }
    );
    req.flash('success', 'Registro de evolución guardado.');
    res.redirect(`/entrenador/socios/${socio.id_socio}`);
  })
);

module.exports = router;
