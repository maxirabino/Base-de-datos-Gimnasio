const express = require('express');
const { query } = require('../db');
const { clean, toNumberOrNull, asyncHandler } = require('../utils');

const router = express.Router();

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const ESTADOS_PAGO = ['pendiente', 'pagado', 'vencido'];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    let socios = 0, profesores = 0, actividades = 0, reservas = 0;
    
    try {
      const s = await query(`SELECT COUNT(*) AS total FROM Socios`);
      socios = s.recordset[0]?.total || 0;
    } catch (e) {}

    try {
      const p = await query(`SELECT COUNT(*) AS total FROM Entrenadores`);
      profesores = p.recordset[0]?.total || 0;
    } catch (e) {}

    try {
      const a = await query(`SELECT COUNT(*) AS total FROM Actividades`);
      actividades = a.recordset[0]?.total || 0;
    } catch (e) {}

    let clasesList = [];
    try {
      const cl = await query(`SELECT TOP 6 id, nombre, dia_semana, hora_inicio, hora_fin, sala, cupo, 20 AS inscriptos FROM Actividades`);
      clasesList = cl.recordset;
    } catch (e) {}

    res.render('admin/dashboard', {
      title: 'Panel de administración',
      stats: {
        socios,
        profesores,
        actividades,
        reservas: 0,
        cuotas_pendientes: 0,
        deuda: 0,
      },
      clases: clasesList,
      pagos: [],
      active: 'resumen',
    });
  })
);

router.get(
  '/socios',
  asyncHandler(async (req, res) => {
    let sociosList = [];
    try {
      const result = await query(
        `SELECT s.id_socio AS id, s.nombre, s.apellidos AS apellido, s.documento AS dni, 
                s.telefono, 
                CASE WHEN s.activo = 1 THEN 'Activo' ELSE 'Inactivo' END AS estado, 
                s.fecha_alta, s.email, 
                (SELECT COUNT(*) FROM Inscripciones i WHERE i.socio_id = s.id_socio AND i.estado = 'confirmada') AS reservas,
                (SELECT ISNULL(SUM(p.monto_abonado), 0) FROM Pagos p WHERE p.id_socio = s.id_socio AND p.estado IN ('pendiente', 'vencido')) AS deuda
         FROM Socios s`
      );
      sociosList = result.recordset;
    } catch (e) {
      sociosList = [];
    }

    res.render('admin/socios', {
      title: 'Socios',
      socios: sociosList,
      active: 'socios',
    });
  })
);

router.get(
  '/profesores',
  asyncHandler(async (req, res) => {
    let profList = [];
    try {
      const result = await query(
        `SELECT id_entrenador AS id, nombre, apellido, 'N/A' AS dni, telefono, especialidad,
                GETDATE() AS fecha_contratacion, 1 AS activo, 'Sin acceso web' AS email, 0 AS actividades
         FROM Entrenadores`
      );
      profList = result.recordset;
    } catch (e) {}

    res.render('admin/profesores', {
      title: 'Profesores / Entrenadores',
      profesores: profList,
      errors: [],
      old: {},
      active: 'profesores',
    });
  })
);

router.get(
  '/actividades',
  asyncHandler(async (req, res) => {
    let actividadesList = [], profesoresList = [];
    try {
      const act = await query(
        `SELECT a.*, 'Profesor' AS profesor, 0 AS inscriptos FROM Actividades a`
      );
      actividadesList = act.recordset;
    } catch (e) {}

    try {
      const prof = await query(
        `SELECT id_entrenador AS id, nombre + ' ' + apellido AS nombre, especialidad FROM Entrenadores`
      );
      profesoresList = prof.recordset;
    } catch (e) {}

    res.render('admin/actividades', {
      title: 'Actividades',
      actividades: actividadesList,
      profesores: profesoresList,
      dias: DIAS,
      errors: [],
      old: {},
      active: 'actividades',
    });
  })
);

router.post(
  '/actividades',
  asyncHandler(async (req, res) => {
    const data = {
      nombre: clean(req.body.nombre),
      descripcion: clean(req.body.descripcion),
      profesor_id: toNumberOrNull(req.body.profesor_id),
      dia_semana: clean(req.body.dia_semana),
      hora_inicio: clean(req.body.hora_inicio),
      hora_fin: clean(req.body.hora_fin),
      cupo: toNumberOrNull(req.body.cupo),
      precio: toNumberOrNull(req.body.precio),
      sala: clean(req.body.sala),
    };

    try {
      await query(
        `INSERT INTO Actividades (nombre, descripcion, profesor_id, dia_semana, hora_inicio, hora_fin, cupo, precio, sala, activa)
         VALUES (@nombre, @descripcion, @profesor_id, @dia_semana, @hora_inicio, @hora_fin, @cupo, @precio, @sala, 1)`,
        {
          nombre: data.nombre || 'Clase',
          descripcion: data.descripcion || null,
          profesor_id: data.profesor_id || 1,
          dia_semana: data.dia_semana || 'Lunes',
          hora_inicio: data.hora_inicio || '08:00',
          hora_fin: data.hora_fin || '09:00',
          cupo: data.cupo || 20,
          precio: data.precio || 0,
          sala: data.sala || 'Sala 1',
        }
      );
      req.flash('success', 'Actividad creada correctamente.');
    } catch (err) {
      req.flash('error', 'No se pudo crear la actividad.');
    }

    res.redirect('/admin/actividades');
  })
);

router.get(
  '/pagos',
  asyncHandler(async (req, res) => {
    res.render('admin/pagos', {
      title: 'Pagos y cuotas',
      pagos: [],
      socios: [],
      estados: ESTADOS_PAGO,
      errors: [],
      old: {},
      active: 'pagos',
    });
  })
);

module.exports = router;