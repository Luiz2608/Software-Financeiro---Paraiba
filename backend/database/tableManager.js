require('dotenv').config();
const { Client } = require('pg');

function resolveHost() {
  const envHost = process.env.DB_HOST || 'localhost';
  // Fallback para ambiente local quando DB_HOST=postgres não resolve
  if (envHost === 'postgres') {
    const isDocker = process.env.DOCKER === 'true' || process.env.CONTAINER === 'true';
    if (!isDocker) return 'localhost';
  }
  return envHost;
}

async function checkAndCreateTables() {
  const client = process.env.DATABASE_URL
    ? new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Client({
        user: process.env.DB_USER || 'postgres',
        host: resolveHost(),
        database: process.env.DB_NAME || 'contas_app',
        password: process.env.DB_PASSWORD || 'postgres',
        port: process.env.DB_PORT || 5432,
        ssl: (process.env.DB_SSL === 'true' || process.env.RENDER === 'true') ? { rejectUnauthorized: false } : undefined,
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
        await verifyTableStructure(client, table.name);
      }
    }

    await checkAndFixColumns(client);
    
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
    console.error('Erro ao verificar/criar tabelas:', error);
    throw error;
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
            NUMERO_NOTA_FISCAL VARCHAR(50), -- Coluna alternativa para compatibilidade
            DATA_EMISSAO DATE NOT NULL,
            VALOR_TOTAL DECIMAL(15,2) NOT NULL,
            OBSERVACAO TEXT,
            DATA_CADASTRO TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;
        break;
        
      case 'PARCELACONTAS':
        createTableSQL = `
          CREATE TABLE PARCELACONTAS (
            ID SERIAL PRIMARY KEY,
            ID_MOVIMENTO INTEGER REFERENCES MOVIMENTOCONTAS(ID),
            IDENTIFICACAO VARCHAR(100), -- Adicionado para compatibilidade
            NUMERO_PARCELA INTEGER NOT NULL,
            DATA_VENCIMENTO DATE NOT NULL,
            VALOR_PARCELA DECIMAL(15,2) NOT NULL, -- Nome corrigido
            SITUACAO VARCHAR(20) DEFAULT 'ABERTA', -- Nome corrigido
            DATA_PAGAMENTO DATE,
            VALOR_PAGO DECIMAL(15,2),
            DATA_CADASTRO TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Adicionado
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
            ATIVO BOOLEAN DEFAULT TRUE,
            DATA_CADASTRO TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;
        break;
        
      case 'MOVIMENTO_CLASSIFICACAO':
        createTableSQL = `
          CREATE TABLE MOVIMENTO_CLASSIFICACAO (
            ID SERIAL PRIMARY KEY,
            ID_MOVIMENTO INTEGER REFERENCES MOVIMENTOCONTAS(ID),
            ID_CLASSIFICACAO INTEGER REFERENCES CLASSIFICACAO(ID),
            VALOR DECIMAL(15,2) NOT NULL DEFAULT 0,
            DATA_CADASTRO TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Adicionado
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
    throw error;
  }
}

async function verifyTableStructure(client, tableName) {
  try {
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName.toLowerCase()]);
    
    console.log(`   Estrutura da tabela ${tableName}:`);
    columns.rows.forEach(col => {
      console.log(`     - ${col.column_name} (${col.data_type}, ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
  } catch (error) {
    console.error(`Erro ao verificar estrutura da tabela ${tableName}:`, error);
  }
}

async function checkAndFixColumns(client) {
  console.log('\n🔧 Verificando e corrigindo colunas...');
  
  await addColumnIfNotExists(client, 'PARCELACONTAS', 'IDENTIFICACAO', 'VARCHAR(100)');
  await addColumnIfNotExists(client, 'PARCELACONTAS', 'DATA_CADASTRO', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  
  await renameColumnIfExists(client, 'PARCELACONTAS', 'VALOR', 'VALOR_PARCELA');
  await renameColumnIfExists(client, 'PARCELACONTAS', 'STATUS', 'SITUACAO');
  
  await addColumnIfNotExists(client, 'MOVIMENTOCONTAS', 'NUMERO_NOTA_FISCAL', 'VARCHAR(50)');
  await addColumnIfNotExists(client, 'MOVIMENTOCONTAS', 'ATIVO', 'BOOLEAN DEFAULT TRUE');
  
  await addColumnIfNotExists(client, 'PARCELACONTAS', 'ATIVO', 'BOOLEAN DEFAULT TRUE');
  await addColumnIfNotExists(client, 'MOVIMENTO_CLASSIFICACAO', 'DATA_CADASTRO', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
}

async function addColumnIfNotExists(client, tableName, columnName, columnDefinition) {
  try {
    const checkColumn = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND column_name = $2
    `;
    
    const result = await client.query(checkColumn, [tableName.toLowerCase(), columnName.toLowerCase()]);
    
    if (result.rows.length === 0) {
      console.log(`❌ Coluna ${columnName} não encontrada em ${tableName}. Adicionando...`);
      
      const addColumn = `
        ALTER TABLE ${tableName.toLowerCase()} 
        ADD COLUMN ${columnName} ${columnDefinition}
      `;
      
      await client.query(addColumn);
      console.log(`✅ Coluna ${columnName} adicionada à tabela ${tableName}`);
    } else {
      console.log(`✅ Coluna ${columnName} já existe em ${tableName}`);
    }
  } catch (error) {
    console.error(`Erro ao verificar/corrigir coluna ${columnName} em ${tableName}:`, error);
  }
}

async function renameColumnIfExists(client, tableName, oldColumnName, newColumnName) {
  try {
    const checkOldColumn = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND column_name = $2
    `;
    
    const checkNewColumn = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND column_name = $2
    `;
    
    const oldColumnExists = await client.query(checkOldColumn, [tableName.toLowerCase(), oldColumnName.toLowerCase()]);
    const newColumnExists = await client.query(checkNewColumn, [tableName.toLowerCase(), newColumnName.toLowerCase()]);
    
    if (oldColumnExists.rows.length > 0 && newColumnExists.rows.length === 0) {
      console.log(`🔄 Renomeando coluna ${oldColumnName} para ${newColumnName} em ${tableName}...`);
      
      const renameColumn = `
        ALTER TABLE ${tableName.toLowerCase()} 
        RENAME COLUMN ${oldColumnName} TO ${newColumnName}
      `;
      
      await client.query(renameColumn);
      console.log(`✅ Coluna ${oldColumnName} renomeada para ${newColumnName} em ${tableName}`);
    }
  } catch (error) {
    console.error(`Erro ao renomear coluna ${oldColumnName} em ${tableName}:`, error);
  }
}

module.exports = {
  checkAndCreateTables
};
