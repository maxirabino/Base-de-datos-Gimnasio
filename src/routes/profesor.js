const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../utils');

const router = express.Router();

router.use(asyncHandler(async (req, res, next) => {
  // Vinculamos la sesión (Socio con rol 'profesor') con su perfil real en Entrenadores
  const result = await query(
    `SELECT e.id_entrenador AS id, e.nombre, e.apellido, e.especialidad
     FROM Entrenadores e
     JOIN Socios s ON s.nombre = e.nombre AND s.apellidos = e.apellido
     WHERE s.id_socio = @usuario_id AND s.rol = 'profesor'`,
    { usuario_id: req.session.user.id }
  );
  
  const profesor = result.recordset[0];
  if (!profesor) {
    return res.status(403).render('error', {
      title: 'Acceso denegado',
      status: 403,
      message: 'Tu usuario no tiene un perfil de entrenador asociado en la base de datos.',
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
              (SELECT COUNT(*) FROM Inscripciones i
               WHERE i.actividad_id = a.id AND i.estado = 'confirmada') AS inscriptos
       FROM Actividades a
       WHERE a.profesor_id = @profesor
       ORDER BY a.activa DESC, a.dia_semana, a.hora_inicio`,
      { profesor: req.profesor.id }
    );

    res.render('profesor/dashboard', {
      title: 'Panel del profesor',
      actividades: result.recordset,
      active: 'dashboard',
    });
  })
);

router.get(
  '/actividades/:id',
  asyncHandler(async (req, res) => {
    const actividadResult = await query(
      `SELECT a.*,
              (SELECT COUNT(*) FROM Inscripciones i
               WHERE i.actividad_id = a.id AND i.estado = 'confirmada') AS inscriptos
       FROM Actividades a
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
      `SELECT s.nombre, s.apellidos AS apellido, s.documento AS dni, s.telefono, i.fecha_reserva
       FROM Inscripciones i
       JOIN Socios s ON s.id_socio = i.socio_id
       WHERE i.actividad_id = @actividad AND i.estado = 'confirmada'
       ORDER BY s.apellidos, s.nombre`,
      { actividad: actividad.id }
    );

    res.render('profesor/actividad', {
      title: actividad.nombre,
      actividad,
      alumnos: alumnos.recordset,
      active: 'dashboard',
    });
  })
);

module.exports = router;