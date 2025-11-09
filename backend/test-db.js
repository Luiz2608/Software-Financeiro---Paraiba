const { Client } = require('pg');

async function testConnection() {
  console.log('🔍 Testando conexão com PostgreSQL...');
  
  const client = new Client({
    user: 'postgres',
    host: 'postgres',
    database: 'contas_app',
    password: '1234',
    port: 5432,
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao PostgreSQL com sucesso!');
    
    const result = await client.query('SELECT version()');
    console.log('📊 Versão do PostgreSQL:', result.rows[0].version);
    
    await client.end();
    console.log('✅ Teste concluído!');
  } catch (error) {
    console.error('❌ Erro na conexão:', error.message);
    console.log('💡 Dica: Verifique se o Docker está rodando');
  }
}

testConnection();