const { Client } = require('pg');

class DatabaseService {
  constructor() {
    const isDocker = process.env.RUNNING_IN_DOCKER === 'true';
    console.log('Ambiente Docker:', isDocker ? 'Sim' : 'Não');

    if (process.env.DATABASE_URL) {
      console.log('Conectando via DATABASE_URL');
      this.client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
    } else {
      const envHost = process.env.DB_HOST || '127.0.0.1';
      const pgHost = isDocker ? 'postgres' : (envHost === 'postgres' ? '127.0.0.1' : envHost);
      console.log('Conectando ao PostgreSQL em:', pgHost);

      this.client = new Client({
        user: process.env.DB_USER || 'postgres',
        host: pgHost,
        database: process.env.DB_NAME || 'contas_app',
        password: process.env.DB_PASSWORD || 'postgres',
        port: process.env.DB_PORT || 5432,
        ssl: (process.env.DB_SSL === 'true' || process.env.RENDER === 'true') ? { rejectUnauthorized: false } : undefined,
      });
    }

    this.connect();
  }

  async connect() {
    try {
      await this.client.connect();
      console.log('✅ Conectado ao PostgreSQL');
      await this.verificarEstruturaTabelas();
    } catch (error) {
      console.error('❌ Erro ao conectar com PostgreSQL:', error);
    }
  }


  async verificarFornecedor(razaoSocial, cnpj) {
    try {
      const query = `
        SELECT ID, TIPO, RAZAO_SOCIAL, CNPJ_CPF FROM PESSOAS 
        WHERE (UPPER(RAZAO_SOCIAL) = UPPER($1) OR CNPJ_CPF = $2) 
        AND ATIVO = TRUE
        LIMIT 1
      `;
      
      const result = await this.client.query(query, [razaoSocial, cnpj]);
      
      if (result.rows.length > 0) {
        const pessoa = result.rows[0];
        return { 
          existe: true, 
          id: pessoa.id,
          tipo: pessoa.tipo,
          razaoSocial: pessoa.razao_social,
          cnpjCpf: pessoa.cnpj_cpf
        };
      }
      
      return { 
        existe: false, 
        id: null,
        tipo: null,
        razaoSocial: null,
        cnpjCpf: null
      };
    } catch (error) {
      console.error('Erro ao verificar fornecedor:', error);
      return { 
        existe: false, 
        id: null,
        tipo: null,
        razaoSocial: null,
        cnpjCpf: null
      };
    }
  }

  async criarFornecedor(razaoSocial, cnpj) {
    try {
      const verificaExistente = await this.verificarFornecedor(razaoSocial, cnpj);
      
      if (verificaExistente.existe) {
        console.log(`⚠️  CNPJ/CPF ${cnpj} já existe na base como ${verificaExistente.tipo}. ID: ${verificaExistente.id}`);
        
        if (verificaExistente.tipo !== 'FORNECEDOR') {
          console.log(`🔄 Atualizando tipo de ${verificaExistente.tipo} para FORNECEDOR`);
          
          await this.client.query(
            'UPDATE PESSOAS SET TIPO = $1 WHERE ID = $2',
            ['FORNECEDOR', verificaExistente.id]
          );
          
          console.log(`✅ Tipo atualizado para FORNECEDOR para ID: ${verificaExistente.id}`);
        }
        
        return verificaExistente.id;
      }

      const result = await this.client.query(
        'INSERT INTO PESSOAS (TIPO, RAZAO_SOCIAL, CNPJ_CPF, ATIVO, DATA_CADASTRO) VALUES ($1, $2, $3, TRUE, NOW()) RETURNING ID',
        ['FORNECEDOR', razaoSocial, cnpj]
      );
      
      const novoId = Number(result.rows[0].id);
      console.log(`✅ Novo fornecedor criado: ID ${novoId}, CNPJ: ${cnpj}`);
      
      return novoId;
    } catch (error) {
      if (error.message.includes('duplicate key value violates unique constraint')) {
        console.error(`❌ CNPJ/CPF ${cnpj} já existe na base de dados`);
        
        try {
          const recuperaExistente = await this.client.query(
            'SELECT ID FROM PESSOAS WHERE CNPJ_CPF = $1 LIMIT 1',
            [cnpj]
          );
          
          if (recuperaExistente.rows.length > 0) {
            const idExistente = Number(recuperaExistente.rows[0].id);
            console.log(`🔍 Recuperado ID existente: ${idExistente} para CNPJ: ${cnpj}`);
            return idExistente;
          }
        } catch (recuperaError) {
          console.error('Erro ao recuperar ID existente:', recuperaError);
        }
        
        throw new Error(`CNPJ/CPF ${cnpj} já está cadastrado no sistema`);
      }
      
      throw new Error('Erro ao criar fornecedor: ' + error.message);
    }
  }

  async criarMovimentoConta(movimentoData) {
    try {
      const colsResult = await this.client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'movimentocontas'
      `);
      const colNames = colsResult.rows.map(r => r.column_name.toLowerCase());
      const hasNumeroNota = colNames.includes('numero_nota_fiscal');
      const hasNumeroDocumento = colNames.includes('numero_documento');
      const docCol = hasNumeroNota ? 'NUMERO_NOTA_FISCAL' : (hasNumeroDocumento ? 'NUMERO_DOCUMENTO' : null);

      if (!docCol) {
        const result = await this.client.query(
          `INSERT INTO MOVIMENTOCONTAS 
           (TIPO, ID_PESSOA, DATA_EMISSAO, VALOR_TOTAL, OBSERVACAO, DATA_CADASTRO) 
           VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING ID`,
          [
            movimentoData.tipo,
            movimentoData.idPessoa,
            movimentoData.dataEmissao,
            movimentoData.valorTotal,
            movimentoData.observacao || null
          ]
        );
        return Number(result.rows[0].id);
      }

      const numeroDocumento = (
        movimentoData.numeroNotaFiscal ??
        movimentoData.numeroDocumento ??
        movimentoData.numeroDocumentoFiscal ??
        null
      );

      const insertQuery = `
        INSERT INTO MOVIMENTOCONTAS 
         (TIPO, ID_PESSOA, ${docCol}, DATA_EMISSAO, VALOR_TOTAL, OBSERVACAO, DATA_CADASTRO) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING ID`;

      const result = await this.client.query(insertQuery, [
        movimentoData.tipo,
        movimentoData.idPessoa,
        numeroDocumento,
        movimentoData.dataEmissao,
        movimentoData.valorTotal,
        movimentoData.observacao || null
      ]);
      
      return Number(result.rows[0].id);
    } catch (error) {
      throw new Error('Erro ao criar movimento: ' + error.message);
    }
  }

  async criarParcelas(idMovimento, parcelas) {
    try {
      console.log('📦 Criando parcelas para movimento:', idMovimento);
      console.log('📦 Dados das parcelas recebidas:', JSON.stringify(parcelas, null, 2));
      
      if (!parcelas || parcelas.length === 0) {
        const parcelaUnica = {
          numeroParcela: 1,
          dataVencimento: new Date().toISOString().split('T')[0],
          valor: 0
        };
        parcelas = [parcelaUnica];
      }

      const parcelasIds = [];
      let parcelaIndex = 1;
      
      for (const parcela of parcelas) {
        const numeroParcela = parcela.numeroParcela || parcelaIndex;
        const dataVencimento = parcela.dataVencimento || new Date().toISOString().split('T')[0];
        const valorParcela = parcela.valor || parcela.valorParcela || 0;
        
        const identificacao = `${idMovimento}_${numeroParcela}`;
        const dataVencimentoFormatada = this.formatarDataParaPostgres(dataVencimento);
        
        if (numeroParcela === null || numeroParcela === undefined) {
          console.error('❌ ERRO: numeroParcela é null/undefined:', parcela);
          throw new Error('numeroParcela não pode ser null ou undefined');
        }

        console.log(`📝 Inserindo parcela:`, {
          idMovimento,
          identificacao,
          numeroParcela,
          dataVencimento: dataVencimentoFormatada,
          valorParcela,
          situacao: 'ABERTA'
        });

        const result = await this.client.query(
          `INSERT INTO PARCELACONTAS 
           (ID_MOVIMENTO, IDENTIFICACAO, NUMERO_PARCELA, DATA_VENCIMENTO, VALOR_PARCELA, SITUACAO, DATA_CADASTRO) 
           VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING ID`,
          [
            idMovimento,
            identificacao,
            numeroParcela,
            dataVencimentoFormatada,
            valorParcela,
            'ABERTA'
          ]
        );
        
        const parcelaId = Number(result.rows[0].id);
        parcelasIds.push(parcelaId);
        console.log(`✅ Parcela ${numeroParcela} criada (ID: ${parcelaId}): ${dataVencimentoFormatada}`);
        
        parcelaIndex++;
      }
      
      return parcelasIds;
    } catch (error) {
      console.error('❌ ERRO DETALHADO ao criar parcelas:', {
        idMovimento,
        parcelasRecebidas: parcelas,
        erro: error.message
      });
      throw new Error('Erro ao criar parcelas: ' + error.message);
    }
  }

  async verificarFaturado(nomeCompleto, cpf) {
    try {
      const query = `
        SELECT ID, TIPO, RAZAO_SOCIAL, CNPJ_CPF FROM PESSOAS 
        WHERE (UPPER(RAZAO_SOCIAL) = UPPER($1) OR CNPJ_CPF = $2) 
        AND ATIVO = TRUE
        LIMIT 1
      `;
      
      const result = await this.client.query(query, [nomeCompleto, cpf]);
      
      if (result.rows.length > 0) {
        const pessoa = result.rows[0];
        return { 
          existe: true, 
          id: pessoa.id,
          tipo: pessoa.tipo,
          razaoSocial: pessoa.razao_social,
          cnpjCpf: pessoa.cnpj_cpf
        };
      }
      
      return { 
        existe: false, 
        id: null,
        tipo: null,
        razaoSocial: null,
        cnpjCpf: null
      };
    } catch (error) {
      console.error('Erro ao verificar faturado:', error);
      return { 
        existe: false, 
        id: null,
        tipo: null,
        razaoSocial: null,
        cnpjCpf: null
      };
    }
  }

  async criarFaturado(nomeCompleto, cpf) {
    try {
      const verificaExistente = await this.verificarFaturado(nomeCompleto, cpf);
      
      if (verificaExistente.existe) {
        console.log(`⚠️  CPF/CNPJ ${cpf} já existe na base como ${verificaExistente.tipo}. ID: ${verificaExistente.id}`);
        
        if (verificaExistente.tipo !== 'FATURADO') {
          console.log(`🔄 Atualizando tipo de ${verificaExistente.tipo} para FATURADO`);
          
          await this.client.query(
            'UPDATE PESSOAS SET TIPO = $1 WHERE ID = $2',
            ['FATURADO', verificaExistente.id]
          );
          
          console.log(`✅ Tipo atualizado para FATURADO para ID: ${verificaExistente.id}`);
        }
        
        return verificaExistente.id;
      }

      const result = await this.client.query(
        'INSERT INTO PESSOAS (TIPO, RAZAO_SOCIAL, CNPJ_CPF, ATIVO, DATA_CADASTRO) VALUES ($1, $2, $3, TRUE, NOW()) RETURNING ID',
        ['FATURADO', nomeCompleto, cpf]
      );
      
      const novoId = Number(result.rows[0].id);
      console.log(`✅ Novo faturado criado: ID ${novoId}, CPF: ${cpf}`);
      
      return novoId;
    } catch (error) {
      if (error.message.includes('duplicate key value violates unique constraint')) {
        console.error(`❌ CPF/CNPJ ${cpf} já existe na base de dados`);
        
        try {
          const recuperaExistente = await this.client.query(
            'SELECT ID FROM PESSOAS WHERE CNPJ_CPF = $1 LIMIT 1',
            [cpf]
          );
          
          if (recuperaExistente.rows.length > 0) {
            const idExistente = Number(recuperaExistente.rows[0].id);
            console.log(`🔍 Recuperado ID existente: ${idExistente} para CPF: ${cpf}`);
            return idExistente;
          }
        } catch (recuperaError) {
          console.error('Erro ao recuperar ID existente:', recuperaError);
        }
        
        throw new Error(`CPF/CNPJ ${cpf} já está cadastrado no sistema`);
      }
      
      throw new Error('Erro ao criar faturado: ' + error.message);
    }
  }

  async verificarClassificacao(tipo, descricao) {
    try {
      const query = `
        SELECT ID FROM CLASSIFICACAO 
        WHERE TIPO = $1 
        AND UPPER(DESCRICAO) = UPPER($2) 
        AND ATIVO = TRUE
        LIMIT 1
      `;
      
      const result = await this.client.query(query, [tipo, descricao]);
      
      return { 
        existe: result.rows.length > 0, 
        id: result.rows[0]?.id || null
      };
    } catch (error) {
      console.error('Erro ao verificar classificação:', error);
      return { existe: false, id: null };
    }
  }

  async criarClassificacao(tipo, descricao) {
    try {
      const safeDescricao = (descricao && descricao.trim()) ? descricao.trim() : 'NAO_CLASSIFICADA';

      const checkNomeColumn = `
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'classificacao' 
          AND column_name = 'nome'
        LIMIT 1
      `;
      const nomeColumnResult = await this.client.query(checkNomeColumn);
      const hasNomeColumn = nomeColumnResult.rows.length > 0;

      let insertQuery;
      let params;
      if (hasNomeColumn) {
        insertQuery = 'INSERT INTO CLASSIFICACAO (NOME, TIPO, DESCRICAO, ATIVO, DATA_CADASTRO) VALUES ($1, $2, $3, TRUE, NOW()) RETURNING ID';
        params = [safeDescricao, tipo, safeDescricao];
      } else {
        insertQuery = 'INSERT INTO CLASSIFICACAO (TIPO, DESCRICAO, ATIVO, DATA_CADASTRO) VALUES ($1, $2, TRUE, NOW()) RETURNING ID';
        params = [tipo, safeDescricao];
      }

      const result = await this.client.query(insertQuery, params);
      return Number(result.rows[0].id);
    } catch (error) {
      throw new Error('Erro ao criar classificação: ' + error.message);
    }
  }

  async vincularClassificacao(idMovimento, idClassificacao, valor = 0) {
    try {
      const tableInfo = await this.client.query(`
        SELECT column_name, is_nullable, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'movimento_classificacao'
        ORDER BY ordinal_position
      `);
      
      const columns = tableInfo.rows.map(row => row.column_name);
      const hasValorColumn = columns.includes('valor');
      
      const checkQuery = `
        SELECT 1 FROM MOVIMENTO_CLASSIFICACAO 
        WHERE ID_MOVIMENTO = $1 AND ID_CLASSIFICACAO = $2
        LIMIT 1
      `;
      
      const checkResult = await this.client.query(checkQuery, [idMovimento, idClassificacao]);
      
      if (checkResult.rows.length === 0) {
        if (hasValorColumn) {
          await this.client.query(
            'INSERT INTO MOVIMENTO_CLASSIFICACAO (ID_MOVIMENTO, ID_CLASSIFICACAO, VALOR) VALUES ($1, $2, $3)',
            [idMovimento, idClassificacao, valor]
          );
          console.log(`✅ Classificação ${idClassificacao} vinculada ao movimento ${idMovimento} com valor ${valor}`);
        } else {
          await this.client.query(
            'INSERT INTO MOVIMENTO_CLASSIFICACAO (ID_MOVIMENTO, ID_CLASSIFICACAO) VALUES ($1, $2)',
            [idMovimento, idClassificacao]
          );
          console.log(`✅ Classificação ${idClassificacao} vinculada ao movimento ${idMovimento}`);
        }
      } else {
        console.log(`ℹ️ Classificação ${idClassificacao} já estava vinculada ao movimento ${idMovimento}`);
      }
      
      return true;
    } catch (error) {
      throw new Error('Erro ao vincular classificação: ' + error.message);
    }
  }

  formatarDataParaPostgres(dataString) {
    if (!dataString) {
      return new Date().toISOString().split('T')[0];
    }
    
    try {
      if (dataString.includes('/')) {
        const [dia, mes, ano] = dataString.split('/');
        const dataFormatada = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
        
        const dataValida = new Date(dataFormatada);
        if (isNaN(dataValida.getTime())) {
          throw new Error('Data inválida após conversão');
        }
        
        return dataFormatada;
      } else if (dataString.includes('-')) {
        const dataValida = new Date(dataString);
        if (isNaN(dataValida.getTime())) {
          throw new Error('Data inválida');
        }
        return dataString;
      } else {
        throw new Error('Formato de data não reconhecido');
      }
    } catch (error) {
      console.warn(`❌ Erro ao formatar data "${dataString}": ${error.message}, usando data atual`);
      return new Date().toISOString().split('T')[0];
    }
  }

  async verificarEstruturaTabelas() {
    try {
      const tabelas = [
        { nome: 'PESSOAS', descricao: 'Tabela de pessoas (fornecedores/faturados)' },
        { nome: 'MOVIMENTOCONTAS', descricao: 'Tabela de movimentos contábeis' },
        { nome: 'PARCELACONTAS', descricao: 'Tabela de parcelas' },
        { nome: 'CLASSIFICACAO', descricao: 'Tabela de classificações' },
        { nome: 'MOVIMENTO_CLASSIFICACAO', descricao: 'Tabela de vínculos movimento-classificação' }
      ];
      
      console.log('🔍 Verificando estrutura do banco de dados...');
      
      for (const tabela of tabelas) {
        try {
          const result = await this.client.query(
            `SELECT EXISTS (
               SELECT FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = $1
             ) as exists`,
            [tabela.nome.toLowerCase()]
          );
          
          const existe = result.rows[0].exists;
          
          if (existe) {
            console.log(`✅ Tabela ${tabela.nome} - ${tabela.descricao}`);
            
            if (tabela.nome === 'PARCELACONTAS') {
              const columnsResult = await this.client.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public' 
                AND table_name = 'parcelacontas'
                ORDER BY ordinal_position
              `);
              
              console.log(`   Colunas de PARCELACONTAS:`);
              columnsResult.rows.forEach(col => {
                console.log(`   - ${col.column_name} (${col.data_type}, ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
              });
            }
          } else {
            console.warn(`❌ Tabela ${tabela.nome} NÃO ENCONTRADA - ${tabela.descricao}`);
          }
        } catch (err) {
          console.error(`💥 Erro ao verificar tabela ${tabela.nome}:`, err.message);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao verificar estrutura:', error);
      return false;
    }
  }

  async obterDetalhesPessoa(id) {
    try {
      const result = await this.client.query(
        'SELECT ID, TIPO, RAZAO_SOCIAL, CNPJ_CPF, DATA_CADASTRO FROM PESSOAS WHERE ID = $1',
        [id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erro ao obter detalhes da pessoa:', error);
      return null;
    }
  }

  async obterDetalhesMovimento(id) {
    try {
      const result = await this.client.query(
        `SELECT mc.*, p.RAZAO_SOCIAL as nome_fornecedor 
         FROM MOVIMENTOCONTAS mc
         LEFT JOIN PESSOAS p ON mc.ID_PESSOA = p.ID
         WHERE mc.ID = $1`,
        [id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erro ao obter detalhes do movimento:', error);
      return null;
    }
  }

  async obterParcelasMovimento(idMovimento) {
    try {
      const result = await this.client.query(
        'SELECT * FROM PARCELACONTAS WHERE ID_MOVIMENTO = $1 ORDER BY NUMERO_PARCELA',
        [idMovimento]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Erro ao obter parcelas do movimento:', error);
      return [];
    }
  }

  async obterClassificacoesMovimento(idMovimento) {
    try {
      const result = await this.client.query(
        `SELECT c.* 
         FROM CLASSIFICACAO c
         INNER JOIN MOVIMENTO_CLASSIFICACAO mc ON c.ID = mc.ID_CLASSIFICACAO
         WHERE mc.ID_MOVIMENTO = $1`,
        [idMovimento]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Erro ao obter classificações do movimento:', error);
      return [];
    }
  }

  async disconnect() {
    try {
      await this.client.end();
      console.log('🔌 Conexão com PostgreSQL fechada');
    } catch (error) {
      console.error('Erro ao fechar conexão:', error);
    }
  }

  async healthCheck() {
    try {
      const result = await this.client.query('SELECT NOW() as current_time, version() as version');
      return {
        status: 'healthy',
        database: 'connected',
        current_time: result.rows[0].current_time,
        version: result.rows[0].version
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message
      };
    }
  }
}

module.exports = new DatabaseService();
