const express = require('express');
const bcrypt = require('bcryptjs');
const { query, transaction, txQuery } = require('../db');
const {
  clean,
  toDateOrNull,
  toNumberOrNull,
  asyncHandler,
  todayISO,
  vencimientoPara,
  isValidISODate,
  APPLY_ULTIMO_PAGO,
  ESTADO_CUOTA_SQL,
} = require('../utils');

const router = express.Router();

const METODOS_PAGO = ['Efectivo', 'Tarjeta', 'Transferencia'];
const NIVELES = ['Principiante', 'Intermedio', 'Avanzado'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mantiene Socios.estado_membresia alineado con Pagos (vigente = algún pago con vencimiento >= hoy).
const SYNC_ESTADO_SQL = `
  UPDATE s
  SET estado_membresia = CASE WHEN EXISTS (
        SELECT 1 FROM Pagos p
        WHERE p.id_socio = s.id_socio AND p.fecha_vencimiento >= CAST(GETDATE() AS DATE)
      ) THEN 'Activo' ELSE 'Vencido' END
  FROM Socios s`;

/* ------------------------------------------------------------------ Resumen */

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [stats, pagos, ingresos] = await Promise.all([
      query(
        `SELECT
           (SELECT COUNT(*) FROM Socios) AS socios,
           (SELECT COUNT(*) FROM Socios s ${APPLY_ULTIMO_PAGO}
             WHERE up.fecha_vencimiento >= CAST(GETDATE() AS DATE)) AS vigentes,
           (SELECT COUNT(*) FROM Entrenadores) AS entrenadores,
           (SELECT COUNT(*) FROM Rutinas) AS rutinas,
           (SELECT COUNT(*) FROM Control_Ingresos WHERE fecha = CAST(GETDATE() AS DATE)) AS ingresos_hoy,
           (SELECT ISNULL(SUM(monto_abonado), 0) FROM Pagos
             WHERE YEAR(fecha_pago) = YEAR(GETDATE()) AND MONTH(fecha_pago) = MONTH(GETDATE())) AS recaudado_mes`
      ),
      query(
        `SELECT TOP 6 s.nombre + ' ' + s.apellidos AS socio, m.tipo_plan, p.monto_abonado,
                p.fecha_pago, p.fecha_vencimiento
         FROM Pagos p
         JOIN Socios s ON s.id_socio = p.id_socio
         JOIN Membresias m ON m.id_membresia = p.id_membresia
         ORDER BY p.fecha_pago DESC, p.id_pago DESC`
      ),
      query(
        `SELECT TOP 6 s.nombre + ' ' + s.apellidos AS socio, sd.nombre_sede,
                ci.fecha, ci.hora_ingreso, ci.hora_egreso
         FROM Control_Ingresos ci
         JOIN Socios s ON s.id_socio = ci.id_socio
         JOIN Sedes sd ON sd.id_sede = ci.id_sede
         ORDER BY ci.fecha DESC, ci.hora_ingreso DESC`
      ),
    ]);

    res.render('admin/dashboard', {
      title: 'Panel de administración',
      stats: stats.recordset[0],
      pagos: pagos.recordset,
      ingresos: ingresos.recordset,
      active: 'resumen',
    });
  })
);

/* ------------------------------------------------------------------- Socios */

router.get(
  '/socios',
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT s.id_socio, s.nombre, s.apellidos, s.documento, s.telefono, s.fecha_alta,
              s.estado_membresia AS estado_guardado,
              u.email,
              up.tipo_plan, up.fecha_vencimiento,
              ${ESTADO_CUOTA_SQL} AS estado_cuota,
              (SELECT COUNT(*) FROM Control_Ingresos ci
                WHERE ci.id_socio = s.id_socio
                  AND ci.fecha >= DATEADD(DAY, -30, CAST(GETDATE() AS DATE))) AS asistencias_30d
       FROM Socios s
       LEFT JOIN Usuarios u ON u.id_socio = s.id_socio
       ${APPLY_ULTIMO_PAGO}
       ORDER BY s.apellidos, s.nombre`
    );
    res.render('admin/socios', { title: 'Socios', socios: result.recordset, active: 'socios' });
  })
);

router.post(
  '/socios/sincronizar',
  asyncHandler(async (req, res) => {
    const result = await query(SYNC_ESTADO_SQL);
    req.flash('success', `Estados de membresía sincronizados con los pagos (${result.rowsAffected[0]} socios revisados).`);
    res.redirect('/admin/socios');
  })
);

/* -------------------------------------------------------------- Entrenadores */

async function listarEntrenadores() {
  const result = await query(
    `SELECT e.id_entrenador, e.nombre, e.apellido, e.telefono, e.especialidad, e.certificaciones,
            u.email,
            (SELECT COUNT(DISTINCT rp.id_socio) FROM Rutinas_Personalizadas rp
              WHERE rp.id_entrenador = e.id_entrenador) AS socios
     FROM Entrenadores e
     LEFT JOIN Usuarios u ON u.id_entrenador = e.id_entrenador
     ORDER BY e.apellido, e.nombre`
  );
  return result.recordset;
}

router.get(
  '/entrenadores',
  asyncHandler(async (req, res) => {
    res.render('admin/entrenadores', {
      title: 'Entrenadores',
      entrenadores: await listarEntrenadores(),
      errors: [],
      old: {},
      active: 'entrenadores',
    });
  })
);

router.post(
  '/entrenadores',
  asyncHandler(async (req, res) => {
    const data = {
      nombre: clean(req.body.nombre),
      apellido: clean(req.body.apellido),
      telefono: clean(req.body.telefono),
      especialidad: clean(req.body.especialidad),
      certificaciones: clean(req.body.certificaciones),
      email: clean(req.body.email).toLowerCase(),
      password: String(req.body.password || ''),
    };
    const errors = [];
    if (!data.nombre) errors.push('Ingresá el nombre.');
    if (!data.apellido) errors.push('Ingresá el apellido.');
    if (!data.especialidad) errors.push('Ingresá la especialidad.');
    if (!emailPattern.test(data.email)) errors.push('Ingresá un email válido.');
    if (data.password.length < 8) errors.push('La contraseña debe tener al menos 8 caracteres.');

    if (errors.length === 0) {
      const dup = await query(`SELECT COUNT(*) AS n FROM Usuarios WHERE email = @email`, { email: data.email });
      if (dup.recordset[0].n > 0) errors.push('Ya existe un usuario con ese email.');
    }
    if (errors.length > 0) {
      return res.status(422).render('admin/entrenadores', {
        title: 'Entrenadores',
        entrenadores: await listarEntrenadores(),
        errors,
        old: { ...data, password: '' },
        active: 'entrenadores',
      });
    }

    const hash = await bcrypt.hash(data.password, 10);
    await transaction(async (tx) => {
      const inserted = await txQuery(
        tx,
        `INSERT INTO Entrenadores (nombre, apellido, telefono, especialidad, certificaciones)
         OUTPUT INSERTED.id_entrenador
         VALUES (@nombre, @apellido, @telefono, @especialidad, @certificaciones)`,
        {
          nombre: data.nombre,
          apellido: data.apellido,
          telefono: data.telefono || null,
          especialidad: data.especialidad,
          certificaciones: data.certificaciones || null,
        }
      );
      await txQuery(
        tx,
        `INSERT INTO Usuarios (email, password_hash, rol, id_entrenador)
         VALUES (@email, @hash, 'entrenador', @id)`,
        { email: data.email, hash, id: inserted.recordset[0].id_entrenador }
      );
    });

    req.flash('success', 'Entrenador creado. Ya puede ingresar con el email y la contraseña asignados.');
    res.redirect('/admin/entrenadores');
  })
);

/* --------------------------------------------------------------------- Pagos */

async function datosPagos() {
  const [pagos, socios, membresias] = await Promise.all([
    query(
      `SELECT p.id_pago, s.nombre + ' ' + s.apellidos AS socio, s.documento, m.tipo_plan,
              p.monto_abonado, p.metodo_pago, p.fecha_pago, p.fecha_vencimiento,
              CASE WHEN p.fecha_vencimiento >= CAST(GETDATE() AS DATE) THEN 'vigente' ELSE 'vencido' END AS estado
       FROM Pagos p
       JOIN Socios s ON s.id_socio = p.id_socio
       JOIN Membresias m ON m.id_membresia = p.id_membresia
       ORDER BY p.fecha_pago DESC, p.id_pago DESC`
    ),
    query(`SELECT id_socio, nombre + ' ' + apellidos AS nombre, documento FROM Socios ORDER BY apellidos, nombre`),
    query(`SELECT id_membresia, tipo_plan, costo FROM Membresias ORDER BY costo`),
  ]);
  return { pagos: pagos.recordset, socios: socios.recordset, membresias: membresias.recordset };
}

router.get(
  '/pagos',
  asyncHandler(async (req, res) => {
    res.render('admin/pagos', {
      title: 'Pagos y membresías',
      ...(await datosPagos()),
      metodos: METODOS_PAGO,
      hoy: todayISO(),
      errors: [],
      old: {},
      active: 'pagos',
    });
  })
);

router.post(
  '/pagos',
  asyncHandler(async (req, res) => {
    const data = {
      id_socio: toNumberOrNull(req.body.id_socio),
      id_membresia: toNumberOrNull(req.body.id_membresia),
      monto_abonado: toNumberOrNull(req.body.monto_abonado),
      metodo_pago: clean(req.body.metodo_pago),
      fecha_pago: toDateOrNull(req.body.fecha_pago) || todayISO(),
      fecha_vencimiento: toDateOrNull(req.body.fecha_vencimiento),
    };
    const errors = [];
    if (!data.id_socio) errors.push('Seleccioná un socio.');
    if (!data.id_membresia) errors.push('Seleccioná una membresía.');
    if (!METODOS_PAGO.includes(data.metodo_pago)) errors.push('Seleccioná un método de pago.');
    if (!isValidISODate(data.fecha_pago)) errors.push('La fecha de pago no es válida.');
    if (data.fecha_vencimiento && !isValidISODate(data.fecha_vencimiento)) {
      errors.push('La fecha de vencimiento no es válida.');
    }

    let membresia = null;
    if (errors.length === 0) {
      const found = await query(
        `SELECT m.tipo_plan, m.costo,
                (SELECT COUNT(*) FROM Socios WHERE id_socio = @socio) AS socio
         FROM Membresias m WHERE m.id_membresia = @membresia`,
        { socio: data.id_socio, membresia: data.id_membresia }
      );
      membresia = found.recordset[0];
      if (!membresia) errors.push('La membresía no existe.');
      else if (!membresia.socio) errors.push('El socio no existe.');
    }
    if (membresia) {
      if (data.monto_abonado === null) data.monto_abonado = Number(membresia.costo);
      if (data.monto_abonado <= 0 || data.monto_abonado > 99999999) errors.push('Ingresá un monto válido.');
      if (!data.fecha_vencimiento) data.fecha_vencimiento = vencimientoPara(membresia.tipo_plan, data.fecha_pago);
      else if (data.fecha_vencimiento < data.fecha_pago) {
        errors.push('El vencimiento no puede ser anterior a la fecha de pago.');
      }
    }

    if (errors.length > 0) {
      return res.status(422).render('admin/pagos', {
        title: 'Pagos y membresías',
        ...(await datosPagos()),
        metodos: METODOS_PAGO,
        hoy: todayISO(),
        errors,
        old: data,
        active: 'pagos',
      });
    }

    await transaction(async (tx) => {
      await txQuery(
        tx,
        `INSERT INTO Pagos (id_socio, id_membresia, monto_abonado, fecha_pago, fecha_vencimiento, metodo_pago)
         VALUES (@id_socio, @id_membresia, @monto, @fecha_pago, @fecha_vencimiento, @metodo)`,
        {
          id_socio: data.id_socio,
          id_membresia: data.id_membresia,
          monto: data.monto_abonado,
          fecha_pago: data.fecha_pago,
          fecha_vencimiento: data.fecha_vencimiento,
          metodo: data.metodo_pago,
        }
      );
      await txQuery(tx, `${SYNC_ESTADO_SQL} WHERE s.id_socio = @id`, { id: data.id_socio });
    });

    req.flash('success', `Pago registrado. Membresía vigente hasta ${data.fecha_vencimiento.split('-').reverse().join('/')}.`);
    res.redirect('/admin/pagos');
  })
);

/* ------------------------------------------------------------------ Rutinas */

async function datosRutinas() {
  const [rutinas, ejercicios, asignaciones] = await Promise.all([
    query(
      `SELECT r.id_rutina, r.nombre_rutina, r.objetivo, r.nivel, r.duracion_semanas,
              (SELECT COUNT(*) FROM Rutinas_Personalizadas rp WHERE rp.id_rutina = r.id_rutina) AS asignaciones
       FROM Rutinas r ORDER BY r.nombre_rutina`
    ),
    query(
      `SELECT id_rutina, nombre_ejercicio, grupo_muscular, series, repeticiones, carga_kg
       FROM Ejercicios ORDER BY id_ejercicio`
    ),
    query(
      `SELECT TOP 20 s.nombre + ' ' + s.apellidos AS socio, e.nombre + ' ' + e.apellido AS entrenador,
              r.nombre_rutina, rp.fecha_asignacion, rp.observaciones
       FROM Rutinas_Personalizadas rp
       JOIN Socios s ON s.id_socio = rp.id_socio
       JOIN Entrenadores e ON e.id_entrenador = rp.id_entrenador
       JOIN Rutinas r ON r.id_rutina = rp.id_rutina
       ORDER BY rp.fecha_asignacion DESC, rp.id_asignacion DESC`
    ),
  ]);
  const porRutina = new Map();
  for (const ej of ejercicios.recordset) {
    if (!porRutina.has(ej.id_rutina)) porRutina.set(ej.id_rutina, []);
    porRutina.get(ej.id_rutina).push(ej);
  }
  return {
    rutinas: rutinas.recordset.map((r) => ({ ...r, ejercicios: porRutina.get(r.id_rutina) || [] })),
    asignaciones: asignaciones.recordset,
    niveles: NIVELES,
  };
}

router.get(
  '/rutinas',
  asyncHandler(async (req, res) => {
    res.render('admin/rutinas', {
      title: 'Rutinas',
      ...(await datosRutinas()),
      errors: [],
      old: {},
      errorsEj: [],
      oldEj: {},
      active: 'rutinas',
    });
  })
);

router.post(
  '/rutinas',
  asyncHandler(async (req, res) => {
    const data = {
      nombre_rutina: clean(req.body.nombre_rutina),
      objetivo: clean(req.body.objetivo),
      nivel: clean(req.body.nivel),
      duracion_semanas: toNumberOrNull(req.body.duracion_semanas),
    };
    const errors = [];
    if (!data.nombre_rutina) errors.push('Ingresá el nombre de la rutina.');
    if (data.nombre_rutina.length > 100) errors.push('El nombre admite hasta 100 caracteres.');
    if (data.objetivo.length > 150) errors.push('El objetivo admite hasta 150 caracteres.');
    if (!NIVELES.includes(data.nivel)) errors.push('Seleccioná un nivel válido.');
    if (data.duracion_semanas === null || !Number.isInteger(data.duracion_semanas) || data.duracion_semanas < 1) {
      errors.push('La duración debe ser un número entero de semanas.');
    }
    if (errors.length > 0) {
      return res.status(422).render('admin/rutinas', {
        title: 'Rutinas',
        ...(await datosRutinas()),
        errors,
        old: data,
        errorsEj: [],
        oldEj: {},
        active: 'rutinas',
      });
    }
    await query(
      `INSERT INTO Rutinas (nombre_rutina, objetivo, nivel, duracion_semanas)
       VALUES (@nombre, @objetivo, @nivel, @semanas)`,
      { nombre: data.nombre_rutina, objetivo: data.objetivo || null, nivel: data.nivel, semanas: data.duracion_semanas }
    );
    req.flash('success', 'Rutina creada. Ahora podés agregarle ejercicios.');
    res.redirect('/admin/rutinas');
  })
);

router.post(
  '/rutinas/:id/ejercicios',
  asyncHandler(async (req, res) => {
    const idRutina = Number(req.params.id);
    const data = {
      id_rutina: idRutina,
      nombre_ejercicio: clean(req.body.nombre_ejercicio),
      grupo_muscular: clean(req.body.grupo_muscular),
      series: toNumberOrNull(req.body.series),
      repeticiones: toNumberOrNull(req.body.repeticiones),
      carga_kg: toNumberOrNull(req.body.carga_kg),
    };
    const errors = [];
    if (!data.nombre_ejercicio) errors.push('Ingresá el nombre del ejercicio.');
    if (data.nombre_ejercicio.length > 100) errors.push('El nombre admite hasta 100 caracteres.');
    if (data.grupo_muscular.length > 50) errors.push('El grupo muscular admite hasta 50 caracteres.');
    if (!Number.isInteger(data.series) || data.series < 1) errors.push('Las series deben ser un entero mayor a 0.');
    if (!Number.isInteger(data.repeticiones) || data.repeticiones < 1) {
      errors.push('Las repeticiones deben ser un entero mayor a 0.');
    }
    if (data.carga_kg !== null && (data.carga_kg < 0 || data.carga_kg > 999.99)) {
      errors.push('La carga debe estar entre 0 y 999,99 kg.');
    }
    const existe = await query(`SELECT COUNT(*) AS n FROM Rutinas WHERE id_rutina = @id`, { id: idRutina });
    if (!existe.recordset[0].n) errors.push('La rutina no existe.');

    if (errors.length > 0) {
      return res.status(422).render('admin/rutinas', {
        title: 'Rutinas',
        ...(await datosRutinas()),
        errors: [],
        old: {},
        errorsEj: errors,
        oldEj: data,
        active: 'rutinas',
      });
    }
    await query(
      `INSERT INTO Ejercicios (id_rutina, nombre_ejercicio, grupo_muscular, series, repeticiones, carga_kg)
       VALUES (@id_rutina, @nombre, @grupo, @series, @reps, @carga)`,
      {
        id_rutina: idRutina,
        nombre: data.nombre_ejercicio,
        grupo: data.grupo_muscular || null,
        series: data.series,
        reps: data.repeticiones,
        carga: data.carga_kg ?? 0,
      }
    );
    req.flash('success', 'Ejercicio agregado a la rutina.');
    res.redirect('/admin/rutinas');
  })
);

/* ---------------------------------------------------------------- Ingresos */

async function datosIngresos() {
  const [ingresos, socios, sedes] = await Promise.all([
    query(
      `SELECT TOP 50 ci.id_ingreso, s.nombre + ' ' + s.apellidos AS socio, sd.nombre_sede,
              ci.fecha, ci.hora_ingreso, ci.hora_egreso,
              DATEDIFF(MINUTE, ci.hora_ingreso, ci.hora_egreso) AS minutos
       FROM Control_Ingresos ci
       JOIN Socios s ON s.id_socio = ci.id_socio
       JOIN Sedes sd ON sd.id_sede = ci.id_sede
       ORDER BY ci.fecha DESC, ci.hora_ingreso DESC, ci.id_ingreso DESC`
    ),
    query(`SELECT id_socio, nombre + ' ' + apellidos AS nombre, documento FROM Socios ORDER BY apellidos, nombre`),
    query(`SELECT id_sede, nombre_sede FROM Sedes ORDER BY nombre_sede`),
  ]);
  return { ingresos: ingresos.recordset, socios: socios.recordset, sedes: sedes.recordset };
}

async function renderIngresos(res, { errors = [], old = {}, status = 200 } = {}) {
  res.status(status).render('admin/ingresos', {
    title: 'Control de ingresos',
    ...(await datosIngresos()),
    errors,
    old,
    active: 'ingresos',
  });
}

router.get('/ingresos', asyncHandler((req, res) => renderIngresos(res)));

router.post(
  '/ingresos',
  asyncHandler(async (req, res) => {
    const data = { id_socio: toNumberOrNull(req.body.id_socio), id_sede: toNumberOrNull(req.body.id_sede) };
    const errors = [];
    if (!data.id_socio) errors.push('Seleccioná un socio.');
    if (!data.id_sede) errors.push('Seleccioná una sede.');

    if (errors.length === 0) {
      const check = await query(
        `SELECT (SELECT COUNT(*) FROM Socios WHERE id_socio = @socio) AS socio,
                (SELECT COUNT(*) FROM Sedes WHERE id_sede = @sede) AS sede,
                (SELECT COUNT(*) FROM Pagos WHERE id_socio = @socio
                  AND fecha_vencimiento >= CAST(GETDATE() AS DATE)) AS vigentes,
                (SELECT COUNT(*) FROM Control_Ingresos WHERE id_socio = @socio
                  AND fecha = CAST(GETDATE() AS DATE) AND hora_egreso IS NULL) AS abiertos`,
        { socio: data.id_socio, sede: data.id_sede }
      );
      const c = check.recordset[0];
      if (!c.socio) errors.push('El socio no existe.');
      else if (!c.sede) errors.push('La sede no existe.');
      else if (c.vigentes === 0) errors.push('La membresía del socio está vencida: registrá el pago antes de permitir el ingreso.');
      else if (c.abiertos > 0) errors.push('El socio ya tiene un ingreso abierto hoy. Registrá primero su egreso.');
    }
    if (errors.length > 0) return renderIngresos(res, { errors, old: data, status: 422 });

    await query(
      `INSERT INTO Control_Ingresos (id_socio, id_sede, fecha, hora_ingreso)
       VALUES (@socio, @sede, CAST(GETDATE() AS DATE), CAST(GETDATE() AS TIME(0)))`,
      { socio: data.id_socio, sede: data.id_sede }
    );
    req.flash('success', 'Ingreso registrado.');
    res.redirect('/admin/ingresos');
  })
);

router.post(
  '/ingresos/:id/egreso',
  asyncHandler(async (req, res) => {
    const result = await query(
      `UPDATE Control_Ingresos SET hora_egreso = CAST(GETDATE() AS TIME(0))
       WHERE id_ingreso = @id AND hora_egreso IS NULL`,
      { id: Number(req.params.id) }
    );
    if (result.rowsAffected[0] > 0) req.flash('success', 'Egreso registrado.');
    else req.flash('error', 'No se pudo registrar el egreso (ya estaba cerrado o no existe).');
    res.redirect('/admin/ingresos');
  })
);

module.exports = router;
