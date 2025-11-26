import React from 'react';
import './Sidebar.css';

const menuItems = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'contas', label: 'Contas', icon: '💼' },
  { key: 'transacoes', label: 'Transações', icon: '🔎' },
  { key: 'categorias', label: 'Categorias', icon: '🏷️' },
  { key: 'relatorios', label: 'Relatórios', icon: '📝' },
  { key: 'processar_notas', label: 'Processar Notas', icon: '📄' },
  { key: 'clientes', label: 'Clientes', icon: '👤' },
  { key: 'fornecedores', label: 'Fornecedores', icon: '🏭' },
];

export default function Sidebar({ active, onNavigate, user, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="user-avatar">GF</div>
        <div className="user-info">
          <div className="user-name">{user?.user || 'Usuário'}</div>
          <div className="user-role">{user ? 'Autenticado' : 'Visitante'}</div>
        </div>
        <button className="logout-btn" title="Sair" onClick={onLogout}>⎋</button>
      </div>
      <nav className="sidebar-menu">
        {menuItems.map((item) => (
          <button
            key={item.key}
            className={`menu-item ${active === item.key ? 'active' : ''}`}
            onClick={() => onNavigate(item.key)}
          >
            <span className="icon" aria-hidden>{item.icon}</span>
            <span className="label">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
