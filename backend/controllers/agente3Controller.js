const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pool } = require('pg');
const EmbeddingSearch = require('../utils/EmbeddingSearch');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'contas_app',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
});

// Carrega embeddings, se existir
EmbeddingSearch.carregarBase();

async function buscarDados(pergunta) {
    const perguntaLower = (pergunta || '').toLowerCase();

    if (perguntaLower.includes('total') || perguntaLower.includes('soma')) {
        const result = await pool.query(`
            SELECT 
                tipo,
                COUNT(*) as quantidade,
                SUM(valor_total) as total
            FROM movimentocontas 
            GROUP BY tipo
        `);
        return result.rows;
    }

    if (perguntaLower.includes('parcela') || perguntaLower.includes('vencimento')) {
        const result = await pool.query(`
            SELECT 
                pc.numero_parcela,
                pc.data_vencimento,
                pc.valor_parcela,
                pc.situacao,
                mc.numero_documento,
                p.razao_social
            FROM parcelacontas pc
            LEFT JOIN movimentocontas mc ON pc.id_movimento = mc.id
            LEFT JOIN pessoas p ON mc.id_pessoa = p.id
            ORDER BY pc.data_vencimento DESC 
            LIMIT 10
        `);
        return result.rows;
    }

    const result = await pool.query(`
        SELECT 
            mc.tipo,
            mc.numero_documento,
            mc.numero_nota_fiscal,
            mc.valor_total,
            mc.data_emissao,
            p.razao_social as fornecedor_cliente
        FROM movimentocontas mc
        LEFT JOIN pessoas p ON mc.id_pessoa = p.id
        ORDER BY mc.data_emissao DESC 
        LIMIT 10
    `);
    return result.rows;
}

async function gerarResposta(pergunta, dados) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Baseado nestes dados, responda objetivamente em português: "${pergunta}"\n\nDADOS:\n${JSON.stringify(dados, null, 2)}`;
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        // Fallback quando atingir cota/429 ou outra falha
        console.warn('⚠️ Falha ao gerar resposta com Gemini, usando fallback:', error?.message);
        // Resumo simples a partir dos dados
        const resumo = Array.isArray(dados)
            ? `Dados relevantes (${dados.length} itens). Ex.: ${JSON.stringify(dados[0] || {}, null, 0)}`
            : `Dados: ${JSON.stringify(dados || {}, null, 0)}`;
        return `Não consegui consultar o modelo agora. Baseado nos dados, ${resumo}`;
    }
}

async function ragSimples(pergunta) {
    const dados = await buscarDados(pergunta);
    const resposta = await gerarResposta(pergunta, dados);
    return { pergunta, dados, resposta };
}

async function ragEmbeddings(pergunta) {
    const docs = await EmbeddingSearch.buscar(pergunta);
    const resposta = await gerarResposta(pergunta, docs);
    return { pergunta, dados: docs, resposta };
}

async function indexarDados() {
    const sql = `
        SELECT mc.id, mc.tipo, mc.numero_nota_fiscal, mc.valor_total, mc.data_emissao,
               COALESCE(p.razao_social,'') AS pessoa
        FROM movimentocontas mc
        LEFT JOIN pessoas p ON p.id = mc.id_pessoa
        ORDER BY mc.data_emissao DESC
        LIMIT 200
    `;
    const { rows } = await pool.query(sql);
    const docs = rows.map(r => `Movimento ${r.id} | ${r.tipo} | Nota ${r.numero_nota_fiscal || 'N/A'} | Pessoa ${r.pessoa} | Valor ${r.valor_total} | Emissão ${r.data_emissao}`);
    await EmbeddingSearch.gerarBase(docs);
    return { indexed: docs.length };
}

module.exports = {
    ragSimples,
    ragEmbeddings,
    indexarDados,
    async fazerPergunta(pergunta) {
        return await ragSimples(pergunta);
    },
    async healthCheck() {
        try {
            const r = await pool.query('SELECT 1');
            return { status: 'ok', db: r.rows.length === 1 ? 'ok' : 'unknown' };
        } catch (e) {
            return { status: 'error', error: e.message };
        }
    }
};
