const { Client } = require('pg');

function getClient() {
  if (process.env.DATABASE_URL) {
    return new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  }
  const isDocker = process.env.RUNNING_IN_DOCKER === 'true';
  const host = isDocker ? 'postgres' : (process.env.DB_HOST || '127.0.0.1');
  return new Client({
    user: process.env.DB_USER || 'postgres',
    host,
    database: process.env.DB_NAME || 'contas_app',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
    ssl: (process.env.DB_SSL === 'true' || process.env.RENDER === 'true') ? { rejectUnauthorized: false } : undefined,
  });
}

// GET /api/classificacao
// Query: q, tipo (RECEITA|DESPESA), status (ATIVO|INATIVO|TODOS), sort, order
exports.listar = async (req, res) => {
  const { q = '', tipo, status = 'ATIVO', sort = 'descricao', order = 'asc' } = req.query;

  const client = getClient();
  try {
    await client.connect();
    const filtros = [];
    const params = [];

    if (tipo) { params.push(tipo); filtros.push(`TIPO = $${params.length}`); }

    if (status && status.toUpperCase() !== 'TODOS') {
      const ativo = status.toUpperCase() === 'ATIVO';
      params.push(ativo);
      filtros.push(`ATIVO = $${params.length}`);
    }

    if (q && q.trim() !== '') {
      const tokens = q.trim().split(/\s+/);
      const likeClauses = tokens.map(t => {
        params.push(`%${t}%`);
        return `(COALESCE(DESCRICAO,'') ILIKE $${params.length} OR COALESCE(NOME,'') ILIKE $${params.length})`;
      });
      filtros.push(likeClauses.join(' AND '));
    }

    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const safeSort = ['id','descricao','nome','tipo','data_cadastro'].includes(sort.toLowerCase()) ? sort : 'descricao';
    const safeOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const query = `
      SELECT id, tipo, COALESCE(nome, descricao) AS nome, descricao, ativo, data_cadastro
      FROM classificacao
      ${where}
      ORDER BY ${safeSort} ${safeOrder}
      LIMIT 200
    `;
    const result = await client.query(query, params);
    res.json({ success: true, total: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('Erro ao listar classificacao:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    await client.end();
  }
};

// POST /api/classificacao
exports.criar = async (req, res) => {
  const { tipo, nome, descricao } = req.body;
  if (!tipo || !(nome || descricao)) {
    return res.status(400).json({ success: false, error: 'tipo e nome/descricao são obrigatórios' });
  }
  const n = (nome && nome.trim()) ? nome.trim() : (descricao && descricao.trim()) ? descricao.trim() : 'NAO_CLASSIFICADA';

  const client = getClient();
  try {
    await client.connect();
    // Detectar coluna NOME
    const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='classificacao' AND column_name='nome'`);
    let result;
    if (cols.rows.length > 0) {
      result = await client.query(
        `INSERT INTO classificacao (nome, tipo, descricao, ativo, data_cadastro) VALUES ($1, $2, $3, TRUE, NOW()) RETURNING id`,
        [n, tipo, descricao || n]
      );
    } else {
      result = await client.query(
        `INSERT INTO classificacao (tipo, descricao, ativo, data_cadastro) VALUES ($1, $2, TRUE, NOW()) RETURNING id`,
        [tipo, n]
      );
    }
    res.status(201).json({ success: true, id: Number(result.rows[0].id) });
  } catch (err) {
    console.error('Erro ao criar classificacao:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    await client.end();
  }
};

// PUT /api/classificacao/:id
exports.atualizar = async (req, res) => {
  const { id } = req.params;
  const { nome, descricao } = req.body;
  const n = (nome && nome.trim()) ? nome.trim() : null;
  const d = (descricao && descricao.trim()) ? descricao.trim() : null;

  const client = getClient();
  try {
    await client.connect();
    await client.query(
      `UPDATE classificacao SET nome = COALESCE($1, nome), descricao = COALESCE($2, descricao) WHERE id = $3`,
      [n, d, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar classificacao:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    await client.end();
  }
};

// DELETE /api/classificacao/:id (lógico)
exports.excluirLogico = async (req, res) => {
  const { id } = req.params;
  const client = getClient();
  try {
    await client.connect();
    await client.query(`UPDATE classificacao SET ativo = FALSE WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao inativar classificacao:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    await client.end();
  }
};
