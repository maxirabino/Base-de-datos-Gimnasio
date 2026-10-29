const express = require('express');
const bcrypt = require('bcryptjs');
const { query, transaction, txQuery } = require('../db');
const {
  clean,
  toDateOrNull,
  toNumberOrNull,
  asyncHandler,
} = require('../utils');

const router = express.Router();

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const ESTADOS_PAGO = ['pendiente', 'pagado', 'vencido'];
const HORA_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [stats, clases, pagosRecientes] = await Promise.all([
      query(
        `SELECT
           (SELECT COUNT(*) FROM socios WHERE estado = 'activo') AS socios,
           (SELECT COUNT(*) FROM profesores WHERE activo = 1) AS profesores,
           (SELECT COUNT(*) FROM actividades WHERE activa = 1) AS actividades,
           (SELECT COUNT(*) FROM inscripciones WHERE estado = 'confirmada') AS reservas,
           (SELECT COUNT(*) FROM pagos WHERE estado IN ('pendiente', 'vencido')) AS cuotas_pendientes,
           (SELECT ISNULL(SUM(monto), 0) FROM pagos WHERE estado IN ('pendiente', 'vencido')) AS deuda`
      ),
      query(
        `SELECT TOP 6 a.id, a.nombre, a.dia_semana, a.hora_inicio, a.hora_fin, a.sala,
                a.cupo,
                p.nombre + ' ' + p.apellido AS profesor,
                (SELECT COUNT(*) FROM inscripciones i
                  WHERE i.actividad_id = a.id AND i.estado = 'confirmada') AS inscriptos
         FROM actividades a
         LEFT JOIN profesores p ON p.id = a.profesor_id
         WHERE a.activa = 1
         ORDER BY a.dia_semana, a.hora_inicio`
      ),
      query(
        `SELECT TOP 6 p.id, p.concepto, p.monto, p.estado, p.fecha_pago, p.fecha_vencimiento,
                s.nombre + ' ' + s.apellido AS socio
         FROM pagos p
         JOIN socios s ON s.id = p.socio_id
         ORDER BY ISNULL(p.fecha_pago, p.fecha_vencimiento) DESC, p.id DESC`
      ),
    ]);

    res.render('admin/dashboard', {
      title: 'Panel de administración',
      stats: stats.recordset[0],
      clases: clases.recordset,
      pagos: pagosRecientes.recordset,
      active: 'resumen',
    });
  })
);

router.get(
  '/socios',
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT s.id, s.nombre, s.apellido, s.dni, s.telefono, s.estado, s.fecha_alta,
              u.email, u.activo AS usuario_activo,
              (SELECT COUNT(*) FROM inscripciones i
                WHERE i.socio_id = s.id AND i.estado = 'confirmada') AS reservas,
              (SELECT ISNULL(SUM(monto), 0) FROM pagos p
                WHERE p.socio_id = s.id AND p.estado IN ('pendiente', 'vencido')) AS deuda
       FROM socios s
       JOIN usuarios u ON u.id = s.usuario_id
       ORDER BY s.apellido, s.nombre`
    );

    res.render('admin/socios', {
      title: 'Socios',
      socios: result.recordset,
      active: 'socios',
    });
  })
);

router.get(
  '/profesores',
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT p.id, p.nombre, p.apellido, p.dni, p.telefono, p.especialidad,
              p.fecha_contratacion, p.activo, u.email,
              (SELECT COUNT(*) FROM actividades a WHERE a.profesor_id = p.id) AS actividades
       FROM profesores p
       JOIN usuarios u ON u.id = p.usuario_id
       ORDER BY p.apellido, p.nombre`
    );

    res.render('admin/profesores', {
      title: 'Profesores',
      profesores: result.recordset,
      errors: [],
      old: {},
      active: 'profesores',
    });
  })
);

router.post(
  '/profesores',
  asyncHandler(async (req, res) => {
    const data = {
      nombre: clean(req.body.nombre),
      apellido: clean(req.body.apellido),
      dni: clean(req.body.dni),
      telefono: clean(req.body.telefono),
      especialidad: clean(req.body.especialidad),
      email: clean(req.body.email).toLowerCase(),
      password: String(req.body.password || ''),
    };
    const errors = [];

    if (!data.nombre) errors.push('Ingresá el nombre.');
    if (!data.apellido) errors.push('Ingresá el apellido.');
    if (!data.dni) errors.push('Ingresá el DNI.');
    if (!data.especialidad) errors.push('Ingresá la especialidad.');
    if (!emailPattern.test(data.email)) errors.push('Ingresá un email válido.');
    if (data.password.length < 8) errors.push('La contraseña debe tener al menos 8 caracteres.');

    if (errors.length === 0) {
      const dup = await query(
        `SELECT
           (SELECT COUNT(*) FROM usuarios WHERE email = @email) AS email,
           (SELECT COUNT(*) FROM profesores WHERE dni = @dni) AS dni`,
        { email: data.email, dni: data.dni }
      );
      if (dup.recordset[0].email > 0) errors.push('Ya existe un usuario con ese email.');
      if (dup.recordset[0].dni > 0) errors.push('Ya existe un profesor con ese DNI.');
    }

    if (errors.length > 0) {
      const lista = await query(
        `SELECT p.id, p.nombre, p.apellido, p.dni, p.telefono, p.especialidad,
                p.fecha_contratacion, p.activo, u.email,
                (SELECT COUNT(*) FROM actividades a WHERE a.profesor_id = p.id) AS actividades
         FROM profesores p JOIN usuarios u ON u.id = p.usuario_id
         ORDER BY p.apellido, p.nombre`
      );
      return res.status(422).render('admin/profesores', {
        title: 'Profesores',
        profesores: lista.recordset,
        errors,
        old: { ...data, password: '' },
        active: 'profesores',
      });
    }

    const hash = await bcrypt.hash(data.password, 10);
    await transaction(async (tx) => {
      const inserted = await txQuery(
        tx,
        `INSERT INTO usuarios (email, password_hash, rol)
         OUTPUT INSERTED.id
         VALUES (@email, @hash, 'profesor')`,
        { email: data.email, hash }
      );
      await txQuery(
        tx,
        `INSERT INTO profesores
           (usuario_id, nombre, apellido, dni, telefono, especialidad, fecha_contratacion)
         VALUES (@usuario_id, @nombre, @apellido, @dni, @telefono, @especialidad, CAST(SYSDATETIME() AS DATE))`,
        {
          usuario_id: inserted.recordset[0].id,
          nombre: data.nombre,
          apellido: data.apellido,
          dni: data.dni,
          telefono: data.telefono || null,
          especialidad: data.especialidad,
        }
      );
    });

    req.flash('success', 'Profesor creado. Ya puede ingresar con el email y la contraseña asignados.');
    res.redirect('/admin/profesores');
  })
);

router.get(
  '/actividades',
  asyncHandler(async (req, res) => {
    const [actividades, profesores] = await Promise.all([
      query(
        `SELECT a.*, p.nombre + ' ' + p.apellido AS profesor,
                (SELECT COUNT(*) FROM inscripciones i
                  WHERE i.actividad_id = a.id AND i.estado = 'confirmada') AS inscriptos
         FROM actividades a
         LEFT JOIN profesores p ON p.id = a.profesor_id
         ORDER BY a.activa DESC, a.dia_semana, a.hora_inicio`
      ),
      query(
        `SELECT id, nombre + ' ' + apellido AS nombre, especialidad
         FROM profesores WHERE activo = 1 ORDER BY apellido, nombre`
      ),
    ]);

    res.render('admin/actividades', {
      title: 'Actividades',
      actividades: actividades.recordset,
      profesores: profesores.recordset,
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
    const errors = [];

    if (!data.nombre) errors.push('Ingresá el nombre de la actividad.');
    if (!data.profesor_id) errors.push('Seleccioná un profesor.');
    if (!DIAS.includes(data.dia_semana)) errors.push('Seleccioná un día válido.');
    if (!HORA_PATTERN.test(data.hora_inicio) || !HORA_PATTERN.test(data.hora_fin)) {
      errors.push('Ingresá un horario válido.');
    } else if (data.hora_fin <= data.hora_inicio) {
      errors.push('La hora de fin debe ser posterior a la de inicio.');
    }
    if (!data.cupo || data.cupo < 1) errors.push('El cupo debe ser mayor a 0.');
    if (data.precio === null || data.precio < 0) errors.push('Ingresá un precio válido.');
    if (!data.sala) errors.push('Ingresá la sala.');

    if (errors.length > 0) {
      const [actividades, profesores] = await Promise.all([
        query(
          `SELECT a.*, p.nombre + ' ' + p.apellido AS profesor,
                  (SELECT COUNT(*) FROM inscripciones i
                    WHERE i.actividad_id = a.id AND i.estado = 'confirmada') AS inscriptos
           FROM actividades a
           LEFT JOIN profesores p ON p.id = a.profesor_id
           ORDER BY a.activa DESC, a.dia_semana, a.hora_inicio`
        ),
        query(
          `SELECT id, nombre + ' ' + apellido AS nombre, especialidad
           FROM profesores WHERE activo = 1 ORDER BY apellido, nombre`
        ),
      ]);
      return res.status(422).render('admin/actividades', {
        title: 'Actividades',
        actividades: actividades.recordset,
        profesores: profesores.recordset,
        dias: DIAS,
        errors,
        old: data,
        active: 'actividades',
      });
    }

    await query(
      `INSERT INTO actividades
         (nombre, descripcion, profesor_id, dia_semana, hora_inicio, hora_fin, cupo, precio, sala)
       VALUES (@nombre, @descripcion, @profesor_id, @dia_semana, @hora_inicio, @hora_fin, @cupo, @precio, @sala)`,
      {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        profesor_id: data.profesor_id,
        dia_semana: data.dia_semana,
        hora_inicio: data.hora_inicio,
        hora_fin: data.hora_fin,
        cupo: data.cupo,
        precio: data.precio,
        sala: data.sala,
      }
    );

    req.flash('success', 'Actividad creada correctamente.');
    res.redirect('/admin/actividades');
  })
);

router.post(
  '/actividades/:id/estado',
  asyncHandler(async (req, res) => {
    const result = await query(
      `UPDATE actividades
       SET activa = CASE WHEN activa = 1 THEN 0 ELSE 1 END
       WHERE id = @id`,
      { id: Number(req.params.id) }
    );
    if (result.rowsAffected[0] > 0) {
      req.flash('success', 'Estado de la actividad actualizado.');
    } else {
      req.flash('error', 'No se encontró la actividad.');
    }
    res.redirect('/admin/actividades');
  })
);

router.get(
  '/pagos',
  asyncHandler(async (req, res) => {
    const [pagos, socios] = await Promise.all([
      query(
        `SELECT p.id, p.concepto, p.monto, p.metodo_pago, p.fecha_pago,
                p.fecha_vencimiento, p.estado,
                s.nombre + ' ' + s.apellido AS socio, s.dni
         FROM pagos p
         JOIN socios s ON s.id = p.socio_id
         ORDER BY ISNULL(p.fecha_pago, p.fecha_vencimiento) DESC, p.id DESC`
      ),
      query(
        `SELECT id, nombre + ' ' + apellido AS nombre, dni
         FROM socios WHERE estado = 'activo' ORDER BY apellido, nombre`
      ),
    ]);

    res.render('admin/pagos', {
      title: 'Pagos y cuotas',
      pagos: pagos.recordset,
      socios: socios.recordset,
      estados: ESTADOS_PAGO,
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
      socio_id: toNumberOrNull(req.body.socio_id),
      concepto: clean(req.body.concepto),
      monto: toNumberOrNull(req.body.monto),
      metodo_pago: clean(req.body.metodo_pago),
      fecha_pago: toDateOrNull(req.body.fecha_pago),
      fecha_vencimiento: toDateOrNull(req.body.fecha_vencimiento),
      estado: clean(req.body.estado) || 'pendiente',
    };
    const errors = [];

    if (!data.socio_id) errors.push('Seleccioná un socio.');
    if (!data.concepto) errors.push('Ingresá el concepto.');
    if (data.monto === null || data.monto <= 0) errors.push('Ingresá un monto válido.');
    if (!ESTADOS_PAGO.includes(data.estado)) errors.push('Seleccioná un estado válido.');

    if (errors.length > 0) {
      const [pagos, socios] = await Promise.all([
        query(
          `SELECT p.id, p.concepto, p.monto, p.metodo_pago, p.fecha_pago,
                  p.fecha_vencimiento, p.estado,
                  s.nombre + ' ' + s.apellido AS socio, s.dni
           FROM pagos p JOIN socios s ON s.id = p.socio_id
           ORDER BY ISNULL(p.fecha_pago, p.fecha_vencimiento) DESC, p.id DESC`
        ),
        query(
          `SELECT id, nombre + ' ' + apellido AS nombre, dni
           FROM socios WHERE estado = 'activo' ORDER BY apellido, nombre`
        ),
      ]);
      return res.status(422).render('admin/pagos', {
        title: 'Pagos y cuotas',
        pagos: pagos.recordset,
        socios: socios.recordset,
        estados: ESTADOS_PAGO,
        errors,
        old: data,
        active: 'pagos',
      });
    }

    await query(
      `INSERT INTO pagos
         (socio_id, concepto, monto, metodo_pago, fecha_pago, fecha_vencimiento, estado)
       VALUES (@socio_id, @concepto, @monto, @metodo_pago, @fecha_pago, @fecha_vencimiento, @estado)`,
      {
        socio_id: data.socio_id,
        concepto: data.concepto,
        monto: data.monto,
        metodo_pago: data.metodo_pago || null,
        fecha_pago: data.fecha_pago,
        fecha_vencimiento: data.fecha_vencimiento,
        estado: data.estado,
      }
    );

    req.flash('success', 'Pago registrado correctamente.');
    res.redirect('/admin/pagos');
  })
);

router.post(
  '/pagos/:id/pagar',
  asyncHandler(async (req, res) => {
    const result = await query(
      `UPDATE pagos
       SET estado = 'pagado', fecha_pago = ISNULL(fecha_pago, CAST(SYSDATETIME() AS DATE))
       WHERE id = @id`,
      { id: Number(req.params.id) }
    );
    if (result.rowsAffected[0] > 0) {
      req.flash('success', 'Cuota marcada como pagada.');
    } else {
      req.flash('error', 'No se encontró el pago.');
    }
    res.redirect('/admin/pagos');
  })
);

module.exports = router;
