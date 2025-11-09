import React, { useState } from 'react';
import { processInvoice } from '../services/api';
import HistoryPanel from './HistoryPanel';
import Agente3 from './Agente3/Agente3'; // ← ADICIONAR ESTA LINHA
import './InvoiceProcessor.css';

const InvoiceProcessor = () => {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('upload'); // ← ADICIONAR ESTE STATE

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError('');
    setResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError('Por favor, selecione um arquivo PDF');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      console.log('🔄 Enviando arquivo para processamento...');
      const response = await processInvoice(file);
      
      console.log('✅ RESPOSTA DO BACKEND:', response);

      if (response && response.success) {
        console.log('✅ Processamento concluído com sucesso');
        setResult(response);
      } else {
        setError('Não foi possível processar a nota fiscal');
      }
    } catch (err) {
      console.error('❌ Erro no processamento:', err);
      setError('Erro ao processar o arquivo');
    } finally {
      setLoading(false);
    }
  };

  
  const handleSelectHistoryNote = (noteData) => {
    console.log('📝 Nota selecionada do histórico:', noteData);
    setShowHistory(false);
    
    if (noteData && noteData.dadosExtraidos) {
      
      setResult({
        success: true,
        processamento: noteData.processamento || {
          mensagens: [],
          etapas: {},
          resumo: 'Carregado do histórico'
        },
        dadosExtraidos: noteData.dadosExtraidos,
        metadata: noteData.metadata || {
          fileName: 'Do histórico',
          processedAt: new Date().toISOString(),
          processadoPor: 'Sistema de Histórico'
        }
      });
      
      setTimeout(() => {
        const resultElement = document.querySelector('.result-container');
        if (resultElement) {
          resultElement.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      
    } else {
      console.error('❌ Dados inválidos do histórico:', noteData);
      setError('Erro ao carregar nota do histórico');
    }
  };

  const getProducts = () => {
    if (!result?.dadosExtraidos?.produtos || !Array.isArray(result.dadosExtraidos.produtos)) {
      console.log('❌ Nenhum produto encontrado na resposta:', result?.dadosExtraidos);
      return [];
    }
    
    console.log('🛍️ PRODUTOS DA RESPOSTA:', result.dadosExtraidos.produtos);
    return result.dadosExtraidos.produtos;
  };

  const getParcelas = () => {
    if (!result?.dadosExtraidos?.parcelas || !Array.isArray(result.dadosExtraidos.parcelas)) {
      console.log('❌ Nenhuma parcela encontrada na resposta:', result?.dadosExtraidos);
      return [];
    }
    
    console.log('📅 PARCELAS DA RESPOSTA:', result.dadosExtraidos.parcelas);
    return result.dadosExtraidos.parcelas;
  };

  const getInvoiceInfo = () => {
    if (!result?.dadosExtraidos) {
      return {
        numero: 'N/A',
        valorTotal: 0,
        dataEmissao: 'N/A',
        tipoConta: 'APAGAR',
        naturezaOperacao: 'N/A'
      };
    }
    
    return {
      numero: result.dadosExtraidos.numeroNotaFiscal || 'N/A',
      valorTotal: result.dadosExtraidos.valorTotal || 0,
      dataEmissao: result.dadosExtraidos.dataEmissao || 'N/A',
      tipoConta: result.dadosExtraidos.tipoConta || 'APAGAR',
      naturezaOperacao: result.dadosExtraidos.naturezaOperacao || 'N/A'
    };
  };

  
  const checkIfNewFromMessages = (tipo, id) => {
    if (!result?.processamento?.mensagens) return true;
    
    const mensagens = result.processamento.mensagens;
    
    for (const mensagem of mensagens) {
      
      let mensagemTexto = '';
      
      if (typeof mensagem === 'string') {
        mensagemTexto = mensagem;
      } else if (typeof mensagem === 'object' && mensagem !== null) {
        mensagemTexto = mensagem.texto || JSON.stringify(mensagem);
      } else {
        console.warn('⚠️ Mensagem com tipo inválido:', mensagem);
        continue;
      }
      
      if (tipo === 'fornecedor' && mensagemTexto.includes('FORNECEDOR:')) {
        if (mensagemTexto.includes('EXISTE - ID:')) {
          const existingId = mensagemTexto.match(/EXISTE - ID: (\d+)/);
          if (existingId && existingId[1] === id) {
            return false; 
          }
        } else if (mensagemTexto.includes('NÃO EXISTE')) {
          return true;
        }
      }
      
      if (tipo === 'faturado' && mensagemTexto.includes('FATURADO:')) {
        if (mensagemTexto.includes('EXISTE - ID:')) {
          const existingId = mensagemTexto.match(/EXISTE - ID: (\d+)/);
          if (existingId && existingId[1] === id) {
            return false;
          }
        } else if (mensagemTexto.includes('NÃO EXISTE')) {
          return true;
        }
      }
      
      if (tipo === 'classificacao' && mensagemTexto.includes('DESPESA:')) {
        if (mensagemTexto.includes('EXISTE - ID:')) {
          return false;
        } else if (mensagemTexto.includes('NÃO EXISTE')) {
          return true;
        }
      }
    }
    
    return true;
  };

  const getSupplierInfo = () => {
    if (!result?.processamento?.etapas?.fornecedor) {
      return {
        id: 'N/A',
        status: 'N/A',
        isNew: true
      };
    }
    
    const fornecedorText = result.processamento.etapas.fornecedor;
    let id = 'N/A';
    let isNew = true;
    
    
    if (typeof fornecedorText === 'string') {
      if (fornecedorText.includes('CRIADO - ID:')) {
        const idMatch = fornecedorText.match(/CRIADO - ID: (\d+)/);
        id = idMatch ? idMatch[1] : 'N/A';
        isNew = checkIfNewFromMessages('fornecedor', id);
      } else if (fornecedorText.includes('EXISTE - ID:')) {
        const idMatch = fornecedorText.match(/EXISTE - ID: (\d+)/);
        id = idMatch ? idMatch[1] : 'N/A';
        isNew = false;
      } else if (fornecedorText === 'EXISTENTE') {
        isNew = false;
      }
    }
    
    return {
      id: id,
      status: isNew ? 'Novo Cadastro' : 'Já Cadastrado',
      isNew: isNew
    };
  };

  const getClientInfo = () => {
    if (!result?.processamento?.etapas?.faturado) {
      return {
        id: 'N/A',
        status: 'N/A',
        isNew: true
      };
    }
    
    const faturadoText = result.processamento.etapas.faturado;
    let id = 'N/A';
    let isNew = true;
    
    
    if (typeof faturadoText === 'string') {
      if (faturadoText.includes('CRIADO - ID:')) {
        const idMatch = faturadoText.match(/CRIADO - ID: (\d+)/);
        id = idMatch ? idMatch[1] : 'N/A';
        isNew = checkIfNewFromMessages('faturado', id);
      } else if (faturadoText.includes('EXISTE - ID:')) {
        const idMatch = faturadoText.match(/EXISTE - ID: (\d+)/);
        id = idMatch ? idMatch[1] : 'N/A';
        isNew = false;
      } else if (faturadoText === 'EXISTENTE') {
        isNew = false;
      }
    }
    
    return {
      id: id,
      status: isNew ? 'Novo Cadastro' : 'Já Cadastrado',
      isNew: isNew
    };
  };

  const getSupplierData = () => {
    if (!result?.dadosExtraidos?.fornecedor) {
      return {
        razaoSocial: 'N/A',
        cnpj: 'N/A'
      };
    }
    
    return {
      razaoSocial: result.dadosExtraidos.fornecedor.razaoSocial || 'N/A',
      cnpj: result.dadosExtraidos.fornecedor.cnpj || 'N/A'
    };
  };

  const getClientData = () => {
    if (!result?.dadosExtraidos?.faturado) {
      return {
        nome: 'N/A',
        documento: 'N/A'
      };
    }
    
    const documento = result.dadosExtraidos.faturado.cpf || 
                     result.dadosExtraidos.faturado.cnpj || 
                     'N/A';
    
    return {
      nome: result.dadosExtraidos.faturado.nome || 'N/A',
      documento: documento
    };
  };

  const getClassification = () => {
    if (!result?.dadosExtraidos?.classificacaoDespesa || !Array.isArray(result.dadosExtraidos.classificacaoDespesa)) {
      return ["INSUMOS_AGRICOLAS"]; // Valor padrão
    }
    
    return result.dadosExtraidos.classificacaoDespesa;
  };

  const getClassificationInfo = () => {
    if (!result?.processamento?.etapas?.despesa) {
      return {
        ids: [],
        status: 'N/A',
        isNew: true
      };
    }
    
    const despesaText = result.processamento.etapas.despesa;
    let ids = [];
    let isNew = true;
    
    
    if (typeof despesaText === 'string') {
      if (despesaText.includes('CRIADAS - IDs:')) {
        const idsMatch = despesaText.match(/CRIADAS - IDs: (.+)/);
        if (idsMatch && idsMatch[1]) {
          ids = idsMatch[1].split(', ').map(id => id.trim());
          isNew = ids.some(id => checkIfNewFromMessages('classificacao', id));
        }
      } else if (despesaText === 'EXISTENTE') {
        isNew = false;
      }
    }
    
    return {
      ids: ids,
      status: isNew ? 'Novo Cadastro' : 'Já Cadastrada',
      isNew: isNew
    };
  };

  const formatCurrency = (value) => {
    if (!value && value !== 0) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatCNPJ = (cnpj) => {
    if (!cnpj || cnpj === 'N/A') return 'N/A';
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length !== 14) return cnpj;
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const formatCPF = (cpf) => {
    if (!cpf || cpf === 'N/A') return 'N/A';
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === 'N/A') return 'N/A';
    try {
      if (dateString.includes('/')) {
        return dateString;
      }

      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateString;
    }
  };

  const formatTipoConta = (tipo) => {
    const tipos = {
      'APAGAR': '🔄 Contas a Pagar',
      'ARECEBER': '💰 Contas a Receber'
    };
    return tipos[tipo] || tipo;
  };

  const getTipoContaClass = (tipo) => {
    const classes = {
      'APAGAR': 'conta-pagar',
      'ARECEBER': 'conta-receber'
    };
    return classes[tipo] || '';
  };

  const renderProducts = () => {
    const produtos = getProducts();
    
    console.log('🎯 PRODUTOS PARA RENDERIZAR:', produtos);

    if (produtos.length === 0) {
      return (
        <div className="products-section">
          <h3>Produtos/Serviços</h3>
          <div className="info-banner">
            <p>⚠️ <strong>Informação:</strong> Nenhum produto encontrado na resposta.</p>
          </div>
        </div>
      );
    }

    const totalProdutos = produtos.reduce((sum, produto) => sum + (produto.valorTotal || 0), 0);
    const invoiceInfo = getInvoiceInfo();

    return (
      <div className="products-section">
        <h3>Produtos/Serviços ({produtos.length})</h3>
        
        <div className="products-table">
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Quantidade</th>
                <th>Valor Unitário</th>
                <th>Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((produto, index) => (
                <tr key={index}>
                  <td>{produto.descricao || 'Produto sem descrição'}</td>
                  <td className="number">{produto.quantidade?.toFixed(2) || '0.00'}</td>
                  <td className="number">{formatCurrency(produto.valorUnitario)}</td>
                  <td className="number">{formatCurrency(produto.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="3" className="total-label"><strong>Soma dos Produtos:</strong></td>
                <td className="number">{formatCurrency(totalProdutos)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const renderParcelas = () => {
    const parcelas = getParcelas();
    
    console.log('🎯 PARCELAS PARA RENDERIZAR:', parcelas);

    if (parcelas.length === 0) {
      return (
        <div className="parcelas-section">
          <h3>Parcelas</h3>
          <div className="info-banner">
            <p>ℹ️ <strong>Informação:</strong> Nenhuma parcela encontrada na nota fiscal.</p>
          </div>
        </div>
      );
    }

    const totalParcelas = parcelas.reduce((sum, parcela) => sum + (parcela.valor || 0), 0);

    return (
      <div className="parcelas-section">
        <h3>Parcelas ({parcelas.length})</h3>
        
        <div className="parcelas-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Data de Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {parcelas.map((parcela, index) => (
                <tr key={index}>
                  <td className="number">{parcela.numeroParcela || index + 1}</td>
                  <td className="date">{formatDate(parcela.dataVencimento)}</td>
                  <td className="number">{formatCurrency(parcela.valor)}</td>
                  <td className="status">
                    <span className="status-pending">Pendente</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="2" className="total-label"><strong>Total das Parcelas:</strong></td>
                <td className="number total-value">{formatCurrency(totalParcelas)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const renderClassification = () => {
    const classificacao = getClassification();
    const classificationInfo = getClassificationInfo();
    
    return (
      <div className="classification-section">
        <h3>Classificação da Despesa</h3>
        <div className="classification-info">
          <p><strong>Categoria:</strong> <span className="info-value">
            {classificacao.join(', ')}
          </span></p>
          <p><strong>ID no Sistema:</strong> <span className="info-value">
            {classificationInfo.ids.length > 0 ? classificationInfo.ids.join(', ') : 'N/A'}
          </span></p>
          <p><strong>Status:</strong> <span className={`info-value ${classificationInfo.isNew ? 'warning' : 'success'}`}>
            {classificationInfo.isNew ? '⚠️ Novo Cadastro' : '✓ Já Cadastrada'}
          </span></p>
        </div>
      </div>
    );
  };

  const renderProcessamentoInfo = () => {
    if (!result?.processamento) return null;

    return (
      <div className="processamento-section">
        <h3>Processamento do Agente</h3>
        <div className="processamento-info">
          <p><strong>Status:</strong> <span className="info-value success">{result.processamento.resumo}</span></p>
          <p><strong>ID do Movimento:</strong> <span className="info-value">{result.processamento.etapas?.movimento?.replace('CRIADO - ID: ', '') || 'N/A'}</span></p>
          
          <div className="etapas">
            <h4>Etapas do Processamento:</h4>
            <ul>
              {result.processamento.etapas?.fornecedor && <li>✅ {result.processamento.etapas.fornecedor}</li>}
              {result.processamento.etapas?.faturado && <li>✅ {result.processamento.etapas.faturado}</li>}
              {result.processamento.etapas?.despesa && <li>✅ {result.processamento.etapas.despesa}</li>}
              {result.processamento.etapas?.movimento && <li>✅ {result.processamento.etapas.movimento}</li>}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const getMessageText = (mensagem) => {
    if (typeof mensagem === 'string') {
      return mensagem;
    } else if (typeof mensagem === 'object' && mensagem !== null) {
      return mensagem.texto || JSON.stringify(mensagem);
    } else {
      return String(mensagem);
    }
  };

  const handleShowHistory = () => {
    setShowHistory(true);
  };

  const handleCloseHistory = () => {
    setShowHistory(false);
  };

  // RENDERIZAÇÃO DA ABA UPLOAD (SEU CÓDIGO ORIGINAL)
  const renderUploadTab = () => {
    const invoiceInfo = getInvoiceInfo();
    const supplierData = getSupplierData();
    const clientData = getClientData();
    const supplierInfo = getSupplierInfo();
    const clientInfo = getClientInfo();
    const classificationInfo = getClassificationInfo();

    return (
      <div>
        <h1>LSR - NF</h1>
        <p>Faça upload de uma nota fiscal em PDF</p>
        
        <div className="history-button-container">
          <button type="button" onClick={handleShowHistory} className="history-button">
            📋 Ver Histórico
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="upload-form">
          <div className="file-input-container">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="file-input"
              id="pdfFile"
            />
            <label htmlFor="pdfFile" className="file-label">
              {file ? file.name : 'Selecionar PDF'}
            </label>
          </div>
          
          <button type="submit" disabled={loading || !file} className="process-button">
            {loading ? 'Processando...' : 'Extrair Dados'}
          </button>
        </form>

        {error && <div className="error-message">{error}</div>}

        {result && result.success && (
          <div className="result-container">
            <h2>✅ Processamento Concluído com Sucesso!</h2>
            
            {renderProcessamentoInfo()}

            {/* Informações Básicas - ATUALIZADA COM TIPO DE CONTA */}
            <div className="summary-section">
              <h3>Informações da Nota Fiscal</h3>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="summary-label">Número NF:</span>
                  <span className="summary-value">{invoiceInfo.numero}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Valor Total:</span>
                  <span className="summary-value">{formatCurrency(invoiceInfo.valorTotal)}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Data Emissão:</span>
                  <span className="summary-value">{formatDate(invoiceInfo.dataEmissao)}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Tipo de Conta:</span>
                  <span className={`summary-value ${getTipoContaClass(invoiceInfo.tipoConta)}`}>
                    {formatTipoConta(invoiceInfo.tipoConta)}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Natureza:</span>
                  <span className="summary-value">{invoiceInfo.naturezaOperacao}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Status:</span>
                  <span className="summary-value success">Processada com sucesso</span>
                </div>
              </div>
            </div>

            {/* Fornecedor - AGORA COM VERIFICAÇÃO DAS MENSAGENS */}
            <div className="supplier-section">
              <h3>Fornecedor</h3>
              <div className="supplier-info">
                <p><strong>Razão Social:</strong> <span className="info-value">{supplierData.razaoSocial}</span></p>
                <p><strong>CNPJ:</strong> <span className="info-value">{formatCNPJ(supplierData.cnpj)}</span></p>
                <p><strong>ID no Sistema:</strong> <span className="info-value">{supplierInfo.id}</span></p>
                <p><strong>Status no Sistema:</strong> <span className={`info-value ${supplierInfo.isNew ? 'warning' : 'success'}`}>
                  {supplierInfo.isNew ? '⚠️ Novo Cadastro' : '✓ Já Cadastrado'}
                </span></p>
              </div>
            </div>

            {/* Cliente/Faturado - AGORA COM VERIFICAÇÃO DAS MENSAGENS */}
            <div className="client-section">
              <h3>Cliente/Faturado</h3>
              <div className="client-info">
                <p><strong>Nome:</strong> <span className="info-value">{clientData.nome}</span></p>
                <p><strong>CPF/CNPJ:</strong> <span className="info-value">
                  {clientData.documento?.length === 11 ? formatCPF(clientData.documento) : formatCNPJ(clientData.documento)}
                </span></p>
                <p><strong>ID no Sistema:</strong> <span className="info-value">{clientInfo.id}</span></p>
                <p><strong>Status no Sistema:</strong> <span className={`info-value ${clientInfo.isNew ? 'warning' : 'success'}`}>
                  {clientInfo.isNew ? '⚠️ Novo Cadastro' : '✓ Já Cadastrado'}
                </span></p>
              </div>
            </div>

            {/* Produtos */}
            {renderProducts()}

            {/* Parcelas */}
            {renderParcelas()}

            {/* Classificação - COM VERIFICAÇÃO DAS MENSAGENS */}
            {renderClassification()}

            {/* Mensagens do Processamento - CORREÇÃO: Usar getMessageText */}
            {result.processamento?.mensagens && (
              <div className="messages-section">
                <h3>Detalhes do Processamento</h3>
                <div className="messages-container">
                  {result.processamento.mensagens.map((msg, index) => (
                    <div key={index} className="message-item">
                      <span className="message-time">•</span>
                      <span className="message-text">{getMessageText(msg)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Debug */}
            <details className="json-details">
              <summary>JSON Completo (Debug)</summary>
              <pre className="result-json">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}

        <HistoryPanel 
          isOpen={showHistory}
          onClose={handleCloseHistory}
          onSelectNote={handleSelectHistoryNote}
        />
      </div>
    );
  };

  return (
    <div className="invoice-processor">
      {/* MENU DE ABAS - NOVO */}
      <div className="tabs-menu">
        <button 
          className={activeTab === 'upload' ? 'tab-active' : ''}
          onClick={() => setActiveTab('upload')}
        >
          📤 Upload de Notas
        </button>
        <button 
          className={activeTab === 'agente3' ? 'tab-active' : ''}
          onClick={() => setActiveTab('agente3')}
        >
          🤖 Agente IA
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}
      {activeTab === 'upload' && renderUploadTab()}
      
      {activeTab === 'agente3' && <Agente3 />}
    </div>
  );
};

export default InvoiceProcessor;