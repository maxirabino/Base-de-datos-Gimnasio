const express = require('express');
const bcrypt = require('bcryptjs');
const { query, transaction, txQuery } = require('../db');
const { clean, toDateOrNull, asyncHandler, isValidISODate, dateToISO } = require('../utils');
const { panelUrl } = require('../middleware/auth');

const router = express.Router();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeNext(value) {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect(panelUrl(req.session.user.rol));
  res.render('login', {
    title: 'Ingresar',
    errors: [],
    old: {},
    next: safeNext(req.query.next) || '',
  });
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = clean(req.body.email).toLowerCase();
    const password = String(req.body.password || '');
    const next = safeNext(req.body.next) || safeNext(req.query.next);
    const errors = [];

    if (!email || !password) errors.push('Completá el email y la contraseña.');

    let usuario = null;
    if (errors.length === 0) {
      const result = await query(
        `SELECT id_usuario, email, password_hash, rol, activo, id_socio, id_entrenador
         FROM Usuarios WHERE email = @email`,
        { email }
      );
      usuario = result.recordset[0] || null;
      if (!usuario) {
        errors.push('Email o contraseña incorrectos.');
      } else if (!usuario.activo) {
        errors.push('La cuenta está deshabilitada. Contactá al gimnasio.');
      } else {
        const valid = await bcrypt.compare(password, usuario.password_hash);
        if (!valid) errors.push('Email o contraseña incorrectos.');
      }
    }

    if (errors.length > 0) {
      return res.status(401).render('login', {
        title: 'Ingresar',
        errors,
        old: { email },
        next: next || '',
      });
    }

    req.session.user = {
      id: usuario.id_usuario,
      email: usuario.email,
      rol: usuario.rol,
      idSocio: usuario.id_socio,
      idEntrenador: usuario.id_entrenador,
    };
    req.flash('success', 'Bienvenido/a de nuevo.');
    res.redirect(next || panelUrl(usuario.rol));
  })
);

router.get('/registro', (req, res) => {
  if (req.session.user) return res.redirect(panelUrl(req.session.user.rol));
  res.render('registro', {
    title: 'Crear cuenta',
    errors: [],
    old: {},
  });
});

router.post(
  '/registro',
  asyncHandler(async (req, res) => {
    const data = {
      nombre: clean(req.body.nombre),
      apellidos: clean(req.body.apellidos),
      documento: clean(req.body.documento),
      telefono: clean(req.body.telefono),
      direccion: clean(req.body.direccion),
      fecha_nacimiento: toDateOrNull(req.body.fecha_nacimiento),
      email: clean(req.body.email).toLowerCase(),
      password: String(req.body.password || ''),
      password2: String(req.body.password2 || ''),
    };
    const errors = [];

    if (!data.nombre) errors.push('Ingresá tu nombre.');
    if (!data.apellidos) errors.push('Ingresá tus apellidos.');
    if (!data.documento) errors.push('Ingresá tu documento.');
    if (!data.fecha_nacimiento || !isValidISODate(data.fecha_nacimiento)) {
      errors.push('Ingresá tu fecha de nacimiento.');
    }
    if (!emailPattern.test(data.email)) errors.push('Ingresá un email válido.');
    if (data.password.length < 8) errors.push('La contraseña debe tener al menos 8 caracteres.');
    if (data.password !== data.password2) errors.push('Las contraseñas no coinciden.');

    // Si el documento ya pertenece a un socio cargado por recepción y todavía no tiene
    // cuenta, se vincula la cuenta a ese socio (validando la fecha de nacimiento).
    let socioExistente = null;
    if (errors.length === 0) {
      const found = await query(
        `SELECT s.id_socio, s.fecha_nacimiento,
                (SELECT COUNT(*) FROM Usuarios u WHERE u.id_socio = s.id_socio) AS cuentas,
                (SELECT COUNT(*) FROM Usuarios WHERE email = @email) AS email_usado
         FROM Socios s WHERE s.documento = @documento`,
        { documento: data.documento, email: data.email }
      );
      const row = found.recordset[0];
      const emailUsado = row
        ? row.email_usado > 0
        : (await query(`SELECT COUNT(*) AS n FROM Usuarios WHERE email = @email`, { email: data.email }))
            .recordset[0].n > 0;
      if (emailUsado) errors.push('Ya existe una cuenta con ese email.');
      if (row) {
        if (row.cuentas > 0) {
          errors.push('Ese documento ya tiene una cuenta. Ingresá con tu email.');
        } else if (dateToISO(row.fecha_nacimiento) !== data.fecha_nacimiento) {
          errors.push('Los datos no coinciden con el socio registrado en el gimnasio. Consultá en recepción.');
        } else {
          socioExistente = row;
        }
      }
    }

    if (errors.length > 0) {
      return res.status(422).render('registro', {
        title: 'Crear cuenta',
        errors,
        old: { ...data, password: '', password2: '' },
      });
    }

    const hash = await bcrypt.hash(data.password, 10);

    const usuario = await transaction(async (tx) => {
      let idSocio;
      if (socioExistente) {
        idSocio = socioExistente.id_socio;
      } else {
        const socio = await txQuery(
          tx,
          `INSERT INTO Socios
             (nombre, apellidos, documento, telefono, direccion, fecha_nacimiento, estado_membresia)
           OUTPUT INSERTED.id_socio
           VALUES (@nombre, @apellidos, @documento, @telefono, @direccion, @fecha_nacimiento, 'Vencido')`,
          {
            nombre: data.nombre,
            apellidos: data.apellidos,
            documento: data.documento,
            telefono: data.telefono || null,
            direccion: data.direccion || null,
            fecha_nacimiento: data.fecha_nacimiento,
          }
        );
        idSocio = socio.recordset[0].id_socio;
      }
      const inserted = await txQuery(
        tx,
        `INSERT INTO Usuarios (email, password_hash, rol, id_socio)
         OUTPUT INSERTED.id_usuario, INSERTED.email
         VALUES (@email, @hash, 'socio', @id_socio)`,
        { email: data.email, hash, id_socio: idSocio }
      );
      return { ...inserted.recordset[0], idSocio };
    });

    req.session.user = {
      id: usuario.id_usuario,
      email: usuario.email,
      rol: 'socio',
      idSocio: usuario.idSocio,
      idEntrenador: null,
    };
    req.flash(
      'success',
      socioExistente
        ? '¡Cuenta vinculada a tu ficha de socio!'
        : '¡Cuenta creada! Para activar tu membresía acercate a recepción.'
    );
    res.redirect('/socio');
  })
);

router.post('/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('fitforge.sid');
    res.redirect('/');
  });
});

module.exports = router;
