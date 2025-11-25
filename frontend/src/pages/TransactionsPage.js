import React, { useState } from 'react';
import './TransactionsPage.css';
import { listMovimentos, deleteMovimento, updateMovimento, createMovimento } from '../services/api';

export default function TransactionsPage() {
  const [q, setQ] = useState('');
  const [periodo, setPeriodo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [pessoaTipo, setPessoaTipo] = useState('');
  const [tipo, setTipo] = useState(''); // Entrada | Saída
  const [status, setStatus] = useState(''); // Pago | Pendente
  const [rows, setRows] = useState([]); // inicia vazia
  const [sortBy, setSortBy] = useState('data');
  const [sortOrder, setSortOrder] = useState('asc');
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({ observacao: '', valor_total: '', tipo: '', data_emissao: '' });
  const [newFields, setNewFields] = useState({ observacao: '', valor_total: '', tipo: '', data_emissao: '' });

  const handleBuscar = async () => {
    try {
      const params = { q, periodo, sort: sortBy, order: sortOrder };
      if (categoria) params.categoria = categoria;
      if (pessoaTipo) params.pessoa_tipo = pessoaTipo;
      if (tipo) params.tipo = tipo; // Backend aceita Entrada/Saída
      if (status) params.status = status; // Backend aceita Pago/Pendente
      const data = await listMovimentos(params);
      setRows(data.items || []);
    } catch (err) {
      console.error('Falha ao buscar movimentos:', err);
      setRows([]);
    }
  };

  const handleTodos = () => {
    setQ('');
    setPeriodo('');
    setCategoria('');
    setPessoaTipo('');
    setTipo('');
    setStatus('');
    setTimeout(() => handleBuscar(), 0);
  };

  const handleSort = async (key) => {
    const nextOrder = sortBy === key && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(key);
    setSortOrder(nextOrder);
    await handleBuscar();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir esta transação?')) return;
    try {
      await deleteMovimento(id);
      await handleBuscar();
    } catch (err) {
      console.error('Falha ao excluir movimento:', err);
      alert('Erro ao excluir');
    }
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setEditFields({
      observacao: r.descricao || '',
      valor_total: r.valor || '',
      tipo: r.tipo || '',
      data_emissao: (r.data || '').slice(0,10),
    });
  };

  const commitEdit = async () => {
    try {
      const body = { ...editFields };
      await updateMovimento(editingId, body);
      setEditingId(null);
      await handleBuscar();
    } catch (err) {
      console.error('Falha ao atualizar movimento:', err);
      alert('Erro ao salvar edição');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const createNew = async () => {
    try {
      const body = { ...newFields };
      if (!body.valor_total || !body.data_emissao) {
        alert('Informe valor e data');
        return;
      }
      await createMovimento(body);
      setNewFields({ observacao: '', valor_total: '', tipo: '', data_emissao: '' });
      await handleBuscar();
    } catch (err) {
      console.error('Falha ao criar movimento:', err);
      alert('Erro ao inserir');
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
    a.href = url;
    a.download = 'transacoes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="card">
        <h2>Buscar Transações</h2>
        <div className="filters">
          <input
            className="input"
            placeholder="Filtrar por descrição, categoria, data, valor"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
          />
          <input
            className="input"
            placeholder="Categoria (nome ou ID)"
            value={categoria}
            onChange={(e)=>setCategoria(e.target.value)}
            style={{ maxWidth: 220 }}
          />
          <select className="select" value={pessoaTipo} onChange={(e)=>setPessoaTipo(e.target.value)}>
            <option value="">Pessoa (Todos)</option>
            <option value="CLIENTE">Cliente</option>
            <option value="FORNECEDOR">Fornecedor</option>
            <option value="FATURADO">Faturado</option>
          </select>
          <select className="select" value={periodo} onChange={(e)=>setPeriodo(e.target.value)}>
            <option value="">Período</option>
            <option value="hoje">Hoje</option>
            <option value="7d">7 dias</option>
            <option value="30d">30 dias</option>
          </select>
          <select className="select" value={tipo} onChange={(e)=>setTipo(e.target.value)}>
            <option value="">Tipo</option>
            <option value="Entrada">Entrada</option>
            <option value="Saída">Saída</option>
          </select>
          <select className="select" value={status} onChange={(e)=>setStatus(e.target.value)}>
            <option value="">Status</option>
            <option value="Pago">Pago</option>
            <option value="Pendente">Pendente</option>
          </select>
          <button className="btn btn-primary" onClick={handleBuscar}>🔎 Buscar</button>
          <button className="btn btn-success" onClick={handleTodos}>📋 Todas</button>
        </div>
      </div>

      <div className="card">
        <h2>Lista de Transações</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {['data','descricao','categoria','tipo','valor','status'].map((col)=> (
                  <th key={col} onClick={()=>handleSort(col)}>
                    {col.charAt(0).toUpperCase() + col.slice(1)}
                    {sortBy === col && (<span className="sort">{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>)}
                  </th>
                ))}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="empty" colSpan={7}>Nenhuma transação encontrada.</td>
                </tr>
              ) : (
                rows.map((r)=> (
                  <tr key={r.id}>
                    <td>{editingId === r.id ? (
                      <input className="input" value={editFields.data_emissao} onChange={(e)=>setEditFields(s=>({...s, data_emissao: e.target.value}))} />
                    ) : r.data}</td>
                    <td>{editingId === r.id ? (
                      <input className="input" value={editFields.observacao} onChange={(e)=>setEditFields(s=>({...s, observacao: e.target.value}))} />
                    ) : r.descricao}</td>
                    <td>{r.categoria}</td>
                    <td>{editingId === r.id ? (
                      <select className="select" value={editFields.tipo} onChange={(e)=>setEditFields(s=>({...s, tipo: e.target.value}))}>
                        <option value="">Tipo</option>
                        <option value="Entrada">Entrada</option>
                        <option value="Saída">Saída</option>
                      </select>
                    ) : r.tipo}</td>
                    <td>{editingId === r.id ? (
                      <input className="input" type="number" step="0.01" value={editFields.valor_total} onChange={(e)=>setEditFields(s=>({...s, valor_total: e.target.value}))} />
                    ) : r.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td>{r.status}</td>
                    <td>
                      <div className="actions">
                        {editingId === r.id ? (
                          <>
                            <button className="btn btn-success" onClick={commitEdit}>💾 Salvar</button>
                            <button className="btn" onClick={cancelEdit}>↩️ Cancelar</button>
                          </>
                        ) : (
                          <button className="btn btn-primary" onClick={()=>startEdit(r)}>✏️ Editar</button>
                        )}
                        <button className="btn btn-danger" onClick={()=>handleDelete(r.id)}>🗑️ Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="footer-actions" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={exportCsv}>⬇️ Exportar CSV</button>
          <span style={{ opacity: 0.7 }}>Novo movimento:</span>
          <input className="input" placeholder="Descrição" value={newFields.observacao} onChange={(e)=>setNewFields(s=>({...s, observacao: e.target.value}))} />
          <input className="input" type="date" value={newFields.data_emissao} onChange={(e)=>setNewFields(s=>({...s, data_emissao: e.target.value}))} />
          <select className="select" value={newFields.tipo} onChange={(e)=>setNewFields(s=>({...s, tipo: e.target.value}))}>
            <option value="">Tipo</option>
            <option value="Entrada">Entrada</option>
            <option value="Saída">Saída</option>
          </select>
          <input className="input" type="number" step="0.01" placeholder="Valor" value={newFields.valor_total} onChange={(e)=>setNewFields(s=>({...s, valor_total: e.target.value}))} />
          <button className="btn btn-success" onClick={createNew}>➕ Inserir Nova Transação</button>
        </div>
      </div>
    </div>
  );
}