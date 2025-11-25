const express = require('express');
const cors = require('cors');
require('dotenv').config();

const invoiceRoutes = require('./routes/invoiceRoutes');
const pessoasRoutes = require('./routes/pessoasRoutes');
const classificacaoRoutes = require('./routes/classificacaoRoutes');
const { checkAndCreateTables } = require('./database/tableManager');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

// Health
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'PDF Processor Backend', timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || 'development' });
});

// Root
app.get('/', (req, res) => {
  res.json({
    message: 'PDF Processor API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      upload: 'POST /api/invoices/process',
      pessoas: 'CRUD /api/pessoas',
      classificacao: 'CRUD /api/classificacao'
    }
  });
});

// Routes
app.use('/api/invoices', invoiceRoutes);
app.use('/api/pessoas', pessoasRoutes);
app.use('/api/classificacao', classificacaoRoutes);

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
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar o servidor:', error);
    process.exit(1);
  }
}

startServer();