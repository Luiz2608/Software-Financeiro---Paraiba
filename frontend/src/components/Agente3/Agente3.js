import React, { useState } from 'react';
import { agente3Consulta, agente3Indexar } from '../../services/api';
import './Agente3.css';

const Agente3 = () => {
    const [pergunta, setPergunta] = useState('');
    const [resposta, setResposta] = useState('');
    const [carregando, setCarregando] = useState(false);
    const [ragTipo, setRagTipo] = useState('simples');
    const [apiKey, setApiKey] = useState('');
    const [indexando, setIndexando] = useState(false);
    const [indexStatus, setIndexStatus] = useState('');

    const fazerPergunta = async () => {
        if (!apiKey || !apiKey.trim()) return;
        if (!pergunta.trim()) return;

        setCarregando(true);
        try {
            window.__GEMINI_API_KEY__ = apiKey || '';
            const response = await agente3Consulta(pergunta, ragTipo);
            if (response.success) {
                setResposta(response.resposta);
            } else {
                setResposta(`Erro: ${response.error}`);
            }

        } catch (error) {
            setResposta('Erro ao conectar com o servidor');
        } finally {
            setCarregando(false);
        }
    };

    const construirBase = async () => {
        if (!apiKey || !apiKey.trim()) return;
        setIndexando(true);
        setIndexStatus('');
        try {
            window.__GEMINI_API_KEY__ = apiKey || '';
            const r = await agente3Indexar();
            setIndexStatus(`Base indexada: ${r.indexed || 0} documentos`);
        } catch (e) {
            setIndexStatus('Falha ao indexar base');
        } finally {
            setIndexando(false);
        }
    };

    const mudarRagTipo = (novoTipo) => {
        setRagTipo(novoTipo);
        setResposta(''); // Limpa a resposta anterior ao mudar o tipo
    };

    return (
        <div className="agente3-container">
            <h1>🤖 Agente3 - Faça Perguntas</h1>
            
            {/* Seletor de Tipo de RAG */}
            <div className="rag-selector">
                <h3>Selecione o tipo de RAG:</h3>
                <div className="rag-buttons">
                    <button
                        className={`rag-button ${ragTipo === 'simples' ? 'active' : ''}`}
                        onClick={() => mudarRagTipo('simples')}
                        disabled={carregando}
                    >
                        🔍 RAG Simples
                    </button>
                    <button
                        className={`rag-button ${ragTipo === 'embeddings' ? 'active' : ''}`}
                        onClick={() => mudarRagTipo('embeddings')}
                        disabled={carregando}
                    >
                        🧠 RAG com Embeddings
                    </button>
                </div>
                <div className="rag-indicator">
                    Modo selecionado: <strong>
                        {ragTipo === 'simples' ? 'RAG Simples (Busca por palavras-chave)' : 'RAG com Embeddings (Busca semântica)'}
                    </strong>
                </div>
                <div className="rag-description">
                    {ragTipo === 'simples' 
                        ? '🔍 Busca por correspondência exata de termos e palavras-chave'
                        : '🧠 Busca semântica que compreende o significado e contexto da pergunta'
                    }
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
                    <button className="history-button" onClick={construirBase} disabled={indexando || !apiKey.trim()}>
                        {indexando ? 'Indexando...' : 'Construir Base'}
                    </button>
                    {indexStatus && (<span style={{ color: '#2563eb' }}>{indexStatus}</span>)}
                </div>
            </div>

            <div className="agente3-input">
                <input
                    type="password"
                    placeholder="Informe sua Gemini API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="text-input"
                    style={{ marginBottom: 8 }}
                />
                <textarea
                    value={pergunta}
                    onChange={(e) => setPergunta(e.target.value)}
                    placeholder={
                        ragTipo === 'simples' 
                            ? "Ex: Qual o total de vendas? Quantas contas a pagar existem? (Use termos específicos)"
                            : "Ex: Me mostre as vendas do último trimestre. Quais são nossas obrigações financeiras? (Pergunte de forma natural)"
                    }
                    rows="3"
                />
                <button onClick={fazerPergunta} disabled={carregando || !apiKey.trim()}>
                    {carregando ? 'Processando...' : 'Perguntar'}
                </button>
            </div>

            {carregando && (
                <div className="carregando">
                    ⚡ Processando sua pergunta com {ragTipo === 'simples' ? 'RAG Simples' : 'RAG com Embeddings'}...
                </div>
            )}

            {resposta && (
                <div className="agente3-resposta">
                    <div className="resposta-header">
                        <h3>Resposta:</h3>
                        <span className="rag-badge">
                            {ragTipo === 'simples' ? '🔍 RAG Simples' : '🧠 RAG com Embeddings'}
                        </span>
                    </div>
                    <p>{resposta}</p>
                </div>
            )}
        </div>
    );
};

export default Agente3;
