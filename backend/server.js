const express = require('express');
const cors = require('cors');
require('dotenv').config();

const invoiceRoutes = require('./routes/invoiceRoutes');
const pessoasRoutes = require('./routes/pessoasRoutes');
const classificacaoRoutes = require('./routes/classificacaoRoutes');
const agente3Controller = require('./controllers/agente3Controller');
const contasRoutes = require('./routes/contasRoutes');
const { checkAndCreateTables } = require('./database/tableManager');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

// ========================
// Agente3
// ========================
app.post('/api/agente3/perguntar', async (req, res) => {
  try {
    const { pergunta, tipo } = req.body;
    if (!pergunta) return res.status(400).json({ success: false, error: 'Pergunta é obrigatória' });
    const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'];
    const resultado = await agente3Controller.fazerPergunta(pergunta, apiKey, tipo);
    res.json({ success: true, ...resultado });
  } catch (error) {
    console.error('❌ Erro no Agente3:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/agente3/health', async (req, res) => {
  try {
    const health = await agente3Controller.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// ========================
// Health & Root
// ========================
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
      agente3: 'POST /api/agente3/perguntar',
      pessoas: 'CRUD /api/pessoas',
      classificacao: 'CRUD /api/classificacao'
    }
  });
});

// ========================
// Routes
// ========================

app.use('/api/invoices', invoiceRoutes);
app.use('/api/pessoas', pessoasRoutes);
app.use('/api/classificacao', classificacaoRoutes);
app.use('/api/contas', contasRoutes);

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
