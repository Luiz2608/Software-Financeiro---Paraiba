import React, { useState } from 'react';
import { listMovimentos } from '../services/api';

export default function ReportsPage() {
  const [periodo, setPeriodo] = useState('30d');
  const [categoria, setCategoria] = useState('');
  const [tipo, setTipo] = useState('');
  const [rows, setRows] = useState([]);

  const buscar = async () => {
    try {
      const params = { periodo };
      if (categoria) params.categoria = categoria;
      if (tipo) params.tipo = tipo;
      const data = await listMovimentos(params);
      setRows(data.items || []);
    } catch (err) {
      console.error('Erro ao buscar para relatório:', err);
      setRows([]);
    }
  };

  const exportCsv = () => {
    const header = ['ID','Data','Descrição','Categoria','Tipo','Valor','Status','Pessoa'];
    const lines = rows.map(r => [r.id, r.data, r.descricao, r.categoria, r.tipo, r.valor, r.status, r.pessoa]
      .map(v => typeof v === 'string' ? '"' + v.replace(/"/g,'""') + '"' : String(v)).join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'relatorio_movimentos.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const resumoPorCategoria = () => {
    const mapa = new Map();
    rows.forEach(r => {
      const cat = r.categoria || 'SEM_CATEGORIA';
      const valor = Number(r.valor || 0) || 0;
      mapa.set(cat, (mapa.get(cat) || 0) + valor);
    });
    return Array.from(mapa.entries()).sort((a,b)=> b[1]-a[1]);
  };

  const moeda = (v) => (Number(v)||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div>
      <div className="card">
        <h2>Relatórios</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="select" value={periodo} onChange={(e)=>setPeriodo(e.target.value)}>
            <option value="hoje">Hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="">Todos</option>
          </select>
          <input className="input" placeholder="Categoria (nome ou ID)" value={categoria} onChange={(e)=>setCategoria(e.target.value)} style={{ maxWidth: 220 }} />
          <select className="select" value={tipo} onChange={(e)=>setTipo(e.target.value)}>
            <option value="">Tipo</option>
            <option value="Entrada">Entrada</option>
            <option value="Saída">Saída</option>
          </select>
          <button className="btn btn-primary" onClick={buscar}>🔎 Buscar</button>
          <button className="btn btn-success" onClick={exportCsv} disabled={rows.length===0}>⬇️ Exportar CSV</button>
        </div>
      </div>

      <div className="card">
        <h3>Resumo por Categoria</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {resumoPorCategoria().length === 0 ? (
                <tr><td className="empty" colSpan={2}>Sem dados.</td></tr>
              ) : resumoPorCategoria().map(([cat, total]) => (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td>{moeda(total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}