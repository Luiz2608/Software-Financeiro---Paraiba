
const databaseService = require('./databaseService');
const { analyzeWithGemini } = require('./geminiService');

class AgenteService {
  constructor() {
    this.mensagens = [];
    this.contadorMensagens = 0;
  }

  adicionarMensagem(mensagem) {
    this.contadorMensagens++;
    const id = this.contadorMensagens;
    
    this.mensagens.push({
      id: id,
      texto: mensagem,
      timestamp: new Date()
    });
    console.log(`🤖 ${mensagem}`);
  }

  limparMensagens() {
    this.mensagens = [];
    this.contadorMensagens = 0;
  }

  async processarContaPagar(dadosNota) {
    this.limparMensagens();

    try {
      this.adicionarMensagem("🚀 Iniciando processamento de conta a pagar...");

      // ========== VERIFICAÇÃO DO FORNECEDOR ==========
      this.adicionarMensagem("🔍 Verificando FORNECEDOR no banco de dados...");
      const fornecedor = await databaseService.verificarFornecedor(
        dadosNota.fornecedor.razaoSocial,
        dadosNota.fornecedor.cnpj
      );

      let mensagemFornecedor = `FORNECEDOR:\n${dadosNota.fornecedor.razaoSocial}\nCNPJ: ${dadosNota.fornecedor.cnpj}\n${fornecedor.existe ? `EXISTE - ID: ${fornecedor.id}` : 'NÃO EXISTE'}`;
      this.adicionarMensagem(mensagemFornecedor);

      let idFornecedor = fornecedor.id;
      if (!fornecedor.existe) {
        idFornecedor = await databaseService.criarFornecedor(
          dadosNota.fornecedor.razaoSocial,
          dadosNota.fornecedor.cnpj
        );
        this.adicionarMensagem(`✅ FORNECEDOR CRIADO - ID: ${idFornecedor}`);
      }

      // ========== VERIFICAÇÃO DO FATURADO ==========
      this.adicionarMensagem("🔍 Verificando FATURADO no banco de dados...");
      const faturado = await databaseService.verificarFaturado(
        dadosNota.faturado?.nomeCompleto || dadosNota.cliente?.nome,
        dadosNota.faturado?.cpf || dadosNota.cliente?.documento
      );

      const nomeFaturado = dadosNota.faturado?.nomeCompleto || dadosNota.cliente?.nome || 'N/A';
      const documentoFaturado = dadosNota.faturado?.cpf || dadosNota.cliente?.documento || 'N/A';
      
      let mensagemFaturado = `FATURADO:\n${nomeFaturado}\nCPF: ${documentoFaturado}\n${faturado.existe ? `EXISTE - ID: ${faturado.id}` : 'NÃO EXISTE'}`;
      this.adicionarMensagem(mensagemFaturado);

      let idFaturado = faturado.id;
      if (!faturado.existe && nomeFaturado !== 'N/A') {
        idFaturado = await databaseService.criarFaturado(
          nomeFaturado,
          documentoFaturado
        );
        this.adicionarMensagem(`✅ FATURADO CRIADO - ID: ${idFaturado}`);
      }

      // ========== VERIFICAÇÃO DAS CLASSIFICAÇÕES DE DESPESA ==========
      const idsClassificacoes = [];
      const classificacoes = dadosNota.classificacaoDespesa || ['OUTRAS_DESPESAS'];

      for (const descricaoDespesa of classificacoes) {
        this.adicionarMensagem(`🔍 Verificando DESPESA: ${descricaoDespesa}`);
        const classificacao = await databaseService.verificarClassificacao('DESPESA', descricaoDespesa);

        let mensagemDespesa = `DESPESA:\n${descricaoDespesa}\n${classificacao.existe ? `EXISTE - ID: ${classificacao.id}` : 'NÃO EXISTE'}`;
        this.adicionarMensagem(mensagemDespesa);

        let idClassificacao = classificacao.id;
        if (!classificacao.existe) {
          idClassificacao = await databaseService.criarClassificacao('DESPESA', descricaoDespesa);
          this.adicionarMensagem(`✅ DESPESA CRIADA - ID: ${idClassificacao}`);
        }
        idsClassificacoes.push(idClassificacao);
      }

      // ========== CRIAÇÃO DO MOVIMENTO ==========
      this.adicionarMensagem("💾 CRIANDO UM NOVO REGISTRO DO MOVIMENTO...");
      const idMovimento = await databaseService.criarMovimentoConta({
        tipo: 'APAGAR',
        idPessoa: idFornecedor,
        numeroNotaFiscal: dadosNota.numeroNotaFiscal,
        dataEmissao: this.formatarData(dadosNota.dataEmissao),
        valorTotal: dadosNota.valorTotal,
        observacao: `Processado automaticamente - ${dadosNota.fornecedor.razaoSocial}`
      });

      this.adicionarMensagem(`✅ MOVIMENTO CRIADO - ID: ${idMovimento}`);

      // ========== VINCULAR CLASSIFICAÇÕES AO MOVIMENTO ==========
      for (const idClassificacao of idsClassificacoes) {
        await databaseService.vincularClassificacao(idMovimento, idClassificacao);
      }
      this.adicionarMensagem(`✅ CLASSIFICAÇÕES VINCULADAS - ${idsClassificacoes.length} categorias`);

      // ========== CRIAÇÃO DAS PARCELAS ==========
      this.adicionarMensagem("📅 Criando parcelas...");
      await databaseService.criarParcelas(idMovimento, dadosNota.parcelas);
      this.adicionarMensagem(`✅ PARCELAS CRIADAS - ${dadosNota.parcelas?.length || 0} parcelas`);

      // ========== MENSAGEM FINAL DE CONFIRMAÇÃO ==========
      this.adicionarMensagem(`🎉 REGISTRO LANÇADO COM SUCESSO - ID MOVIMENTO: ${idMovimento}`);

      return {
        sucesso: true,
        idMovimento,
        idFornecedor,
        idFaturado,
        idsClassificacoes,
        mensagens: this.mensagens
      };

    } catch (error) {
      this.adicionarMensagem(`❌ ERRO: ${error.message}`);
      return {
        sucesso: false,
        erro: error.message,
        mensagens: this.mensagens
      };
    }
  }

  formatarData(dataString) {
    if (!dataString) return new Date().toISOString().split('T')[0];
    
    try {
      if (dataString.includes('/')) {
        const [dia, mes, ano] = dataString.split('/');
        const dataFormatada = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
        console.log(`📅 Data convertida: ${dataString} → ${dataFormatada}`);
        return dataFormatada;
      } else if (dataString.includes('-')) {
        console.log(`📅 Data já formatada: ${dataString}`);
        return dataString;
      } else {
        console.warn(`📅 Formato de data desconhecido: ${dataString}, usando data atual`);
        return new Date().toISOString().split('T')[0];
      }
    } catch (error) {
      console.error(`❌ Erro ao formatar data: ${dataString}`, error);
      return new Date().toISOString().split('T')[0];
    }
  }

  //GARANTIR QUE A FUNÇÃO EXISTA COMO MÉTODO DA CLASSE
  async analisarEProcessarNota(pdfText, nomeArquivo) {
    try {
      this.adicionarMensagem("🤖 Gemini AI analisando nota fiscal...");
      
      // Usar o serviço Gemini existente
      const resultadoGemini = await analyzeWithGemini(pdfText);
      
      this.adicionarMensagem("📊 Análise do Gemini concluída");
      this.adicionarMensagem(`• Fornecedor: ${resultadoGemini.fornecedor?.razaoSocial}`);
      this.adicionarMensagem(`• Valor Total: R$ ${resultadoGemini.valorTotal}`);

      // Garantir que temos os dados mínimos necessários
      if (!resultadoGemini.fornecedor) {
        resultadoGemini.fornecedor = { razaoSocial: 'FORNECEDOR NÃO IDENTIFICADO', cnpj: 'N/A' };
      }

      if (!resultadoGemini.parcelas || resultadoGemini.parcelas.length === 0) {
        resultadoGemini.parcelas = [{
          numeroParcela: 1,
          dataVencimento: new Date().toISOString().split('T')[0],
          valor: resultadoGemini.valorTotal || 0
        }];
      }

      // Processar como conta a pagar
      const resultado = await this.processarContaPagar(resultadoGemini);
      
      return {
        ...resultado,
        dadosNota: resultadoGemini,
        nomeArquivo
      };

    } catch (error) {
      this.adicionarMensagem(`❌ Erro na análise: ${error.message}`);
      return {
        sucesso: false,
        erro: error.message,
        mensagens: this.mensagens
      };
    }
  }

  // MÉTODO PARA OBTER HISTÓRICO DE MENSAGENS
  obterMensagens() {
    return this.mensagens;
  }

  // MÉTODO PARA LIMPAR HISTÓRICO
  limparHistorico() {
    this.limparMensagens();
  }
}

// CORREÇÃO: Exportar a instância da classe corretamente
module.exports = new AgenteService();