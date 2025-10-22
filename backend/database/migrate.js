// database/migrate.js
const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'contas_app',
    password: 'postgres',
    port: 5432,
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao PostgreSQL');
    
    // Criar tabela PESSOAS
    await client.query(`
      CREATE TABLE IF NOT EXISTS PESSOAS (
        ID SERIAL PRIMARY KEY,
        TIPO VARCHAR(20),
        RAZAO_SOCIAL VARCHAR(255),
        CNPJ_CPF VARCHAR(20),
        ATIVO BOOLEAN DEFAULT TRUE,
        DATA_CADASTRO TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabela PESSOAS criada');

    // Criar tabela CLASSIFICACAO
    await client.query(`
      CREATE TABLE IF NOT EXISTS CLASSIFICACAO (
        ID SERIAL PRIMARY KEY,
        TIPO VARCHAR(20),
        DESCRICAO VARCHAR(100),
        ATIVO BOOLEAN DEFAULT TRUE
      );
    `);
    console.log('✅ Tabela CLASSIFICACAO criada');

    // Criar tabela MOVIMENTOCONTAS
    await client.query(`
      CREATE TABLE IF NOT EXISTS MOVIMENTOCONTAS (
        ID SERIAL PRIMARY KEY,
        TIPO VARCHAR(20),
        ID_PESSOA INTEGER,
        NUMERO_NOTA_FISCAL VARCHAR(100),
        DATA_EMISSAO DATE,
        VALOR_TOTAL DECIMAL(15,2),
        OBSERVACAO TEXT,
        ANALISE_AI JSONB,
        DATA_CADASTRO TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabela MOVIMENTOCONTAS criada');

    // Criar tabela PARCELACONTAS
    await client.query(`
      CREATE TABLE IF NOT EXISTS PARCELACONTAS (
        ID SERIAL PRIMARY KEY,
        ID_MOVIMENTO INTEGER,
        IDENTIFICACAO VARCHAR(50),
        NUMERO_PARCELA INTEGER,
        DATA_VENCIMENTO DATE,
        VALOR_PARCELA DECIMAL(15,2),
        SITUACAO VARCHAR(20) DEFAULT 'ABERTA',
        DATA_CADASTRO TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabela PARCELACONTAS criada');

    // Criar tabela MOVIMENTO_CLASSIFICACAO
    await client.query(`
      CREATE TABLE IF NOT EXISTS MOVIMENTO_CLASSIFICACAO (
        ID_MOVIMENTO INTEGER,
        ID_CLASSIFICACAO INTEGER
      );
    `);
    console.log('✅ Tabela MOVIMENTO_CLASSIFICACAO criada');

    // Inserir classificações básicas
    console.log('📝 Inserindo classificações...');
    
    const classificacoes = [
      ['DESPESA', 'INSUMOS_AGRICOLAS'],
      ['DESPESA', 'MANUTENCAO_OPERACAO'],
      ['DESPESA', 'RECURSOS_HUMANOS'],
      ['DESPESA', 'SERVICOS_OPERACIONAIS'],
      ['RECEITA', 'VENDA_PRODUTOS'],
      ['RECEITA', 'SERVICOS_PRESTADOS']
    ];

    for (const [tipo, descricao] of classificacoes) {
      await client.query(
        'INSERT INTO CLASSIFICACAO (TIPO, DESCRICAO, ATIVO) VALUES ($1, $2, TRUE)',
        [tipo, descricao]
      );
      console.log(`✅ Inserido: ${tipo} - ${descricao}`);
    }

    console.log('🎉 Migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
  } finally {
    await client.end();
  }
}

migrate();