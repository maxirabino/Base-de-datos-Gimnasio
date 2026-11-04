const roleHome = {
  admin: '/admin',
  entrenador: '/entrenador',
  socio: '/socio',
};

function panelUrl(role) {
  return roleHome[role] || '/';
}

function loadUser(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  res.locals.panelUrl = panelUrl;
  next();
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
    }
    if (!roles.includes(req.session.user.rol)) {
      return res.status(403).render('error', {
        title: 'Acceso denegado',
        status: 403,
        message: 'No tenés permisos para entrar a esta sección.',
      });
    }
    next();
  };
}

module.exports = { loadUser, requireAuth, requireRole, panelUrl };
