const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../utils');

const router = express.Router();

router.use(asyncHandler(async (req, res, next) => {
  const result = await query(
    `SELECT id, nombre, apellido, especialidad
     FROM profesores WHERE usuario_id = @usuario_id`,
    { usuario_id: req.session.user.id }
  );
  const profesor = result.recordset[0];
  if (!profesor) {
    return res.status(403).render('error', {
      title: 'Acceso denegado',
      status: 403,
      message: 'Tu usuario no tiene un perfil de profesor asociado.',
    });
  }
  req.profesor = profesor;
  res.locals.profesor = profesor;
  next();
}));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT a.id, a.nombre, a.descripcion, a.dia_semana, a.hora_inicio, a.hora_fin,
              a.cupo, a.precio, a.sala, a.activa,
              (SELECT COUNT(*) FROM inscripciones i
                WHERE i.actividad_id = a.id AND i.estado = 'confirmada') AS inscriptos
       FROM actividades a
       WHERE a.profesor_id = @profesor
       ORDER BY a.activa DESC, a.dia_semana, a.hora_inicio`,
      { profesor: req.profesor.id }
    );

    res.render('profesor/dashboard', {
      title: 'Panel del profesor',
      actividades: result.recordset,
    });
  })
);

router.get(
  '/actividades/:id',
  asyncHandler(async (req, res) => {
    const actividadResult = await query(
      `SELECT a.*,
              (SELECT COUNT(*) FROM inscripciones i
                WHERE i.actividad_id = a.id AND i.estado = 'confirmada') AS inscriptos
       FROM actividades a
       WHERE a.id = @id AND a.profesor_id = @profesor`,
      { id: Number(req.params.id), profesor: req.profesor.id }
    );
    const actividad = actividadResult.recordset[0];
    if (!actividad) {
      return res.status(404).render('error', {
        title: 'Actividad no encontrada',
        status: 404,
        message: 'No existe esa actividad o no está asignada a tu perfil.',
      });
    }

    const alumnos = await query(
      `SELECT s.nombre, s.apellido, s.dni, s.telefono, i.fecha_reserva
       FROM inscripciones i
       JOIN socios s ON s.id = i.socio_id
       WHERE i.actividad_id = @actividad AND i.estado = 'confirmada'
       ORDER BY s.apellido, s.nombre`,
      { actividad: actividad.id }
    );

    res.render('profesor/actividad', {
      title: actividad.nombre,
      actividad,
      alumnos: alumnos.recordset,
    });
  })
);

module.exports = router;
