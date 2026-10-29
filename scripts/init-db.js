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

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function request(tx) {
  return new sql.Request(tx);
}

async function insertUser(tx, { email, password, rol }) {
  const hash = await bcrypt.hash(password, 10);
  const result = await request(tx)
    .input('email', email)
    .input('hash', hash)
    .input('rol', rol)
    .query(
      `INSERT INTO usuarios (email, password_hash, rol)
       OUTPUT INSERTED.id
       VALUES (@email, @hash, @rol)`
    );
  return result.recordset[0].id;
}

async function seed(pool) {
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const adminId = await insertUser(tx, {
      email: 'admin@gimnasio.com',
      password: 'Admin1234',
      rol: 'admin',
    });

    const luciaUser = await insertUser(tx, {
      email: 'lucia@gimnasio.com',
      password: 'Profe1234',
      rol: 'profesor',
    });
    const martinUser = await insertUser(tx, {
      email: 'martin@gimnasio.com',
      password: 'Profe1234',
      rol: 'profesor',
    });
    const anaUser = await insertUser(tx, {
      email: 'ana@gimnasio.com',
      password: 'Socio1234',
      rol: 'socio',
    });
    const brunoUser = await insertUser(tx, {
      email: 'bruno@gimnasio.com',
      password: 'Socio1234',
      rol: 'socio',
    });
    const carlaUser = await insertUser(tx, {
      email: 'carla@gimnasio.com',
      password: 'Socio1234',
      rol: 'socio',
    });

    const lucia = await request(tx)
      .input('usuario_id', luciaUser)
      .query(
        `INSERT INTO profesores
           (usuario_id, nombre, apellido, dni, telefono, especialidad, fecha_contratacion)
         OUTPUT INSERTED.id
         VALUES (@usuario_id, N'Lucía', N'Fernández', N'30111222', N'11 5555-1001',
                 N'Yoga y Pilates', '2022-03-01')`
      );
    const martin = await request(tx)
      .input('usuario_id', martinUser)
      .query(
        `INSERT INTO profesores
           (usuario_id, nombre, apellido, dni, telefono, especialidad, fecha_contratacion)
         OUTPUT INSERTED.id
         VALUES (@usuario_id, N'Martín', N'Sosa', N'28999888', N'11 5555-1002',
                 N'Entrenamiento funcional', '2021-08-15')`
      );

    const ana = await request(tx)
      .input('usuario_id', anaUser)
      .query(
        `INSERT INTO socios
           (usuario_id, nombre, apellido, dni, telefono, fecha_nacimiento, fecha_alta)
         OUTPUT INSERTED.id
         VALUES (@usuario_id, N'Ana', N'Pérez', N'35111222', N'11 4444-2001',
                 '1990-05-14', '2024-01-10')`
      );
    const bruno = await request(tx)
      .input('usuario_id', brunoUser)
      .query(
        `INSERT INTO socios
           (usuario_id, nombre, apellido, dni, telefono, fecha_nacimiento, fecha_alta)
         OUTPUT INSERTED.id
         VALUES (@usuario_id, N'Bruno', N'Gómez', N'32777888', N'11 4444-2002',
                 '1985-11-02', '2024-06-03')`
      );
    const carla = await request(tx)
      .input('usuario_id', carlaUser)
      .query(
        `INSERT INTO socios
           (usuario_id, nombre, apellido, dni, telefono, fecha_nacimiento, fecha_alta)
         OUTPUT INSERTED.id
         VALUES (@usuario_id, N'Carla', N'Ruiz', N'36999111', N'11 4444-2003',
                 '1996-02-23', '2025-02-18')`
      );

    const luciaId = lucia.recordset[0].id;
    const martinId = martin.recordset[0].id;
    const anaId = ana.recordset[0].id;
    const brunoId = bruno.recordset[0].id;
    const carlaId = carla.recordset[0].id;

    const actividades = [
      [
        'Funcional Full Body',
        'Entrenamiento de fuerza y acondicionamiento con circuitos y pesas.',
        martinId,
        'Lunes',
        '08:00',
        '09:00',
        20,
        12000,
        'Sala 1',
      ],
      [
        'Cross Training',
        'Clase intensa de alta intensidad por estaciones.',
        martinId,
        'Martes',
        '19:00',
        '20:00',
        15,
        13500,
        'Sala 1',
      ],
      [
        'Yoga Flow',
        'Movilidad, respiración y secuencias de yoga para todos los niveles.',
        luciaId,
        'Miércoles',
        '09:00',
        '10:00',
        18,
        10000,
        'Sala 2',
      ],
      [
        'Pilates Reformer',
        'Trabajo de core y postura con equipamiento Pilates.',
        luciaId,
        'Jueves',
        '18:00',
        '19:00',
        12,
        11500,
        'Sala 2',
      ],
      [
        'Spinning',
        'Cardio sobre bicicleta con música y series por intervalos.',
        martinId,
        'Sábado',
        '10:00',
        '11:00',
        16,
        11000,
        'Sala 3',
      ],
    ];

    const actividadIds = [];
    for (const a of actividades) {
      const result = await request(tx)
        .input('nombre', a[0])
        .input('descripcion', a[1])
        .input('profesor_id', a[2])
        .input('dia_semana', a[3])
        .input('hora_inicio', a[4])
        .input('hora_fin', a[5])
        .input('cupo', a[6])
        .input('precio', a[7])
        .input('sala', a[8])
        .query(
          `INSERT INTO actividades
             (nombre, descripcion, profesor_id, dia_semana, hora_inicio, hora_fin, cupo, precio, sala)
           OUTPUT INSERTED.id
           VALUES (@nombre, @descripcion, @profesor_id, @dia_semana, @hora_inicio, @hora_fin,
                   @cupo, @precio, @sala)`
        );
      actividadIds.push(result.recordset[0].id);
    }

    const inscripciones = [
      [anaId, actividadIds[0]],
      [anaId, actividadIds[1]],
      [brunoId, actividadIds[2]],
      [carlaId, actividadIds[0]],
      [carlaId, actividadIds[4]],
    ];

    for (const [socioId, actividadId] of inscripciones) {
      await request(tx)
        .input('socio_id', socioId)
        .input('actividad_id', actividadId)
        .query(
          `INSERT INTO inscripciones (socio_id, actividad_id)
           VALUES (@socio_id, @actividad_id)`
        );
    }

    const pagos = [
      [anaId, 'Cuota octubre', 12000, 'Tarjeta', isoDate(-15), isoDate(-15), 'pagado'],
      [anaId, 'Cuota noviembre', 12000, null, null, isoDate(10), 'pendiente'],
      [brunoId, 'Cuota noviembre', 10000, 'Efectivo', isoDate(-5), isoDate(-5), 'pagado'],
      [carlaId, 'Cuota octubre', 11000, null, null, isoDate(-20), 'vencido'],
      [carlaId, 'Cuota noviembre', 11000, null, null, isoDate(10), 'pendiente'],
    ];

    for (const p of pagos) {
      await request(tx)
        .input('socio_id', p[0])
        .input('concepto', p[1])
        .input('monto', p[2])
        .input('metodo_pago', p[3])
        .input('fecha_pago', p[4])
        .input('fecha_vencimiento', p[5])
        .input('estado', p[6])
        .query(
          `INSERT INTO pagos
             (socio_id, concepto, monto, metodo_pago, fecha_pago, fecha_vencimiento, estado)
           VALUES (@socio_id, @concepto, @monto, @metodo_pago, @fecha_pago,
                   @fecha_vencimiento, @estado)`
        );
    }

    await tx.commit();
    console.log(`Datos demo cargados. Admin id: ${adminId}`);
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

async function main() {
  console.log(`Conectando a ${config.db.server}:${config.db.port} como ${config.db.user}...`);

  const master = new sql.ConnectionPool({ ...config.db, database: 'master' });
  await master.connect();

  const exists = await master
    .request()
    .input('name', sql.NVarChar, dbName)
    .query('SELECT DB_ID(@name) AS id');

  if (!exists.recordset[0].id) {
    console.log(`Creando base de datos [${dbName}]...`);
    await master.request().batch(`CREATE DATABASE [${dbName}]`);
  } else {
    console.log(`La base [${dbName}] ya existe.`);
  }
  await master.close();

  const pool = new sql.ConnectionPool(config.db);
  await pool.connect();
  console.log('Aplicando esquema...');
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.request().batch(schema);

  const count = await pool.request().query('SELECT COUNT(*) AS total FROM usuarios');
  if (count.recordset[0].total === 0) {
    console.log('Cargando datos de ejemplo...');
    await seed(pool);
  } else {
    console.log('La base ya tiene usuarios; no se cargan datos demo.');
  }

  await pool.close();

  console.log('\nListo. Cuentas demo:');
  console.log('  Admin     admin@gimnasio.com  / Admin1234');
  console.log('  Profesor  lucia@gimnasio.com  / Profe1234');
  console.log('  Profesor  martin@gimnasio.com / Profe1234');
  console.log('  Socio     ana@gimnasio.com    / Socio1234');
  console.log('  Socio     bruno@gimnasio.com  / Socio1234');
  console.log('  Socio     carla@gimnasio.com  / Socio1234');
}

main().catch((error) => {
  console.error('\nError al inicializar la base:', error.message);
  if (error.code) console.error('Código:', error.code);
  process.exit(1);
});
