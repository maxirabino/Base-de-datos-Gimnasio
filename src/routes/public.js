const express = require('express');
const { query } = require('../db');
const { asyncHandler, APPLY_ULTIMO_PAGO } = require('../utils');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [membresias, sedes, entrenadores, stats] = await Promise.all([
      query(`SELECT id_membresia, tipo_plan, costo, promocion_descripcion FROM Membresias ORDER BY costo`),
      query(`SELECT id_sede, nombre_sede, direccion FROM Sedes ORDER BY nombre_sede`),
      query(
        `SELECT nombre, apellido, especialidad, certificaciones
         FROM Entrenadores ORDER BY apellido, nombre`
      ),
      query(
        `SELECT
           (SELECT COUNT(*)
              FROM Socios s ${APPLY_ULTIMO_PAGO}
             WHERE up.fecha_vencimiento >= CAST(GETDATE() AS DATE)) AS socios,
           (SELECT COUNT(*) FROM Entrenadores) AS entrenadores,
           (SELECT COUNT(*) FROM Sedes) AS sedes`
      ),
    ]);

    res.render('home', {
      title: 'FitForge - Entrená con propósito',
      membresias: membresias.recordset,
      sedes: sedes.recordset,
      entrenadores: entrenadores.recordset,
      stats: stats.recordset[0],
    });
  })
);

module.exports = router;
