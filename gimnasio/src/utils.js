const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

function formatMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? money.format(number) : '-';
}

function formatDate(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('es-AR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(value) {
  if (!value) return '-';
  if (value instanceof Date) {
    return value.toISOString().slice(11, 16);
  }
  return String(value).slice(0, 5);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function clean(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toDateOrNull(value) {
  const text = clean(value);
  return text === '' ? null : text;
}

function toNumberOrNull(value) {
  const text = clean(value);
  if (text === '') return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

module.exports = {
  formatMoney,
  formatDate,
  formatTime,
  formatDateTime,
  clean,
  toDateOrNull,
  toNumberOrNull,
  asyncHandler,
};
