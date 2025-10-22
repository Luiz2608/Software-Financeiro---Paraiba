const { extractTextFromPDF } = require('../services/pdfService');
const agenteService = require('../services/agente2Service');
const { saveToHistory, getHistory, getHistoryEntry, deleteHistoryEntry } = require('../services/historyService');
const fs = require('fs');

const processInvoice = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    console.log('📁 Processando arquivo:', req.file.originalname);

    // Extrair texto do PDF
    const pdfText = await extractTextFromPDF(req.file.path);
    
    if (!pdfText || pdfText.trim().length < 50) {
      return res.status(400).json({ 
        error: 'PDF não contém texto legível ou está vazio' 
      });
    }
    
    console.log('📄 Texto extraído do PDF:', pdfText.substring(0, 500) + '...');
    
    // Processar com Agente Inteligente
    const resultado = await agenteService.analisarEProcessarNota(
      pdfText, 
      req.file.originalname
    );
    
    // Salvar no histórico se foi bem sucedido
    if (resultado.sucesso) {
      const historicoEntry = {
        ...resultado,
        fileName: req.file.originalname,
        processedAt: new Date().toISOString(),
        idMovimento: resultado.idMovimento
      };
      saveToHistory(historicoEntry);
    }
    
    // Limpar arquivo temporário
    try {
      fs.unlinkSync(req.file.path);
      console.log('🧹 Arquivo temporário removido');
    } catch (cleanupError) {
      console.warn('Aviso ao limpar arquivo temporário:', cleanupError);
    }
    
    // ✅ FORMATAR RESPOSTA CONFORME REQUISITOS ESPECÍFICOS - CORRIGIDO
    const respostaFormatada = {
      success: resultado.sucesso,
      // 🔍 MENSAGENS DE PROCESSAMENTO (FORMATO EXATO SOLICITADO)
      processamento: {
        mensagens: resultado.mensagens?.map(msg => msg.texto) || [],
        etapas: {
          fornecedor: resultado.idFornecedor ? `CRIADO - ID: ${resultado.idFornecedor}` : 'EXISTENTE',
          faturado: resultado.idFaturado ? `CRIADO - ID: ${resultado.idFaturado}` : 'EXISTENTE',
          despesa: resultado.idsClassificacoes ? `CRIADAS - IDs: ${resultado.idsClassificacoes.join(', ')}` : 'EXISTENTE',
          movimento: resultado.idMovimento ? `CRIADO - ID: ${resultado.idMovimento}` : 'NÃO CRIADO'
        },
        resumo: `REGISTRO LANÇADO COM SUCESSO - ID MOVIMENTO: ${resultado.idMovimento || 'N/A'}`
      },
      // 📊 DADOS EXTRAÍDOS - CORREÇÃO: INCLUIR TODOS OS CAMPOS
      dadosExtraidos: resultado.dadosNota ? {
        fornecedor: resultado.dadosNota.fornecedor,
        faturado: resultado.dadosNota.faturado || resultado.dadosNota.cliente,
        valorTotal: resultado.dadosNota.valorTotal,
        numeroNotaFiscal: resultado.dadosNota.numeroNotaFiscal,
        dataEmissao: resultado.dadosNota.dataEmissao,
        // ✅ CAMPOS QUE ESTAVAM FALTANDO:
        produtos: resultado.dadosNota.produtos || [],
        parcelas: resultado.dadosNota.parcelas || [],
        classificacaoDespesa: resultado.dadosNota.classificacaoDespesa || ["INSUMOS_AGRICOLAS"],
        quantidadeParcelas: resultado.dadosNota.parcelas?.length || 0,
        valorFrete: resultado.dadosNota.valorFrete || 0,
        // ✅ NOVOS CAMPOS:
        tipoConta: resultado.dadosNota.tipoConta || "APAGAR",
        naturezaOperacao: resultado.dadosNota.naturezaOperacao || "N/A"
      } : null,
      // 📋 METADADOS
      metadata: {
        fileName: req.file.originalname,
        processedAt: new Date().toISOString(),
        processadoPor: 'Sistema Inteligente de Contas a Pagar'
      }
    };

    // 🎯 RETORNAR RESPOSTA FORMATADA
    if (resultado.sucesso) {
      console.log(`✅ Processamento concluído - Movimento ID: ${resultado.idMovimento}`);
      console.log('📦 Dados enviados ao frontend:', {
        produtos: respostaFormatada.dadosExtraidos?.produtos?.length || 0,
        parcelas: respostaFormatada.dadosExtraidos?.parcelas?.length || 0,
        classificacao: respostaFormatada.dadosExtraidos?.classificacaoDespesa || [],
        tipoConta: respostaFormatada.dadosExtraidos?.tipoConta || 'APAGAR'
      });
      res.json(respostaFormatada);
    } else {
      console.error('❌ Processamento falhou:', resultado.erro);
      res.status(400).json({
        ...respostaFormatada,
        error: resultado.erro
      });
    }
    
  } catch (error) {
    console.error('💥 Erro crítico no processamento:', error);
    
    // Limpar arquivo em caso de erro
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🧹 Arquivo temporário removido após erro');
      } catch (cleanupError) {
        console.warn('Aviso ao limpar arquivo temporário:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Erro interno ao processar o PDF',
      details: error.message,
      metadata: {
        processedAt: new Date().toISOString(),
        errorType: 'CRITICAL_ERROR'
      }
    });
  }
};

// 📚 FUNÇÕES DE HISTÓRICO - CORRIGIDAS
const getHistoryList = async (req, res) => {
  try {
    const history = getHistory();
    
    res.json({
      success: true,
      data: history,
      count: history.length,
      summary: {
        processados: history.filter(h => h.preview?.valorTotal > 0).length,
        comErro: history.filter(h => !h.preview?.valorTotal || h.preview.valorTotal === 0).length,
        ultimoProcessamento: history.length > 0 ? history[0].processedAt : null
      }
    });
  } catch (error) {
    console.error('Erro ao carregar histórico:', error);
    res.status(500).json({ 
      error: 'Erro ao carregar histórico',
      details: error.message 
    });
  }
};

const getHistoryDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const entry = getHistoryEntry(id);
    
    if (!entry) {
      return res.status(404).json({ 
        error: 'Entrada do histórico não encontrada' 
      });
    }
    
    res.json(entry);
  } catch (error) {
    console.error('Erro ao carregar detalhes do histórico:', error);
    res.status(500).json({ 
      error: 'Erro ao carregar detalhes do histórico',
      details: error.message 
    });
  }
};

const deleteHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = deleteHistoryEntry(id);
    
    if (!deleted) {
      return res.status(404).json({ 
        error: 'Entrada do histórico não encontrada' 
      });
    }
    
    res.json({
      success: true,
      message: 'Entrada deletada com sucesso',
      deletedId: id
    });
  } catch (error) {
    console.error('Erro ao deletar histórico:', error);
    res.status(500).json({ 
      error: 'Erro ao deletar histórico',
      details: error.message 
    });
  }
};

// Exportar TODAS as funções
module.exports = { 
  processInvoice, 
  getHistoryList, 
  getHistoryDetail, 
  deleteHistory 
};