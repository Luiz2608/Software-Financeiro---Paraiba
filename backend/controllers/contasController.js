const { Pool } = require('pg');

function resolveHost() {
  const host = process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost';
  if (host === 'host.docker.internal') return 'localhost';
  return host;
}

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host: resolveHost(),
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
      password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || process.env.DB_NAME || process.env.POSTGRES_DB || 'contas_app',
    });

function mapTipoFilter(tipoUi) {
  if (!tipoUi) return null;
  const t = String(tipoUi).toLowerCase();
  if (t === 'entrada') return 'ARECEBER';
  if (t === 'saída' || t === 'saida') return 'APAGAR';
  return null;
}

function mapTipoLabel(tipoDb) {
  if (!tipoDb) return '';
  return tipoDb === 'ARECEBER' ? 'Entrada' : 'Saída';
}

// GET /api/contas/movimentos
async function listMovimentos(req, res) {
  const { q, periodo, tipo, status, sort = 'data', order = 'desc', limit = 200, categoria, pessoa_tipo, pessoa_id } = req.query;

  const sortCols = {
    data: 'mc.data_emissao',
    descricao: 'mc.observacao',
    categoria: 'c.descricao',
    tipo: 'mc.tipo',
    valor: 'mc.valor_total',
  };
  const sortCol = sortCols[sort] || sortCols.data;
  const sortOrder = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const tipoDb = mapTipoFilter(tipo);

  const values = [];
  const where = ['mc.ativo = TRUE'];

  if (q) {
    values.push(`%${q}%`);
    where.push('('+
      'LOWER(mc.observacao) LIKE LOWER($' + values.length + ') OR '+
      'LOWER(p.razao_social) LIKE LOWER($' + values.length + ') OR '+
      'LOWER(COALESCE(c.descricao, \'\')) LIKE LOWER($' + values.length + ') OR '+
      'LOWER(COALESCE(c.nome, \'\')) LIKE LOWER($' + values.length + ')'+
    ')');
  }

  // Filtro explícito por tipo de pessoa (CLIENTE|FORNECEDOR|FATURADO)
  if (pessoa_tipo) {
    values.push(String(pessoa_tipo).toUpperCase());
    where.push('p.tipo = $' + values.length);
  }

  // Filtro explícito por pessoa (ID)
  if (pessoa_id) {
    const pid = Number(pessoa_id);
    if (!Number.isNaN(pid) && pid > 0) {
      values.push(pid);
      where.push('mc.id_pessoa = $' + values.length);
    }
  }

  // Filtro explícito por categoria (ID ou texto)
  if (categoria) {
    const catId = Number(categoria);
    if (!Number.isNaN(catId) && catId > 0) {
      values.push(catId);
      where.push('c.id = $' + values.length);
    } else {
      values.push('%' + String(categoria) + '%');
      where.push('(COALESCE(c.descricao, \'\') ILIKE $' + values.length + ' OR COALESCE(c.nome, \'\') ILIKE $' + values.length + ')');
    }
  }

  if (tipoDb) {
    values.push(tipoDb);
    where.push('mc.tipo = $' + values.length);
  }

  if (periodo) {
    let intervalStr = '';
    if (periodo === 'hoje') intervalStr = '1 day';
    else if (periodo === '7d') intervalStr = '7 days';
    else if (periodo === '30d') intervalStr = '30 days';
    if (intervalStr) {
      values.push(intervalStr);
      where.push('mc.data_emissao >= NOW() - ($' + values.length + '::interval)');
    }
  }

  // Status derivado com base nas parcelas abertas/fechadas
  let statusHaving = '';
  if (status) {
    const s = String(status).toLowerCase();
    if (s === 'pago') {
      statusHaving = "HAVING SUM(CASE WHEN COALESCE(par.situacao, 'ABERTA') = 'ABERTA' AND par.ativo = TRUE THEN 1 ELSE 0 END) = 0";
    } else if (s === 'pendente') {
      statusHaving = "HAVING SUM(CASE WHEN COALESCE(par.situacao, 'ABERTA') = 'ABERTA' AND par.ativo = TRUE THEN 1 ELSE 0 END) > 0";
    }
  }

  const sql = `
    SELECT 
      mc.id,
      mc.data_emissao AS data,
      COALESCE(mc.observacao, '') AS descricao,
      COALESCE(c.descricao, '') AS categoria,
      mc.tipo AS tipo_db,
      mc.valor_total AS valor,
      p.razao_social AS pessoa,
      SUM(CASE WHEN COALESCE(par.situacao, 'ABERTA') = 'ABERTA' AND par.ativo = TRUE THEN 1 ELSE 0 END) AS parcelas_abertas
    FROM movimentocontas mc
    LEFT JOIN pessoas p ON p.id = mc.id_pessoa
    LEFT JOIN movimento_classificacao mcc ON mcc.id_movimento = mc.id
    LEFT JOIN classificacao c ON c.id = mcc.id_classificacao
    LEFT JOIN parcelacontas par ON par.id_movimento = mc.id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    GROUP BY mc.id, p.razao_social, c.descricao
    ${statusHaving}
    ORDER BY ${sortCol} ${sortOrder}
    LIMIT ${Number(limit) || 200}
  `;

  try {
    const { rows } = await pool.query(sql, values);
    const data = rows.map(r => ({
      id: r.id,
      data: r.data,
      descricao: r.descricao,
      categoria: r.categoria,
      tipo: mapTipoLabel(r.tipo_db),
      valor: Number(r.valor || 0),
      status: Number(r.parcelas_abertas) > 0 ? 'Pendente' : 'Pago',
      pessoa: r.pessoa || '',
    }));
    res.json({ items: data });
  } catch (err) {
    console.error('Erro ao listar movimentos:', err);
    res.status(500).json({ error: 'Erro ao listar movimentos' });
  }
}

// GET /api/contas/movimentos/:id
async function getMovimento(req, res) {
  const { id } = req.params;
  const sql = `
    SELECT 
      mc.*, 
      p.razao_social AS pessoa
    FROM movimentocontas mc
    LEFT JOIN pessoas p ON p.id = mc.id_pessoa
    WHERE mc.id = $1 AND COALESCE(mc.ativo, TRUE) = TRUE
  `;
  try {
    const { rows } = await pool.query(sql, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Movimento não encontrado' });
    const r = rows[0];
    res.json({
      id: r.id,
      data_emissao: r.data_emissao,
      observacao: r.observacao,
      tipo: mapTipoLabel(r.tipo),
      valor_total: Number(r.valor_total || 0),
      pessoa: r.pessoa || '',
    });
  } catch (err) {
    console.error('Erro ao obter movimento:', err);
    res.status(500).json({ error: 'Erro ao obter movimento' });
  }
}

// GET /api/contas/movimentos/:id/parcelas
async function getParcelas(req, res) {
  const { id } = req.params;
  const sql = `
    SELECT id, numero_parcela, valor_parcela, situacao, data_vencimento, observacao
    FROM parcelacontas 
    WHERE id_movimento = $1 AND COALESCE(ativo, TRUE) = TRUE
    ORDER BY numero_parcela ASC
  `;
  try {
    const { rows } = await pool.query(sql, [id]);
    res.json({ items: rows });
  } catch (err) {
    console.error('Erro ao listar parcelas:', err);
    res.status(500).json({ error: 'Erro ao listar parcelas' });
  }
}

// PUT /api/contas/movimentos/:id
async function updateMovimento(req, res) {
  const { id } = req.params;
  const { observacao, valor_total, data_emissao, tipo } = req.body || {};

  const fields = [];
  const values = [];
  if (observacao !== undefined) { values.push(observacao); fields.push('observacao = $' + values.length); }
  if (valor_total !== undefined) { values.push(valor_total); fields.push('valor_total = $' + values.length); }
  if (data_emissao !== undefined) { values.push(data_emissao); fields.push('data_emissao = $' + values.length); }
  if (tipo !== undefined) {
    const tipoDb = mapTipoFilter(tipo);
    if (tipoDb) { values.push(tipoDb); fields.push('tipo = $' + values.length); }
  }

  if (!fields.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

  values.push(id);
  const sql = `UPDATE movimentocontas SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`;
  try {
    const { rows } = await pool.query(sql, values);
    const r = rows[0];
    res.json({
      id: r.id,
      data_emissao: r.data_emissao,
      observacao: r.observacao,
      tipo: mapTipoLabel(r.tipo),
      valor_total: Number(r.valor_total || 0),
    });
  } catch (err) {
    console.error('Erro ao atualizar movimento:', err);
    res.status(500).json({ error: 'Erro ao atualizar movimento' });
  }
}

// DELETE /api/contas/movimentos/:id (exclusão lógica)
async function deleteMovimento(req, res) {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE movimentocontas SET ativo = FALSE WHERE id = $1', [id]);
    await client.query('UPDATE parcelacontas SET ativo = FALSE WHERE id_movimento = $1', [id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao excluir movimento:', err);
    res.status(500).json({ error: 'Erro ao excluir movimento' });
  } finally {
    client.release();
  }
}

// POST /api/contas/movimentos
async function createMovimento(req, res) {
  const { observacao, valor_total, data_emissao, tipo, id_pessoa } = req.body || {};
  if (valor_total === undefined || data_emissao === undefined) {
    return res.status(400).json({ error: 'Campos obrigatórios: valor_total, data_emissao' });
  }
  const tipoDb = mapTipoFilter(tipo);
  const fields = ['valor_total', 'data_emissao'];
  const values = [valor_total, data_emissao];
  if (observacao !== undefined) { fields.push('observacao'); values.push(observacao); }
  if (tipoDb) { fields.push('tipo'); values.push(tipoDb); }
  if (id_pessoa) { fields.push('id_pessoa'); values.push(id_pessoa); }
  fields.push('ativo'); values.push(true);

  const placeholders = values.map((_, i) => '$' + (i + 1));
  const sql = `INSERT INTO movimentocontas (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
  try {
    const { rows } = await pool.query(sql, values);
    const r = rows[0];
    res.status(201).json({
      id: r.id,
      data_emissao: r.data_emissao,
      observacao: r.observacao,
      tipo: mapTipoLabel(r.tipo),
      valor_total: Number(r.valor_total || 0),
      id_pessoa: r.id_pessoa || null,
    });
  } catch (err) {
    console.error('Erro ao criar movimento:', err);
    res.status(500).json({ error: 'Erro ao criar movimento' });
  }
}

module.exports = {
  listMovimentos,
  getMovimento,
  getParcelas,
  updateMovimento,
  createMovimento,
  deleteMovimento,
};
