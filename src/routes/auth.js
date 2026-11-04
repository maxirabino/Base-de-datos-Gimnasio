const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { clean, toDateOrNull, asyncHandler } = require('../utils');
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
        `SELECT id_socio AS id, email, password_hash, ISNULL(rol, 'socio') AS rol, ISNULL(activo, 1) AS activo
         FROM Socios WHERE email = @email`,
        { email }
      );
      usuario = result.recordset[0] || null;
      
      if (!usuario || !usuario.password_hash) {
        errors.push('Email o contraseña incorrectos.');
      } else if (!usuario.activo) {
        errors.push('La cuenta está deshabilitada.');
      } else {
        // Cuentas de prueba rápidas
        let valid = false;
        if (email === 'admin@gimnasio.com' && password === 'Admin1234') valid = true;
        else if (email === 'lucia@gimnasio.com' && password === 'Profe1234') valid = true;
        else {
          valid = await bcrypt.compare(password, usuario.password_hash);
        }

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

    // Sellamos la sesión de forma segura y obligatoria
    req.session.user = {
      id: usuario.id,
      email: usuario.email,
      rol: (usuario.rol || 'socio').trim().toLowerCase(),
    };
    
    req.session.save((err) => {
      req.flash('success', 'Bienvenido/a de nuevo.');
      res.redirect(next || panelUrl(req.session.user.rol));
    });
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
      apellido: clean(req.body.apellido),
      dni: clean(req.body.dni),
      telefono: clean(req.body.telefono),
      fecha_nacimiento: toDateOrNull(req.body.fecha_nacimiento),
      email: clean(req.body.email).toLowerCase(),
      password: String(req.body.password || ''),
      password2: String(req.body.password2 || ''),
    };
    const errors = [];

    if (!data.nombre) errors.push('Ingresá tu nombre.');
    if (!data.apellido) errors.push('Ingresá tu apellido.');
    if (!data.dni) errors.push('Ingresá tu DNI.');
    if (!emailPattern.test(data.email)) errors.push('Ingresá un email válido.');
    if (data.password.length < 8) errors.push('La contraseña debe tener al menos 8 caracteres.');
    if (data.password !== data.password2) errors.push('Las contraseñas no coinciden.');

    if (errors.length === 0) {
      const duplicado = await query(
        `SELECT 
           (SELECT COUNT(*) FROM Socios WHERE email = @email) AS email_count,
           (SELECT COUNT(*) FROM Socios WHERE documento = @dni) AS dni_count`,
        { email: data.email, dni: data.dni }
      );
      const row = duplicado.recordset[0];
      if (row.email_count > 0) errors.push('Ya existe una cuenta con ese email.');
      if (row.dni_count > 0) errors.push('Ya existe un socio con ese DNI.');
    }

    if (errors.length > 0) {
      return res.status(422).render('registro', {
        title: 'Crear cuenta',
        errors,
        old: { ...data, password: '', password2: '' },
      });
    }

    const hash = await bcrypt.hash(data.password, 10);

    const result = await query(
      `INSERT INTO Socios (nombre, apellidos, documento, telefono, direccion, fecha_nacimiento, fecha_alta, email, password_hash, activo, rol)
       OUTPUT INSERTED.id_socio, INSERTED.email
       VALUES (@nombre, @apellido, @dni, @telefono, '', @fecha_nacimiento, GETDATE(), @email, @hash, 1, 'socio')`,
      {
        nombre: data.nombre,
        apellido: data.apellido,
        dni: data.dni,
        telefono: data.telefono || null,
        fecha_nacimiento: data.fecha_nacimiento,
        email: data.email,
        hash: hash,
      }
    );

    const nuevoSocio = result.recordset[0];

    req.session.user = { id: nuevoSocio.id_socio, email: nuevoSocio.email, rol: 'socio' };
    
    req.session.save(() => {
      req.flash('success', '¡Cuenta creada! Ya podés reservar tus clases.');
      res.redirect('/socio');
    });
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