// Prepara la base SistemaGimnasio para la web.
//  1. Si la base no existe: la crea con db/CODIGO_PRINCIPAL.sql y carga db/PRUEBA_DATOS.sql.
//  2. Agrega la tabla Usuarios (db/usuarios.sql) si falta.
//  3. Crea la cuenta de administración si no hay ninguna.
//  4. Si se cargaron los datos de prueba (o se pasa --cuentas-demo), crea una cuenta
//     de acceso para cada socio y entrenador que todavía no tenga.
const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const config = require('../src/config');

const dbName = config.db.database;
if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
  console.error('El nombre de la base solo puede tener letras, números y guiones bajos.');
  process.exit(1);
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@gimnasio.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234';
const DEMO_PASSWORDS = { socio: 'Socio1234', entrenador: 'Entrenador1234' };
const withDemoAccounts = process.argv.includes('--cuentas-demo');

// Parte un script de SSMS en lotes (el driver no entiende "GO") y descarta
// los lotes USE / CREATE|ALTER|DROP DATABASE: la base se maneja desde acá.
function readBatches(file) {
  const text = fs.readFileSync(path.join(__dirname, '..', 'db', file), 'utf8').replace(/^﻿/, '');
  const batches = [];
  let current = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*GO\s*(--.*)?$/i.test(line)) {
      batches.push(current.join('\n'));
      current = [];
    } else {
      current.push(line);
    }
  }
  batches.push(current.join('\n'));
  return batches.filter((batch) => {
    const code = batch.replace(/^\s*--.*$/gm, '').trim();
    return code && !/^(USE|CREATE\s+DATABASE|ALTER\s+DATABASE|DROP\s+DATABASE)\b/i.test(code);
  });
}

async function runScript(pool, file) {
  for (const batch of readBatches(file)) {
    await pool.request().batch(batch);
  }
}

function slug(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)[0]
    .replace(/[^a-z0-9]/g, '');
}

async function createDemoAccounts(pool) {
  const taken = new Set(
    (await pool.request().query('SELECT email FROM Usuarios')).recordset.map((r) => r.email.toLowerCase())
  );
  const created = [];

  async function create({ rol, nombre, apellido, idSocio, idEntrenador }) {
    let email = `${slug(nombre)}.${slug(apellido)}@gimnasio.com`;
    let n = 2;
    while (taken.has(email)) email = `${slug(nombre)}.${slug(apellido)}${n++}@gimnasio.com`;
    taken.add(email);
    const hash = await bcrypt.hash(DEMO_PASSWORDS[rol], 10);
    await pool
      .request()
      .input('email', email)
      .input('hash', hash)
      .input('rol', rol)
      .input('id_socio', sql.Int, idSocio ?? null)
      .input('id_entrenador', sql.Int, idEntrenador ?? null)
      .query(
        `INSERT INTO Usuarios (email, password_hash, rol, id_socio, id_entrenador)
         VALUES (@email, @hash, @rol, @id_socio, @id_entrenador)`
      );
    created.push({ rol, email, password: DEMO_PASSWORDS[rol] });
  }

  const entrenadores = await pool.request().query(
    `SELECT e.id_entrenador, e.nombre, e.apellido FROM Entrenadores e
     WHERE NOT EXISTS (SELECT 1 FROM Usuarios u WHERE u.id_entrenador = e.id_entrenador)`
  );
  for (const e of entrenadores.recordset) {
    await create({ rol: 'entrenador', nombre: e.nombre, apellido: e.apellido, idEntrenador: e.id_entrenador });
  }

  const socios = await pool.request().query(
    `SELECT s.id_socio, s.nombre, s.apellidos FROM Socios s
     WHERE NOT EXISTS (SELECT 1 FROM Usuarios u WHERE u.id_socio = s.id_socio)`
  );
  for (const s of socios.recordset) {
    await create({ rol: 'socio', nombre: s.nombre, apellido: s.apellidos, idSocio: s.id_socio });
  }
  return created;
}

async function main() {
  console.log(`Conectando a ${config.db.server}:${config.db.port} como ${config.db.user}...`);

  const master = new sql.ConnectionPool({ ...config.db, database: 'master' });
  await master.connect();
  const exists = await master.request().input('name', sql.NVarChar, dbName).query('SELECT DB_ID(@name) AS id');
  const dbExisted = Boolean(exists.recordset[0].id);
  if (!dbExisted) {
    console.log(`Creando base de datos [${dbName}]...`);
    await master.request().batch(`CREATE DATABASE [${dbName}]`);
  } else {
    console.log(`La base [${dbName}] ya existe.`);
  }
  await master.close();

  const pool = new sql.ConnectionPool(config.db);
  await pool.connect();

  const hasSocios = (await pool.request().query(`SELECT OBJECT_ID('dbo.Socios', 'U') AS id`)).recordset[0].id;
  if (!hasSocios) {
    console.log('Creando tablas (db/CODIGO_PRINCIPAL.sql)...');
    await runScript(pool, 'CODIGO_PRINCIPAL.sql');
  }

  let seeded = false;
  const counts = (
    await pool.request().query(
      `SELECT (SELECT COUNT(*) FROM Socios) AS socios,
              (SELECT COUNT(*) FROM Sedes) AS sedes,
              (SELECT COUNT(*) FROM Membresias) AS membresias`
    )
  ).recordset[0];
  if (counts.socios === 0 && counts.sedes === 0 && counts.membresias === 0) {
    console.log('Cargando datos de prueba (db/PRUEBA_DATOS.sql)...');
    await runScript(pool, 'PRUEBA_DATOS.sql');
    seeded = true;
  } else {
    console.log('La base ya tiene datos; no se cargan los de prueba.');
  }

  console.log('Aplicando tabla Usuarios (db/usuarios.sql)...');
  await runScript(pool, 'usuarios.sql');

  const admins = await pool.request().query(`SELECT COUNT(*) AS total FROM Usuarios WHERE rol = 'admin'`);
  let adminCreated = false;
  if (admins.recordset[0].total === 0) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await pool
      .request()
      .input('email', ADMIN_EMAIL)
      .input('hash', hash)
      .query(`INSERT INTO Usuarios (email, password_hash, rol) VALUES (@email, @hash, 'admin')`);
    adminCreated = true;
  }

  let demo = [];
  if (seeded || withDemoAccounts) demo = await createDemoAccounts(pool);

  await pool.close();

  console.log('\nListo.');
  if (adminCreated) console.log(`  Admin       ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  for (const d of demo) console.log(`  ${d.rol.padEnd(11)} ${d.email} / ${d.password}`);
  if (!adminCreated && demo.length === 0) console.log('  No hubo cuentas nuevas para crear.');
}

main().catch((error) => {
  console.error('\nError al inicializar la base:', error.message);
  if (error.code) console.error('Código:', error.code);
  process.exit(1);
});
