const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../utils');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [actividades, stats] = await Promise.all([
      query(
        `SELECT a.id, a.nombre, a.descripcion, a.dia_semana, a.hora_inicio, a.hora_fin,
                a.cupo, a.precio, a.sala,
                p.nombre + ' ' + p.apellido AS profesor,
                (SELECT COUNT(*) FROM inscripciones i
                  WHERE i.actividad_id = a.id AND i.estado = 'confirmada') AS inscriptos
         FROM actividades a
         LEFT JOIN profesores p ON p.id = a.profesor_id
         WHERE a.activa = 1
         ORDER BY a.dia_semana, a.hora_inicio`
      ),
      query(
        `SELECT
           (SELECT COUNT(*) FROM socios WHERE estado = 'activo') AS socios,
           (SELECT COUNT(*) FROM profesores WHERE activo = 1) AS profesores,
           (SELECT COUNT(*) FROM actividades WHERE activa = 1) AS actividades`
      ),
    ]);

    res.render('home', {
      title: 'FitForge - Entrená con propósito',
      actividades: actividades.recordset,
      stats: stats.recordset[0],
    });
  })
);

module.exports = router;
