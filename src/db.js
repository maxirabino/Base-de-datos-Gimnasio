const sql = require('mssql');
const config = require('./config'); // Lee directamente desde las variables de entorno

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config.db)
      .connect()
      .then((pool) => pool)
      .catch((error) => {
        poolPromise = undefined;
        throw error;
      });
  }
  return poolPromise;
}

function addInputs(request, params = {}) {
  for (const [name, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      request.input(name, sql.NVarChar, null);
    } else {
      request.input(name, value);
    }
  }
}

async function query(text, params = {}) {
  const pool = await getPool();
  const request = pool.request();
  addInputs(request, params);
  return request.query(text);
}

async function execute(text, params = {}) {
  const pool = await getPool();
  const request = pool.request();
  addInputs(request, params);
  return request.query(text);
}

async function transaction(callback) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const result = await callback(tx);
    await tx.commit();
    return result;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

function txQuery(tx, text, params = {}) {
  const request = new sql.Request(tx);
  addInputs(request, params);
  return request.query(text);
}

module.exports = { sql, getPool, query, execute, transaction, txQuery };