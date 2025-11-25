import React, { useEffect, useState } from 'react';
import { listClassificacao, createClassificacao, updateClassificacao, deleteClassificacao } from '../services/api';

export default function CategoriesPage() {
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState(''); // RECEITA | DESPESA
  const [status, setStatus] = useState('ATIVO'); // ATIVO | INATIVO | TODOS
  const [rows, setRows] = useState([]);
  const [sortBy, setSortBy] = useState('descricao');
  const [sortOrder, setSortOrder] = useState('asc');
  const [novo, setNovo] = useState({ tipo: '', nome: '' });
  const [editId, setEditId] = useState(null);
  const [editFields, setEditFields] = useState({ nome: '', descricao: '' });

  const buscar = async () => {
    try {
      const data = await listClassificacao({ q, tipo, status, sort: sortBy, order: sortOrder });
      setRows(data.data || []);
    } catch (err) {
      console.error('Falha ao buscar categorias:', err);
      setRows([]);
    }
  };

  useEffect(() => { buscar(); }, []);

  const ordenar = async (key) => {
    const nextOrder = sortBy === key && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(key); setSortOrder(nextOrder); await buscar();
  };

  const criar = async () => {
    if (!novo.tipo || !novo.nome) { alert('Informe tipo e nome'); return; }
    try { await createClassificacao({ tipo: novo.tipo, nome: novo.nome }); setNovo({ tipo: '', nome: '' }); await buscar(); }
    catch (err) { console.error(err); alert('Erro ao criar categoria'); }
  };

  const iniciarEdicao = (row) => {
    setEditId(row.id);
    setEditFields({ nome: row.nome || '', descricao: row.descricao || '' });
  };

  const salvarEdicao = async () => {
    try { await updateClassificacao(editId, { ...editFields }); setEditId(null); await buscar(); }
    catch (err) { console.error(err); alert('Erro ao salvar edição'); }
  };

  const cancelarEdicao = () => setEditId(null);

  const inativar = async (id) => {
    if (!window.confirm('Inativar esta categoria?')) return;
    try { await deleteClassificacao(id); await buscar(); }
    catch (err) { console.error(err); alert('Erro ao inativar'); }
  };

  return (
    <div>
      <div className="card">
        <h2>Categorias</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input className="input" placeholder="Buscar por nome/descrição" value={q} onChange={(e)=>setQ(e.target.value)} />
          <select className="select" value={tipo} onChange={(e)=>setTipo(e.target.value)}>
            <option value="">Tipo</option>
            <option value="RECEITA">Receita</option>
            <option value="DESPESA">Despesa</option>
          </select>
          <select className="select" value={status} onChange={(e)=>setStatus(e.target.value)}>
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
            <option value="TODOS">Todos</option>
          </select>
          <button className="btn btn-primary" onClick={buscar}>🔎 Buscar</button>
          <button className="btn" onClick={()=>{ setQ(''); setTipo(''); setStatus('ATIVO'); setTimeout(()=>buscar(),0); }}>↺ Resetar</button>
        </div>
      </div>

      <div className="card">
        <h3>Lista de Categorias</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {['id','nome','descricao','tipo','ativo','data_cadastro'].map((col)=> (
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
                <tr><td className="empty" colSpan={7}>Nenhuma categoria.</td></tr>
              ) : rows.map((r)=> (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{editId === r.id ? (
                    <input className="input" value={editFields.nome} onChange={(e)=>setEditFields(s=>({...s, nome: e.target.value}))} />
                  ) : (r.nome || r.descricao)}</td>
                  <td>{editId === r.id ? (
                    <input className="input" value={editFields.descricao} onChange={(e)=>setEditFields(s=>({...s, descricao: e.target.value}))} />
                  ) : r.descricao}</td>
                  <td>{r.tipo}</td>
                  <td>{r.ativo ? 'ATIVO' : 'INATIVO'}</td>
                  <td>{r.data_cadastro ? new Date(r.data_cadastro).toLocaleString() : ''}</td>
                  <td>
                    <div className="actions">
                      {editId === r.id ? (
                        <>
                          <button className="btn btn-success" onClick={salvarEdicao}>💾 Salvar</button>
                          <button className="btn" onClick={cancelarEdicao}>↩️ Cancelar</button>
                        </>
                      ) : (
                        <button className="btn btn-primary" onClick={()=>iniciarEdicao(r)}>✏️ Editar</button>
                      )}
                      <button className="btn btn-danger" onClick={()=>inativar(r.id)}>🗑️ Inativar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Nova Categoria</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="select" value={novo.tipo} onChange={(e)=>setNovo(s=>({...s, tipo: e.target.value}))}>
            <option value="">Tipo</option>
            <option value="RECEITA">Receita</option>
            <option value="DESPESA">Despesa</option>
          </select>
          <input className="input" placeholder="Nome" value={novo.nome} onChange={(e)=>setNovo(s=>({...s, nome: e.target.value}))} />
          <button className="btn btn-success" onClick={criar}>➕ Criar</button>
        </div>
      </div>
    </div>
  );
}