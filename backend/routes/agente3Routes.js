const express = require('express');
const router = express.Router();
const agente3Controller = require('../controllers/agente3Controller');

// Rota para consulta RAG
router.post('/consulta', async (req, res) => {
    try {
        const { pergunta, tipo = 'simples' } = req.body;

        if (!pergunta) {
            return res.status(400).json({ 
                error: 'Pergunta é obrigatória' 
            });
        }

        let resultado;
        if (tipo === 'simples') {
            resultado = await agente3Controller.ragSimples(pergunta);
        } else if (tipo === 'embeddings') {
            resultado = await agente3Controller.ragEmbeddings(pergunta);
        } else {
            return res.status(400).json({ 
                error: 'Tipo deve ser "simples" ou "embeddings"' 
            });
        }

        res.json({
            success: true,
            ...resultado
        });

    } catch (error) {
        console.error('Erro na rota Agente3:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Rota para reindexar dados (admin)
router.post('/reindexar', async (req, res) => {
    try {
        await agente3Controller.indexarDados();
        res.json({
            success: true,
            message: 'Dados reindexados com sucesso'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;