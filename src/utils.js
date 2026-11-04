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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Suma el período de un plan a una fecha ISO (YYYY-MM-DD), ajustando fin de mes.
function vencimientoPara(tipoPlan, fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const meses = { Mensual: 1, Trimestral: 3, Anual: 12 }[tipoPlan];
  const base = new Date(Date.UTC(y, m - 1, d));
  if (!meses) {
    base.setUTCDate(base.getUTCDate() + 1); // Pase Diario
    return base.toISOString().slice(0, 10);
  }
  const target = new Date(Date.UTC(y, m - 1 + meses, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;
function isValidISODate(text) {
  if (!isoDateRe.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function dateToISO(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '');
}

// Fragmentos SQL compartidos: último vencimiento de cada socio y estado de la cuota.
// El estado se calcula desde Pagos (fuente de verdad), no desde Socios.estado_membresia.
const APPLY_ULTIMO_PAGO = `
  OUTER APPLY (
    SELECT TOP 1 pg.fecha_vencimiento, m.tipo_plan
    FROM Pagos pg
    JOIN Membresias m ON m.id_membresia = pg.id_membresia
    WHERE pg.id_socio = s.id_socio
    ORDER BY pg.fecha_vencimiento DESC, pg.id_pago DESC
  ) up`;

const ESTADO_CUOTA_SQL = `CASE
    WHEN up.fecha_vencimiento IS NULL THEN 'sin pagos'
    WHEN up.fecha_vencimiento >= CAST(GETDATE() AS DATE) THEN 'vigente'
    ELSE 'vencido' END`;

module.exports = {
  todayISO,
  vencimientoPara,
  isValidISODate,
  dateToISO,
  APPLY_ULTIMO_PAGO,
  ESTADO_CUOTA_SQL,
  formatMoney,
  formatDate,
  formatTime,
  formatDateTime,
  clean,
  toDateOrNull,
  toNumberOrNull,
  asyncHandler,
};
