const { Client } = require('pg');

function getClient() {
  if (process.env.DATABASE_URL) {
    return new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
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

// GET /api/pessoas
// Query params: q, tipo (FORNECEDOR|CLIENTE|FATURADO), status (ATIVO|INATIVO|TODOS), sort, order
exports.listar = async (req, res) => {
  const { q = '', tipo, status = 'ATIVO', sort = 'razao_social', order = 'asc' } = req.query;

  const client = getClient();
  try {
    await client.connect();

    const filtros = [];
    const params = [];

    if (tipo) {
      params.push(tipo);
      filtros.push(`TIPO = $${params.length}`);
    }

    if (status && status.toUpperCase() !== 'TODOS') {
      const ativo = status.toUpperCase() === 'ATIVO';
      params.push(ativo);
      filtros.push(`ATIVO = $${params.length}`);
    }

    if (q && q.trim() !== '') {
      const tokens = q.trim().split(/\s+/);
      const likeClauses = tokens.map((t, idx) => {
        params.push(`%${t}%`);
        return `(RAZAO_SOCIAL ILIKE $${params.length} OR COALESCE(NOME_FANTASIA,'') ILIKE $${params.length} OR COALESCE(CNPJ_CPF,'') ILIKE $${params.length})`;
      });
      filtros.push(likeClauses.join(' AND '));
    }

    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const safeSort = ['razao_social','nome_fantasia','cnpj_cpf','tipo','data_cadastro'].includes(sort.toLowerCase()) ? sort : 'razao_social';
    const safeOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const query = `
      SELECT id, tipo, razao_social, nome_fantasia, cnpj_cpf, ativo, data_cadastro,
             COALESCE(nome_fantasia, razao_social) AS nome
      FROM pessoas
      ${where}
      ORDER BY ${safeSort} ${safeOrder}
      LIMIT 200
    `;
    const result = await client.query(query, params);
    res.json({ success: true, total: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('Erro ao listar pessoas:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    await client.end();
  }
};

// POST /api/pessoas
exports.criar = async (req, res) => {
  const { tipo, razaoSocial, nomeFantasia, cnpjCpf } = req.body;
  if (!tipo || !razaoSocial) {
    return res.status(400).json({ success: false, error: 'tipo e razaoSocial são obrigatórios' });
  }

  const client = getClient();
  try {
    await client.connect();
    const result = await client.query(
      `INSERT INTO pessoas (tipo, razao_social, nome_fantasia, cnpj_cpf, ativo, data_cadastro)
       VALUES ($1, $2, $3, $4, TRUE, NOW()) RETURNING id`,
      [tipo, razaoSocial, nomeFantasia || null, cnpjCpf || null]
    );
    res.status(201).json({ success: true, id: Number(result.rows[0].id) });
  } catch (err) {
    console.error('Erro ao criar pessoa:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    await client.end();
  }
};

// PUT /api/pessoas/:id
exports.atualizar = async (req, res) => {
  const { id } = req.params;
  const { razaoSocial, nomeFantasia, cnpjCpf } = req.body;

  const client = getClient();
  try {
    await client.connect();
    await client.query(
      `UPDATE pessoas SET razao_social = COALESCE($1, razao_social), nome_fantasia = COALESCE($2, nome_fantasia), cnpj_cpf = COALESCE($3, cnpj_cpf)
       WHERE id = $4`,
      [razaoSocial || null, nomeFantasia || null, cnpjCpf || null, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar pessoa:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    await client.end();
  }
};

// DELETE /api/pessoas/:id (lógico)
exports.excluirLogico = async (req, res) => {
  const { id } = req.params;
  const client = getClient();
  try {
    await client.connect();
    await client.query(`UPDATE pessoas SET ativo = FALSE WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao inativar pessoa:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    await client.end();
  }
};

// PUT /api/pessoas/:id/ativar (lógico)
exports.ativar = async (req, res) => {
  const { id } = req.params;
  const client = getClient();
  try {
    await client.connect();
    await client.query(`UPDATE pessoas SET ativo = TRUE WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao ativar pessoa:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    await client.end();
  }
};
