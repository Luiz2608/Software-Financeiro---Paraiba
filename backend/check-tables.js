// check-tables.js
const { Client } = require('pg');

async function checkTables() {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'contas_app',
    password: 'postgres',
    port: 5432,
  });

  try {
    await client.connect();
    
    // Verificar tabelas
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('📊 Tabelas criadas:');
    tables.rows.forEach(table => {
      console.log(`   ✅ ${table.table_name}`);
    });
    
    await client.end();
  } catch (error) {
    console.error('Erro:', error);
  }
}

checkTables();