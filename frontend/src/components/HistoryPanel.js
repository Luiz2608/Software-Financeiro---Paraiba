import React, { useState, useEffect } from 'react';
import { getHistory, getHistoryDetail, deleteHistoryEntry } from '../services/api';
import './HistoryPanel.css';

const HistoryPanel = ({ onSelectNote, isOpen, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getHistory();
      
      if (response && response.success) {
        setHistory(Array.isArray(response.data) ? response.data : []);
      } else {
        setHistory([]);
      }
    } catch (err) {
      setError('Erro ao carregar histórico');
      console.error('Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);


  const handleViewNote = async (id) => {
    try {
      console.log('🔍 Carregando nota do histórico, ID:', id);
      const response = await getHistoryDetail(id);
      console.log('📄 Resposta da API:', response);
      
      if (response && response.success && response.data) {
        console.log('✅ Dados recebidos:', response.data);
        if (onSelectNote) {
          onSelectNote(response.data);
          onClose(); // Fechar o painel após selecionar
        }
      } else {
        console.error('❌ Resposta inválida:', response);
        setError('Dados da nota não encontrados');
      }
    } catch (err) {
      console.error('❌ Erro ao carregar nota:', err);
      setError('Erro ao carregar nota do histórico');
    }
  };

  const handleDeleteNote = async (id, event) => {
    event.stopPropagation();
    
    if (window.confirm('Tem certeza que deseja excluir esta nota do histórico?')) {
      try {
        await deleteHistoryEntry(id);
        setHistory(history.filter(item => item.id !== id));
      } catch (err) {
        setError('Erro ao excluir nota');
        console.error('Erro:', err);
      }
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString('pt-BR');
    } catch {
      return 'Data inválida';
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  // CORREÇÃO: Função para acessar dados do preview de forma segura
  const getPreviewValue = (item, key) => {
    if (!item || !item.preview) return 'N/A';
    return item.preview[key] || 'N/A';
  };

  // CORREÇÃO: Função para formatar tipo de conta
  const formatTipoConta = (tipo) => {
    const tipos = {
      'APAGAR': '🔄 Contas a Pagar',
      'ARECEBER': '💰 Contas a Receber'
    };
    return tipos[tipo] || tipo;
  };

  if (!isOpen) return null;

  return (
    <div className="history-panel-overlay" onClick={onClose}>
      <div className="history-panel" onClick={(e) => e.stopPropagation()}>
        <div className="history-header">
          <h2>Histórico de Notas Fiscais</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading">Carregando histórico...</div>
        ) : history.length === 0 ? (
          <div className="empty-history">
            <p>Nenhuma nota fiscal processada ainda.</p>
          </div>
        ) : (
          <div className="history-list">
            {history.map((item) => {
              // CORREÇÃO: Acesso seguro aos dados
              const safeItem = item || {};
              const fornecedor = getPreviewValue(safeItem, 'fornecedor');
              const numeroNota = getPreviewValue(safeItem, 'numeroNota');
              const valorTotal = getPreviewValue(safeItem, 'valorTotal');
              const dataEmissao = getPreviewValue(safeItem, 'dataEmissao');
              const tipoConta = getPreviewValue(safeItem, 'tipoConta');
              const fileName = safeItem.fileName || 'Arquivo sem nome';

              return (
                <div 
                  key={safeItem.id} 
                  className="history-item"
                  onClick={() => handleViewNote(safeItem.id)}
                >
                  <div className="history-item-content">
                    <div className="history-item-main">
                      {/* CORREÇÃO: Acesso seguro ao fornecedor */}
                      <h4>{fornecedor !== 'N/A' ? fornecedor : 'Fornecedor não identificado'}</h4>
                      <p className="file-name">{fileName}</p>
                      <div className="history-details">
                        <span>NF: {numeroNota}</span>
                        <span>Valor: {formatCurrency(valorTotal)}</span>
                        <span>Emissão: {dataEmissao}</span>
                        <span>Tipo: {formatTipoConta(tipoConta)}</span>
                      </div>
                    </div>
                    <div className="history-item-actions">
                      <span className="history-date">
                        {safeItem.processedAt ? formatDate(safeItem.processedAt) : 'Data desconhecida'}
                      </span>
                      <button 
                        className="delete-button"
                        onClick={(e) => handleDeleteNote(safeItem.id, e)}
                        title="Excluir do histórico"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="history-footer">
          <p>Total: {history.length} nota(s) processada(s)</p>
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;