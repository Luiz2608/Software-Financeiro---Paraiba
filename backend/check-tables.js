require('dotenv').config();
const { Client } = require('pg');

async function checkAndCreateTables() {
  const client = new Client({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'contas_app',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao PostgreSQL');
    
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const existingTables = tables.rows.map(row => row.table_name.toLowerCase());
    
    const requiredTables = [
      { name: 'PESSOAS', description: 'Tabela de pessoas (fornecedores/faturados)' },
      { name: 'MOVIMENTOCONTAS', description: 'Tabela de movimentos contábeis' },
      { name: 'PARCELACONTAS', description: 'Tabela de parcelas' },
      { name: 'CLASSIFICACAO', description: 'Tabela de classificações' },
      { name: 'MOVIMENTO_CLASSIFICACAO', description: 'Tabela de vínculo' }
    ];
    
    for (const table of requiredTables) {
      if (!existingTables.includes(table.name.toLowerCase())) {
        console.log(`❌ Tabela ${table.name} NÃO ENCONTRADA - ${table.description}`);
        await createTable(client, table.name);
      } else {
        console.log(`✅ Tabela ${table.name} encontrada`);
      }
    }
    
    const updatedTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('\n📊 Tabelas no banco de dados:');
    updatedTables.rows.forEach(table => {
      console.log(`   ✅ ${table.table_name}`);
    });
    
    await client.end();
  } catch (error) {
    console.error('Erro:', error);
  }
}

async function createTable(client, tableName) {
  try {
    let createTableSQL = '';
    
    switch(tableName) {
      case 'PESSOAS':
        createTableSQL = `
          CREATE TABLE PESSOAS (
            ID SERIAL PRIMARY KEY,
            TIPO VARCHAR(20) NOT NULL,
            RAZAO_SOCIAL VARCHAR(255) NOT NULL,
            NOME_FANTASIA VARCHAR(255),
            CNPJ_CPF VARCHAR(20) UNIQUE,
            ENDERECO VARCHAR(255),
            TELEFONE VARCHAR(20),
            EMAIL VARCHAR(100),
            ATIVO BOOLEAN DEFAULT TRUE,
            DATA_CADASTRO TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;
        break;
        
      case 'MOVIMENTOCONTAS':
        createTableSQL = `
          CREATE TABLE MOVIMENTOCONTAS (
            ID SERIAL PRIMARY KEY,
            TIPO VARCHAR(20) NOT NULL,
            ID_PESSOA INTEGER REFERENCES PESSOAS(ID),
            NUMERO_DOCUMENTO VARCHAR(50),
            DATA_EMISSAO DATE NOT NULL,
            DATA_VENCIMENTO DATE,
            VALOR_TOTAL DECIMAL(15,2) NOT NULL,
            OBSERVACAO TEXT,
            STATUS VARCHAR(20) DEFAULT 'PENDENTE',
            DATA_CADASTRO TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;
        break;
        
      case 'PARCELACONTAS':
        createTableSQL = `
          CREATE TABLE PARCELACONTAS (
            ID SERIAL PRIMARY KEY,
            ID_MOVIMENTO INTEGER REFERENCES MOVIMENTOCONTAS(ID),
            NUMERO_PARCELA INTEGER NOT NULL,
            DATA_VENCIMENTO DATE NOT NULL,
            VALOR DECIMAL(15,2) NOT NULL,
            STATUS VARCHAR(20) DEFAULT 'PENDENTE',
            DATA_PAGAMENTO DATE,
            VALOR_PAGO DECIMAL(15,2)
          )
        `;
        break;
        
      case 'CLASSIFICACAO':
        createTableSQL = `
          CREATE TABLE CLASSIFICACAO (
            ID SERIAL PRIMARY KEY,
            NOME VARCHAR(100) NOT NULL,
            DESCRICAO TEXT,
            TIPO VARCHAR(20) NOT NULL,
            ATIVO BOOLEAN DEFAULT TRUE
          )
        `;
        break;
        
      case 'MOVIMENTO_CLASSIFICACAO':
        createTableSQL = `
          CREATE TABLE MOVIMENTO_CLASSIFICACAO (
            ID SERIAL PRIMARY KEY,
            ID_MOVIMENTO INTEGER REFERENCES MOVIMENTOCONTAS(ID),
            ID_CLASSIFICACAO INTEGER REFERENCES CLASSIFICACAO(ID),
            VALOR DECIMAL(15,2) NOT NULL
          )
        `;
        break;
        
      default:
        console.log(`Não há definição para criar a tabela ${tableName}`);
        return;
    }
    
    await client.query(createTableSQL);
    console.log(`✅ Tabela ${tableName} criada com sucesso!`);
  } catch (error) {
    console.error(`Erro ao criar tabela ${tableName}:`, error);
  }
}

checkAndCreateTables();