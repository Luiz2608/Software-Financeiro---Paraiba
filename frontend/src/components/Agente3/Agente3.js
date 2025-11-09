import React, { useState } from 'react';
import axios from 'axios';
import './Agente3.css';

const Agente3 = () => {
    const [pergunta, setPergunta] = useState('');
    const [resposta, setResposta] = useState('');
    const [carregando, setCarregando] = useState(false);

    const fazerPergunta = async () => {
        if (!pergunta.trim()) return;

        setCarregando(true);
        try {
            const response = await axios.post('http://localhost:3000/api/agente3/perguntar', {
                pergunta: pergunta
            });

            if (response.data.success) {
                setResposta(response.data.resposta);
            } else {
                setResposta(`Erro: ${response.data.error}`);
            }

        } catch (error) {
            setResposta('Erro ao conectar com o servidor');
        } finally {
            setCarregando(false);
        }
    };

    return (
        <div className="agente3-container">
            <h1>🤖 Agente3 - Faça Perguntas</h1>
            
            <div className="agente3-input">
                <textarea
                    value={pergunta}
                    onChange={(e) => setPergunta(e.target.value)}
                    placeholder="Ex: Qual o total de vendas? Quantas contas a pagar existem? Mostre as parcelas..."
                    rows="3"
                />
                <button onClick={fazerPergunta} disabled={carregando}>
                    {carregando ? 'Processando...' : 'Perguntar'}
                </button>
            </div>

            {carregando && <p>⚡ Processando sua pergunta...</p>}

            {resposta && (
                <div className="agente3-resposta">
                    <h3>Resposta:</h3>
                    <p>{resposta}</p>
                </div>
            )}
        </div>
    );
};

export default Agente3;