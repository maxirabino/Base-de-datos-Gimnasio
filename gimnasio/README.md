# FitForge - Sitio de gimnasio con roles

Aplicación web simple en **Node.js + Express + EJS + SQL Server** con registro, inicio de sesión y paneles según el rol.

## Funcionalidades

- **Público:** landing con actividades, horarios, precios y cupos.
- **Socio:** registro propio, reserva y cancelación de clases, historial de cuotas.
- **Profesor:** sus actividades asignadas y listado de alumnos inscriptos.
- **Administración:** alta de profesores y actividades, control de cupos, registro de pagos y cuotas, listado de socios y deuda.

Los profesores y administradores no se registran solos: los crea un administrador (o vienen en los datos demo).

## Requisitos

- Node.js 18+
- SQL Server 2019/2022 (local o Docker)

## Puesta en marcha

```bash
cd /home/maximor/Proyectos/gimnasio
npm install
cp .env.example .env   # si no existe .env, completá tus credenciales
npm run db:init
npm start
```

Abrí http://localhost:3000

### SQL Server con Docker

El proyecto de ejemplo usa un contenedor llamado `fitforge-sql` en el puerto **14330**:

```bash
docker run -d --name fitforge-sql \
  -e ACCEPT_EULA=Y \
  -e 'MSSQL_SA_PASSWORD=FitForge_Dev#2026' \
  -e MSSQL_PID=Developer \
  -p 14330:1433 \
  -v fitforge-sql-data:/var/opt/mssql \
  mcr.microsoft.com/mssql/server:2022-latest
```

Si ya existe y está detenido:

```bash
docker start fitforge-sql
```

Para reinicializar los datos demo, borrá las tablas o eliminá la base `Gimnasio` y volvé a correr `npm run db:init`.

### Usar otra instancia de SQL Server

Editá `.env`:

```env
DB_SERVER=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD="tu_password"
DB_NAME=Gimnasio
DB_ENCRYPT=true
DB_TRUST_SERVER_CERT=true
```

> Si la contraseña tiene `#`, comillas u otros caracteres especiales, ponela entre comillas dobles en `.env`.

## Cuentas demo

| Rol | Email | Contraseña |
| --- | --- | --- |
| Admin | `admin@gimnasio.com` | `Admin1234` |
| Profesor | `lucia@gimnasio.com` | `Profe1234` |
| Profesor | `martin@gimnasio.com` | `Profe1234` |
| Socio | `ana@gimnasio.com` | `Socio1234` |
| Socio | `bruno@gimnasio.com` | `Socio1234` |
| Socio | `carla@gimnasio.com` | `Socio1234` |

## Base de datos

Seis tablas en SQL Server (`db/schema.sql`):

1. **usuarios** — email, contraseña hasheada, rol (`admin`, `profesor`, `socio`), estado.
2. **socios** — datos personales, vinculados a `usuarios`.
3. **profesores** — datos profesionales, vinculados a `usuarios`.
4. **actividades** — nombre, profesor, día, horario, cupo, precio, sala, estado.
5. **inscripciones** — reservas de socios en actividades, con estado (`confirmada` / `cancelada`).
6. **pagos** — cuotas y pagos de cada socio (`pendiente`, `pagado`, `vencido`).

El script `npm run db:init` crea la base si no existe, aplica el esquema y carga datos de ejemplo solo si la tabla `usuarios` está vacía.

## Estructura

```
src/
  app.js              servidor Express
  config.js           configuración y variables de entorno
  db.js               pool y helpers de SQL Server
  utils.js            formato de fechas/moneda y async handler
  middleware/         sesión, roles, flash
  routes/             rutas públicas, auth, socio, profesor, admin
views/                plantillas EJS
public/css/           estilos
db/schema.sql         esquema de las seis tablas
scripts/init-db.js    creación de base + datos demo
```

## Notas

- Las sesiones usan el store en memoria de Express, suficiente para desarrollo. Para producción conviene un store persistente (Redis, etc.) y `SESSION_SECRET` propio.
- Las contraseñas se guardan con `bcrypt` (10 rondas).
- Las consultas usan parámetros para evitar inyección SQL.
- No hay eliminación de registros con historial: las actividades se despublican y las reservas se cancelan.
