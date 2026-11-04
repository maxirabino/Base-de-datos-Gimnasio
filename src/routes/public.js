const express = require('express');
const { query } = require('../db');
const { asyncHandler } = require('../utils');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    let actividadesList = [];
    let stats = { socios: 0, profesores: 0, actividades: 0 };

    try {
      const actResult = await query(
        `SELECT a.id, a.nombre, a.descripcion, a.dia_semana, a.hora_inicio, a.hora_fin,
                a.cupo, a.precio, a.sala,
                ISNULL(p.nombre + ' ' + p.apellido, 'Profesor') AS profesor,
                (SELECT COUNT(*) FROM Inscripciones i
                  WHERE i.actividad_id = a.id AND i.estado = 'confirmada') AS inscriptos
         FROM Actividades a
         LEFT JOIN Entrenadores p ON p.id_entrenador = a.profesor_id
         ORDER BY a.dia_semana, a.hora_inicio`
      );
      actividadesList = actResult.recordset;
    } catch (e) {
      actividadesList = [];
    }

    try {
      const sResult = await query(
        `SELECT
           (SELECT COUNT(*) FROM Socios) AS socios,
           (SELECT COUNT(*) FROM Entrenadores) AS profesores,
           (SELECT COUNT(*) FROM Actividades) AS actividades`
      );
      stats = sResult.recordset[0] || stats;
    } catch (e) {
      stats = { socios: 0, profesores: 0, actividades: 0 };
    }

    res.render('home', {
      title: 'FitForge - Entrená con propósito',
      actividades: actividadesList,
      stats,
    });
  })
);

module.exports = router;