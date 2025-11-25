import React, { useState } from 'react';
import { listMovimentos, deleteMovimento, updateMovimento } from '../services/api';

export default function AccountsPage() {
  const [q, setQ] = useState('');
  const [periodo, setPeriodo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [pessoaTipo, setPessoaTipo] = useState('');
  const [tipo, setTipo] = useState(''); // Entrada | Saída | ''
  const [status, setStatus] = useState(''); // Pago | Pendente | ''
  const [rows, setRows] = useState([]);
  const [sortBy, setSortBy] = useState('data');
  const [sortOrder, setSortOrder] = useState('asc');
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({ observacao: '', valor_total: '', tipo: '', data_emissao: '' });

  const buscar = async () => {
    try {
      const params = { q, periodo, sort: sortBy, order: sortOrder };
      if (categoria) params.categoria = categoria;
      if (pessoaTipo) params.pessoa_tipo = pessoaTipo;
      if (tipo) params.tipo = tipo;
      if (status) params.status = status;
      const data = await listMovimentos(params);
      setRows(data.items || []);
    } catch (err) {
      console.error('Falha ao buscar contas:', err);
      setRows([]);
    }
  };

  const resetar = () => {
    setQ(''); setPeriodo(''); setCategoria(''); setPessoaTipo(''); setTipo(''); setStatus('');
    setTimeout(() => buscar(), 0);
  };

  const ordenar = async (key) => {
    const nextOrder = sortBy === key && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(key); setSortOrder(nextOrder); await buscar();
  };

  const excluir = async (id) => {
    if (!window.confirm('Excluir este movimento?')) return;
    try { await deleteMovimento(id); await buscar(); } catch (err) { console.error(err); alert('Erro ao excluir'); }
  };

  const iniciarEdicao = (r) => {
    setEditingId(r.id);
    setEditFields({
      observacao: r.descricao || '',
      valor_total: r.valor || '',
      tipo: r.tipo || '',
      data_emissao: (r.data || '').slice(0,10),
    });
  };

  const salvarEdicao = async () => {
    try { await updateMovimento(editingId, { ...editFields }); setEditingId(null); await buscar(); }
    catch (err) { console.error(err); alert('Erro ao salvar edição'); }
  };

  const cancelarEdicao = () => setEditingId(null);

  return (
    <div>
      <div className="card">
        <h2>Contas (Receber + Pagar)</h2>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button className={`btn ${tipo === '' ? 'btn-primary' : ''}`} onClick={()=>{ setTipo(''); setTimeout(()=>buscar(),0); }}>Todas</button>
          <button className={`btn ${tipo === 'Entrada' ? 'btn-primary' : ''}`} onClick={()=>{ setTipo('Entrada'); setTimeout(()=>buscar(),0); }}>Receber</button>
          <button className={`btn ${tipo === 'Saída' ? 'btn-primary' : ''}`} onClick={()=>{ setTipo('Saída'); setTimeout(()=>buscar(),0); }}>Pagar</button>
        </div>
        <div className="filters" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input className="input" placeholder="Pesquisar" value={q} onChange={(e)=>setQ(e.target.value)} />
          <input className="input" placeholder="Categoria" value={categoria} onChange={(e)=>setCategoria(e.target.value)} style={{ maxWidth: 220 }} />
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
            <option value="">Tipo (Todos)</option>
            <option value="Entrada">Entrada (Receber)</option>
            <option value="Saída">Saída (Pagar)</option>
          </select>
          <select className="select" value={status} onChange={(e)=>setStatus(e.target.value)}>
            <option value="">Status</option>
            <option value="Pago">Pago</option>
            <option value="Pendente">Pendente</option>
          </select>
          <button className="btn btn-primary" onClick={buscar}>🔎 Buscar</button>
          <button className="btn btn-success" onClick={resetar}>📋 Todas</button>
        </div>
      </div>

      <div className="card">
        <h2>Lista de Movimentos</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {['data','descricao','categoria','tipo','valor','status','pessoa'].map((col)=> (
                  <th key={col} onClick={()=>ordenar(col)}>
                    {col.charAt(0).toUpperCase() + col.slice(1)}
                    {sortBy === col && (<span className="sort">{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>)}
                  </th>
                ))}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td className="empty" colSpan={8}>Nenhum movimento encontrado.</td></tr>
              ) : rows.map((r)=> (
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
                  ) : Number(r.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td>{r.status}</td>
                  <td>{r.pessoa}</td>
                  <td>
                    <div className="actions">
                      {editingId === r.id ? (
                        <>
                          <button className="btn btn-success" onClick={salvarEdicao}>💾 Salvar</button>
                          <button className="btn" onClick={cancelarEdicao}>↩️ Cancelar</button>
                        </>
                      ) : (
                        <button className="btn btn-primary" onClick={()=>iniciarEdicao(r)}>✏️ Editar</button>
                      )}
                      <button className="btn btn-danger" onClick={()=>excluir(r.id)}>🗑️ Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}