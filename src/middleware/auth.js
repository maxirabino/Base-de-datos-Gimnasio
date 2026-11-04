const roleHome = {
  admin: '/admin',
  profesor: '/profesor',
  socio: '/socio',
};

function panelUrl(role) {
  const cleanRole = (role || 'socio').trim().toLowerCase();
  return roleHome[cleanRole] || '/';
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
    
    // Limpiamos los espacios por si SQL Server mandó basura
    const userRole = (req.session.user.rol || '').trim().toLowerCase();
    
    if (!roles.includes(userRole)) {
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