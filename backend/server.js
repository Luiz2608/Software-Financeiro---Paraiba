const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const invoiceRoutes = require('./routes/invoiceRoutes');

const { checkAndCreateTables } = require('./database/tableManager');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

// ==================================================
// AGENTE3 - ROTAS SIMPLIFICADAS
// ==================================================

const agente3Controller = require('./controllers/agente3Controller');

// Rota principal para perguntas
app.post('/api/agente3/perguntar', async (req, res) => {
    try {
        const { pergunta } = req.body;

        if (!pergunta) {
            return res.status(400).json({ 
                success: false,
                error: 'Pergunta é obrigatória' 
            });
        }

        console.log('🤖 Agente3 - Nova pergunta:', pergunta);

        const resultado = await agente3Controller.fazerPergunta(pergunta);
        
        res.json(resultado);

    } catch (error) {
        console.error('❌ Erro no Agente3:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check do Agente3
app.get('/api/agente3/health', async (req, res) => {
    try {
        const health = await agente3Controller.healthCheck();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

console.log('✅ Agente3 - Rotas carregadas');

// ==================================================
// ROTAS EXISTENTES DO SEU SISTEMA
// ==================================================

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    service: 'PDF Processor Backend',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'PDF Processor API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      upload: 'POST /api/invoices/process',
      agente3: 'POST /api/agente3/perguntar'
    }
  });
});

app.use('/api/invoices', invoiceRoutes);

console.log('🔧 === CONFIGURAÇÕES ===');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', PORT);

async function startServer() {
  try {
    console.log('🔧 Verificando e criando tabelas...');
    
    await checkAndCreateTables();
    
    console.log('✅ Tabelas verificadas/criadas com sucesso');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
      console.log(`🤖 Agente3: http://localhost:${PORT}/api/agente3/perguntar`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar o servidor:', error);
    process.exit(1);
  }
}

startServer();