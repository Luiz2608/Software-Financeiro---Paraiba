const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pool } = require('pg');

class Agente3Controller {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT,
        });
    }

    async fazerPergunta(pergunta) {
        try {
            console.log('🤖 Agente3 - Processando pergunta:', pergunta);

            // Buscar dados do banco
            const dados = await this.buscarDados(pergunta);
            
            // Gerar resposta com Gemini
            const resposta = await this.gerarResposta(pergunta, dados);

            return {
                success: true,
                pergunta,
                dados: dados,
                resposta
            };

        } catch (error) {
            console.error('❌ Erro no Agente3:', error);
            throw new Error(`Erro: ${error.message}`);
        }
    }

    async buscarDados(pergunta) {
        const perguntaLower = pergunta.toLowerCase();

        if (perguntaLower.includes('total') || perguntaLower.includes('soma')) {
            const result = await this.pool.query(`
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
            const result = await this.pool.query(`
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

        // Query padrão
        const result = await this.pool.query(`
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

    async gerarResposta(pergunta, dados) {
        const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
Baseado nestes dados financeiros, responda: "${pergunta}"

DADOS:
${JSON.stringify(dados, null, 2)}

Responda em português de forma direta:`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    }
}

module.exports = new Agente3Controller();