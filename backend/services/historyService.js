const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(__dirname, '..', 'history');

if (!fs.existsSync(HISTORY_DIR)) {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

const saveToHistory = (invoiceData) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    let safeFileName = 'arquivo_desconhecido';
    if (invoiceData.fileName && typeof invoiceData.fileName === 'string') {
      safeFileName = invoiceData.fileName.replace(/\.pdf$/i, '');
    } else if (invoiceData.nomeArquivo && typeof invoiceData.nomeArquivo === 'string') {
      safeFileName = invoiceData.nomeArquivo.replace(/\.pdf$/i, '');
    }
    
    const historyFileName = `nota_${timestamp}_${safeFileName}.json`;
    const filePath = path.join(HISTORY_DIR, historyFileName);
    
    const historyEntry = {
      id: timestamp,
      fileName: invoiceData.fileName || invoiceData.nomeArquivo || 'arquivo_desconhecido.pdf',
      processedAt: invoiceData.processedAt || new Date().toISOString(),
      data: {
        success: true,
        dadosExtraidos: invoiceData.dadosNota || {},
        processamento: {
          mensagens: invoiceData.mensagens || [],
          etapas: {
            fornecedor: invoiceData.idFornecedor ? `CRIADO - ID: ${invoiceData.idFornecedor}` : 'EXISTENTE',
            faturado: invoiceData.idFaturado ? `CRIADO - ID: ${invoiceData.idFaturado}` : 'EXISTENTE',
            despesa: invoiceData.idsClassificacoes ? `CRIADAS - IDs: ${invoiceData.idsClassificacoes.join(', ')}` : 'EXISTENTE',
            movimento: invoiceData.idMovimento ? `CRIADO - ID: ${invoiceData.idMovimento}` : 'NÃO CRIADO'
          },
          resumo: `REGISTRO LANÇADO COM SUCESSO - ID MOVIMENTO: ${invoiceData.idMovimento || 'N/A'}`
        },
        metadata: {
          fileName: invoiceData.fileName || invoiceData.nomeArquivo,
          processedAt: invoiceData.processedAt || new Date().toISOString(),
          processadoPor: 'Sistema Inteligente de Contas a Pagar'
        }
      }
    };
    
    fs.writeFileSync(filePath, JSON.stringify(historyEntry, null, 2), 'utf8');
    console.log('✅ Nota salva no histórico:', historyFileName);
    
    return historyEntry;
  } catch (error) {
    console.error('❌ Erro ao salvar no histórico:', error);
    return null;
  }
};

const getHistory = () => {
  try {
    if (!fs.existsSync(HISTORY_DIR)) {
      return [];
    }
    
    const files = fs.readdirSync(HISTORY_DIR)
      .filter(file => file.endsWith('.json'))
      .sort()
      .reverse(); 
    
    const history = files.map(file => {
      try {
        const filePath = path.join(HISTORY_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const entry = JSON.parse(content);
        
        const dadosExtraidos = entry.data?.dadosExtraidos || {};
        const fornecedor = dadosExtraidos.fornecedor || {};
        const faturado = dadosExtraidos.faturado || {};
        
        return {
          id: entry.id,
          fileName: entry.fileName,
          processedAt: entry.processedAt,

          preview: {
            numeroNota: dadosExtraidos.numeroNotaFiscal || 'N/A',
            fornecedor: fornecedor.razaoSocial || fornecedor.nome || 'N/A',
            valorTotal: dadosExtraidos.valorTotal || 0,
            dataEmissao: dadosExtraidos.dataEmissao || 'N/A',
            tipoConta: dadosExtraidos.tipoConta || 'APAGAR'
          },
          
          data: entry.data
        };
      } catch (error) {
        console.error('Erro ao ler arquivo de histórico:', file, error);
        return null;
      }
    }).filter(entry => entry !== null);
    
    return history;
  } catch (error) {
    console.error('Erro ao carregar histórico:', error);
    return [];
  }
};

const getHistoryEntry = (id) => {
  try {
    if (!fs.existsSync(HISTORY_DIR)) {
      console.log('❌ Diretório de histórico não existe');
      return null;
    }
    
    const files = fs.readdirSync(HISTORY_DIR);
    const file = files.find(f => f.includes(id));
    
    if (!file) {
      console.log('❌ Arquivo não encontrado para ID:', id);
      return null;
    }
    
    const filePath = path.join(HISTORY_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const entry = JSON.parse(content);
    
    console.log('📁 Entrada carregada do histórico:', {
      id: entry.id,
      hasData: !!entry.data,
      hasDadosExtraidos: !!entry.data?.dadosExtraidos,
      fileName: entry.fileName
    });
    
    return {
      success: true,
      data: entry.data || {
        dadosExtraidos: {},
        processamento: { 
          mensagens: [], 
          etapas: {}, 
          resumo: 'Carregado do histórico' 
        },
        metadata: { 
          fileName: entry.fileName, 
          processedAt: entry.processedAt 
        }
      }
    };
  } catch (error) {
    console.error('❌ Erro ao carregar entrada do histórico:', error);
    return null;
  }
};

const deleteHistoryEntry = (id) => {
  try {
    if (!fs.existsSync(HISTORY_DIR)) {
      return false;
    }
    
    const files = fs.readdirSync(HISTORY_DIR);
    const file = files.find(f => f.includes(id));
    
    if (!file) return false;
    
    const filePath = path.join(HISTORY_DIR, file);
    fs.unlinkSync(filePath);
    console.log('✅ Entrada deletada do histórico:', file);
    return true;
  } catch (error) {
    console.error('❌ Erro ao deletar entrada do histórico:', error);
    return false;
  }
};

module.exports = {
  saveToHistory,
  getHistory,
  getHistoryEntry,
  deleteHistoryEntry
};