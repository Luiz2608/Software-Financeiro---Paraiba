// services/databaseService.js - VERSÃO ATUALIZADA E CORRIGIDA
const { Client } = require('pg');

class DatabaseService {
  constructor() {
    this.client = new Client({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'contas_app',
      password: process.env.DB_PASSWORD || 'postgres',
      port: process.env.DB_PORT || 5432,
    });
    
    this.connect();
  }

  async connect() {
    try {
      await this.client.connect();
      console.log('✅ Conectado ao PostgreSQL');
      // Verificar estrutura ao conectar
      await this.verificarEstruturaTabelas();
    } catch (error) {
      console.error('❌ Erro ao conectar com PostgreSQL:', error);
    }
  }

  // ========== FUNÇÕES PRINCIPAIS CORRIGIDAS ==========

  async verificarFornecedor(razaoSocial, cnpj) {
    try {
      const query = `
        SELECT ID FROM PESSOAS 
        WHERE TIPO = $1 
        AND (UPPER(RAZAO_SOCIAL) = UPPER($2) OR CNPJ_CPF = $3) 
        AND ATIVO = TRUE
        LIMIT 1
      `;
      
      const result = await this.client.query(query, ['FORNECEDOR', razaoSocial, cnpj]);
      
      return { 
        existe: result.rows.length > 0, 
        id: result.rows[0]?.id || null
      };
    } catch (error) {
      console.error('Erro ao verificar fornecedor:', error);
      return { existe: false, id: null };
    }
  }

  async criarFornecedor(razaoSocial, cnpj) {
    try {
      const result = await this.client.query(
        'INSERT INTO PESSOAS (TIPO, RAZAO_SOCIAL, CNPJ_CPF, ATIVO, DATA_CADASTRO) VALUES ($1, $2, $3, TRUE, NOW()) RETURNING ID',
        ['FORNECEDOR', razaoSocial, cnpj]
      );
      
      // CORREÇÃO: Garantir que retorna número (não string)
      return Number(result.rows[0].id);
    } catch (error) {
      throw new Error('Erro ao criar fornecedor: ' + error.message);
    }
  }

  async criarMovimentoConta(movimentoData) {
    try {
      const result = await this.client.query(
        `INSERT INTO MOVIMENTOCONTAS 
         (TIPO, ID_PESSOA, NUMERO_NOTA_FISCAL, DATA_EMISSAO, VALOR_TOTAL, OBSERVACAO, DATA_CADASTRO) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING ID`,
        [
          movimentoData.tipo,
          movimentoData.idPessoa,
          movimentoData.numeroNotaFiscal,
          movimentoData.dataEmissao,
          movimentoData.valorTotal,
          movimentoData.observacao
        ]
      );
      
      // CORREÇÃO: Garantir que retorna número (não string)
      return Number(result.rows[0].id);
    } catch (error) {
      throw new Error('Erro ao criar movimento: ' + error.message);
    }
  }

  async criarParcelas(idMovimento, parcelas) {
    try {
      // CORREÇÃO: Se não houver parcelas, criar uma única parcela
      if (!parcelas || parcelas.length === 0) {
        const parcelaUnica = {
          numeroParcela: 1,
          dataVencimento: new Date().toISOString().split('T')[0],
          valor: 0
        };
        parcelas = [parcelaUnica];
      }

      const parcelasIds = [];
      
      for (const parcela of parcelas) {
        const identificacao = `${idMovimento}_${parcela.numeroParcela}`;
        
        // CORREÇÃO: Função dedicada para formatação de data
        const dataVencimentoFormatada = this.formatarDataParaPostgres(parcela.dataVencimento);
        
        const result = await this.client.query(
          `INSERT INTO PARCELACONTAS 
           (ID_MOVIMENTO, IDENTIFICACAO, NUMERO_PARCELA, DATA_VENCIMENTO, VALOR_PARCELA, SITUACAO, DATA_CADASTRO) 
           VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING ID`,
          [
            idMovimento,
            identificacao,
            parcela.numeroParcela,
            dataVencimentoFormatada,
            parcela.valor,
            'ABERTA'
          ]
        );
        
        parcelasIds.push(Number(result.rows[0].id));
        console.log(`✅ Parcela ${parcela.numeroParcela} criada: ${dataVencimentoFormatada}`);
      }
      
      return parcelasIds;
    } catch (error) {
      throw new Error('Erro ao criar parcelas: ' + error.message);
    }
  }

  // ========== FUNÇÕES PARA FATURADO ==========

  async verificarFaturado(nomeCompleto, cpf) {
    try {
      const query = `
        SELECT ID FROM PESSOAS 
        WHERE TIPO = $1 
        AND (UPPER(RAZAO_SOCIAL) = UPPER($2) OR CNPJ_CPF = $3) 
        AND ATIVO = TRUE
        LIMIT 1
      `;
      
      const result = await this.client.query(query, ['FATURADO', nomeCompleto, cpf]);
      
      return { 
        existe: result.rows.length > 0, 
        id: result.rows[0]?.id || null
      };
    } catch (error) {
      console.error('Erro ao verificar faturado:', error);
      return { existe: false, id: null };
    }
  }

  async criarFaturado(nomeCompleto, cpf) {
    try {
      const result = await this.client.query(
        'INSERT INTO PESSOAS (TIPO, RAZAO_SOCIAL, CNPJ_CPF, ATIVO, DATA_CADASTRO) VALUES ($1, $2, $3, TRUE, NOW()) RETURNING ID',
        ['FATURADO', nomeCompleto, cpf]
      );
      
      // CORREÇÃO: Garantir que retorna número (não string)
      return Number(result.rows[0].id);
    } catch (error) {
      throw new Error('Erro ao criar faturado: ' + error.message);
    }
  }

  // ========== FUNÇÕES PARA CLASSIFICAÇÃO ==========

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
      const result = await this.client.query(
        'INSERT INTO CLASSIFICACAO (TIPO, DESCRICAO, ATIVO, DATA_CADASTRO) VALUES ($1, $2, TRUE, NOW()) RETURNING ID',
        [tipo, descricao]
      );
      
      // CORREÇÃO: Garantir que retorna número (não string)
      return Number(result.rows[0].id);
    } catch (error) {
      throw new Error('Erro ao criar classificação: ' + error.message);
    }
  }

  async vincularClassificacao(idMovimento, idClassificacao) {
    try {
      // CORREÇÃO: Verificar se o vínculo já existe antes de inserir
      const checkQuery = `
        SELECT 1 FROM MOVIMENTO_CLASSIFICACAO 
        WHERE ID_MOVIMENTO = $1 AND ID_CLASSIFICACAO = $2
        LIMIT 1
      `;
      
      const checkResult = await this.client.query(checkQuery, [idMovimento, idClassificacao]);
      
      if (checkResult.rows.length === 0) {
        await this.client.query(
          'INSERT INTO MOVIMENTO_CLASSIFICACAO (ID_MOVIMENTO, ID_CLASSIFICACAO) VALUES ($1, $2)',
          [idMovimento, idClassificacao]
        );
        console.log(`✅ Classificação ${idClassificacao} vinculada ao movimento ${idMovimento}`);
      } else {
        console.log(`ℹ️ Classificação ${idClassificacao} já estava vinculada ao movimento ${idMovimento}`);
      }
      
      return true;
    } catch (error) {
      throw new Error('Erro ao vincular classificação: ' + error.message);
    }
  }

  // ========== FUNÇÕES AUXILIARES CORRIGIDAS ==========

  formatarDataParaPostgres(dataString) {
    if (!dataString) {
      return new Date().toISOString().split('T')[0];
    }
    
    try {
      if (dataString.includes('/')) {
        // Formato DD/MM/YYYY para YYYY-MM-DD
        const [dia, mes, ano] = dataString.split('/');
        const dataFormatada = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
        
        // Validar se a data é válida
        const dataValida = new Date(dataFormatada);
        if (isNaN(dataValida.getTime())) {
          throw new Error('Data inválida após conversão');
        }
        
        return dataFormatada;
      } else if (dataString.includes('-')) {
        // Já está em formato compatível com PostgreSQL
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

  // ========== VERIFICAÇÃO DE ESTRUTURA MELHORADA ==========

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

  // ========== NOVAS FUNÇÕES PARA DEBUG E MONITORAMENTO ==========

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

  // ========== FUNÇÃO PARA FECHAR CONEXÃO ==========

  async disconnect() {
    try {
      await this.client.end();
      console.log('🔌 Conexão com PostgreSQL fechada');
    } catch (error) {
      console.error('Erro ao fechar conexão:', error);
    }
  }

  // ========== FUNÇÃO PARA VERIFICAR SAÚDE DO BANCO ==========

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