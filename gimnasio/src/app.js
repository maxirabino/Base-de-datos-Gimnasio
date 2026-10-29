const path = require('path');
const express = require('express');
const session = require('express-session');
const config = require('./config');
const { loadUser } = require('./middleware/auth');
const flash = require('./middleware/flash');
const {
  formatMoney,
  formatDate,
  formatTime,
  formatDateTime,
} = require('./utils');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(
  session({
    name: 'fitforge.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use(loadUser);
app.use(flash);

app.locals.formatMoney = formatMoney;
app.locals.formatDate = formatDate;
app.locals.formatTime = formatTime;
app.locals.formatDateTime = formatDateTime;

app.use('/', require('./routes/public'));
app.use('/', require('./routes/auth'));
app.use('/socio', require('./middleware/auth').requireRole('socio'), require('./routes/socio'));
app.use(
  '/profesor',
  require('./middleware/auth').requireRole('profesor'),
  require('./routes/profesor')
);
app.use('/admin', require('./middleware/auth').requireRole('admin'), require('./routes/admin'));

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Página no encontrada',
    status: 404,
    message: 'La página que buscás no existe o fue movida.',
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  const message =
    error.code === 'ESOCKET' || error.code === 'ELOGIN' || error.code === 'ECONNREFUSED'
      ? 'No pudimos conectar con la base de datos. Verificá que SQL Server esté corriendo y que las credenciales del archivo .env sean correctas.'
      : 'Ocurrió un error inesperado. Intentá nuevamente.';
  res.status(500).render('error', {
    title: 'Error',
    status: 500,
    message,
  });
});

app.listen(config.port, () => {
  console.log(`FitForge escuchando en http://localhost:${config.port}`);
});
