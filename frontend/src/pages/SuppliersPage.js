import React, { useEffect, useState } from 'react';
import { listPessoas, createPessoa, updatePessoa, deletePessoa } from '../services/api';

export default function SuppliersPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [novo, setNovo] = useState({ razaoSocial: '', nomeFantasia: '', cnpjCpf: '' });
  const [editId, setEditId] = useState(null);
  const [editFields, setEditFields] = useState({ razaoSocial: '', nomeFantasia: '', cnpjCpf: '' });
  const [sort, setSort] = useState('razao_social');
  const [order, setOrder] = useState('asc');

  const buscar = async () => {
    try {
      const data = await listPessoas({ q, tipo: 'FORNECEDOR', status: 'ATIVO', sort, order });
      setRows(data.data || []);
    } catch (err) {
      console.error('Erro ao listar fornecedores:', err);
      setRows([]);
    }
  };

  useEffect(() => { buscar(); }, []);

  const criar = async () => {
    if (!novo.razaoSocial) { alert('Informe razão social'); return; }
    try { await createPessoa({ tipo: 'FORNECEDOR', ...novo }); setNovo({ razaoSocial: '', nomeFantasia: '', cnpjCpf: '' }); await buscar(); }
    catch (err) { console.error(err); alert('Erro ao criar fornecedor'); }
  };

  const iniciarEdicao = (r) => {
    setEditId(r.id);
    setEditFields({ razaoSocial: r.razao_social || '', nomeFantasia: r.nome_fantasia || '', cnpjCpf: r.cnpj_cpf || '' });
  };

  const salvarEdicao = async () => {
    try { await updatePessoa(editId, { ...editFields }); setEditId(null); await buscar(); }
    catch (err) { console.error(err); alert('Erro ao salvar edição'); }
  };

  const inativar = async (id) => {
    if (!window.confirm('Inativar este fornecedor?')) return;
    try { await deletePessoa(id); await buscar(); }
    catch (err) { console.error(err); alert('Erro ao inativar'); }
  };

  return (
    <div>
      <div className="card">
        <h2>Fornecedores</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input className="input" placeholder="Buscar" value={q} onChange={(e)=>setQ(e.target.value)} />
          <button className="btn btn-primary" onClick={buscar}>🔎 Buscar</button>
        </div>
      </div>

      <div className="card">
        <h3>Lista de Fornecedores</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th onClick={()=>toggleSort('razao_social')}>Razão Social{sort==='razao_social' ? (order==='asc' ? ' ▲' : ' ▼') : ''}</th>
                <th onClick={()=>toggleSort('nome_fantasia')}>Nome Fantasia{sort==='nome_fantasia' ? (order==='asc' ? ' ▲' : ' ▼') : ''}</th>
                <th onClick={()=>toggleSort('cnpj_cpf')}>CNPJ/CPF{sort==='cnpj_cpf' ? (order==='asc' ? ' ▲' : ' ▼') : ''}</th>
                <th onClick={()=>toggleSort('data_cadastro')}>Data Cadastro{sort==='data_cadastro' ? (order==='asc' ? ' ▲' : ' ▼') : ''}</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td className="empty" colSpan={6}>Nenhum fornecedor.</td></tr>
              ) : rows.map((r)=> (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{editId === r.id ? (
                    <input className="input" value={editFields.razaoSocial} onChange={(e)=>setEditFields(s=>({...s, razaoSocial: e.target.value}))} />
                  ) : r.razao_social}</td>
                  <td>{editId === r.id ? (
                    <input className="input" value={editFields.nomeFantasia} onChange={(e)=>setEditFields(s=>({...s, nomeFantasia: e.target.value}))} />
                  ) : (r.nome_fantasia || '')}</td>
                  <td>{editId === r.id ? (
                    <input className="input" value={editFields.cnpjCpf} onChange={(e)=>setEditFields(s=>({...s, cnpjCpf: e.target.value}))} />
                  ) : (r.cnpj_cpf || '')}</td>
                  <td>{r.data_cadastro ? new Date(r.data_cadastro).toLocaleString() : ''}</td>
                  <td>
                    <div className="actions">
                      {editId === r.id ? (
                        <>
                          <button className="btn btn-success" onClick={salvarEdicao}>💾 Salvar</button>
                          <button className="btn" onClick={()=>setEditId(null)}>↩️ Cancelar</button>
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
        <h3>Novo Fornecedor</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="input" placeholder="Razão Social" value={novo.razaoSocial} onChange={(e)=>setNovo(s=>({...s, razaoSocial: e.target.value}))} />
          <input className="input" placeholder="Nome Fantasia" value={novo.nomeFantasia} onChange={(e)=>setNovo(s=>({...s, nomeFantasia: e.target.value}))} />
          <input className="input" placeholder="CNPJ/CPF" value={novo.cnpjCpf} onChange={(e)=>setNovo(s=>({...s, cnpjCpf: e.target.value}))} />
          <button className="btn btn-success" onClick={criar}>➕ Criar</button>
        </div>
      </div>
    </div>
  );
}
  const toggleSort = (col) => {
    const nextOrder = sort === col && order === 'asc' ? 'desc' : 'asc';
    setSort(col);
    setOrder(nextOrder);
    setTimeout(() => buscar(), 0);
  };
