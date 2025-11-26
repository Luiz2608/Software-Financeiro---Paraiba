import React, { useState } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import TransactionsPage from './pages/TransactionsPage';
import InvoiceProcessor from './components/InvoiceProcessor';
import DashboardPage from './pages/DashboardPage';
import AccountsPage from './pages/AccountsPage';
import CategoriesPage from './pages/CategoriesPage';
import ReportsPage from './pages/ReportsPage';
import ClientsPage from './pages/ClientsPage';
import SuppliersPage from './pages/SuppliersPage';
import LoginPage from './pages/LoginPage';

function Placeholder({ title, description }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p style={{ color: '#6b7280' }}>{description}</p>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState('dashboard');
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('auth_token');
    return token ? { user: 'admin' } : null;
  });

  if (!auth) {
    return <LoginPage onLogin={(user)=>{ setAuth(user); setActive('dashboard'); }} />;
  }

  return (
    <div className="layout">
      <Sidebar active={active} onNavigate={setActive} user={auth} onLogout={() => { localStorage.removeItem('auth_token'); setAuth(null); }} />
      <main className="content">
        {active === 'dashboard' && (
          <DashboardPage />
        )}

        {active === 'processar_notas' && (
          <InvoiceProcessor />
        )}

        {active === 'transacoes' && (
          <TransactionsPage />
        )}

        {active === 'contas' && (
          <AccountsPage />
        )}


        {active === 'categorias' && (
          <CategoriesPage />
        )}

        {active === 'clientes' && (
          <ClientsPage />
        )}

        {active === 'fornecedores' && (
          <SuppliersPage />
        )}

        {active === 'relatorios' && (
          <ReportsPage />
        )}

        
      </main>
    </div>
  );
}
