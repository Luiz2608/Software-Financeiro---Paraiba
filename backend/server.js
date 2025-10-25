const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const invoiceRoutes = require('./routes/invoiceRoutes');

// Importar a função de verificação e criação de tabelas
const { checkAndCreateTables } = require('./database/tableManager');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

// Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    service: 'PDF Processor Backend',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root Route
app.get('/', (req, res) => {
  res.json({
    message: 'PDF Processor API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      upload: 'POST /api/invoices/process'
    }
  });
});

// Routes
app.use('/api/invoices', invoiceRoutes);

// DEBUG: Verificar configurações de banco
console.log('🔧 === DEBUG CONFIGURAÇÕES BANCO ===');
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);

// Iniciar o servidor após verificar e criar as tabelas
async function startServer() {
  try {
    console.log('🔧 Verificando e criando tabelas...');
    
    // Verificar e criar tabelas necessárias
    await checkAndCreateTables();
    
    console.log('✅ Tabelas verificadas/criadas com sucesso');
    
    // Iniciar o servidor
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
      console.log(`📊 API: http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar o servidor:', error);
    process.exit(1);
  }
}

startServer();