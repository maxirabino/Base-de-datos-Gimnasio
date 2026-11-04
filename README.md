# FitForge – Web del gimnasio sobre `SistemaGimnasio`

Aplicación **Node.js + Express + EJS + SQL Server** que trabaja directamente sobre la base
`SistemaGimnasio` (tablas `Socios`, `Membresias`, `Pagos`, `Entrenadores`, `Rutinas`, `Ejercicios`,
`Rutinas_Personalizadas`, `Evolucion_Fisica`, `Sedes`, `Control_Ingresos`).
La base propia que traía la web (`usuarios`, `actividades`, `inscripciones`, …) **ya no se usa**.

## Qué agrega a tu modelo

Una sola tabla nueva, **`Usuarios`** (`db/usuarios.sql`), porque el modelo original no tiene login:
email, hash de contraseña, rol (`admin` / `entrenador` / `socio`) y el vínculo con `Socios` o `Entrenadores`.
Todo lo demás son tus tablas, sin cambios.

## Funcionalidades por rol

| Rol | Qué puede hacer |
| --- | --- |
| Público | Ver membresías (planes y promos), sedes y entrenadores. |
| Socio | Ver su membresía y vencimiento, pagos, rutinas asignadas con ejercicios, evolución física e ingresos. |
| Entrenador | Asignar rutinas a socios, ver la ficha de sus socios y registrar evaluaciones físicas. |
| Admin | Resumen, socios, alta de entrenadores, registrar pagos, catálogo de rutinas/ejercicios y control de ingresos/egresos por sede. |

Reglas de negocio:
- El **estado de la cuota** se calcula desde `Pagos` (vigente si algún pago tiene `fecha_vencimiento >= hoy`).
  `Socios.estado_membresia` se actualiza al registrar un pago y con el botón *Sincronizar* en Admin → Socios.
- Al registrar un pago, si no se indica monto ni vencimiento se usan el costo del plan y el período
  (Mensual +1 mes, Trimestral +3, Anual +12, Pase Diario +1 día).
- No se registra el ingreso de un socio con la cuota vencida, ni dos ingresos abiertos el mismo día.
- **Registro de socios existentes:** si alguien ya está cargado en `Socios` y crea su cuenta con el mismo
  documento *y* fecha de nacimiento, la cuenta se vincula a su ficha (no se duplica).

## Puesta en marcha

Requisitos: Node.js 18+ y SQL Server 2019/2022.

```bash
npm install
cp .env.example .env     # completá DB_SERVER, DB_USER, DB_PASSWORD (DB_NAME=SistemaGimnasio)
npm run db:init
npm start                # http://localhost:3000
```

`npm run db:init`:
1. Si la base no existe, la crea con `db/CODIGO_PRINCIPAL.sql` y carga `db/PRUEBA_DATOS.sql`.
2. Agrega la tabla `Usuarios` si falta.
3. Crea el administrador (`ADMIN_EMAIL` / `ADMIN_PASSWORD` del `.env`; por defecto `admin@gimnasio.com` / `Admin1234`).
4. Con datos de prueba recién cargados crea una cuenta por socio y entrenador (`nombre.apellido@gimnasio.com`,
   contraseñas `Socio1234` / `Entrenador1234`). Se muestran por consola.

Si **ya creaste la base desde SSMS** con tus scripts, `db:init` no toca tus datos: solo agrega `Usuarios` y el admin.
Para generar cuentas de acceso a los socios/entrenadores existentes: `npm run db:cuentas-demo`.

## Scripts SQL (carpeta `db/`)

- `CODIGO_PRINCIPAL.sql`, `PRUEBA_DATOS.sql`, `CONSULTAS_DE_PRUEBA.sql`: los tuyos, sin cambios.
- `usuarios.sql`: tabla de acceso a la web.
- `LimpiarTablas.sql`: el tuyo, con `DELETE FROM Usuarios` y su `RESEED` agregados.

## Seguridad

Cambiá `SESSION_SECRET` en `.env` y las contraseñas demo antes de publicar el sitio.
