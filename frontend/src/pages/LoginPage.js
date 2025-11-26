import React, { useState } from 'react';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    // Autenticação simples (frontend). Pode ser trocada por backend.
    const validUser = (username || '').trim().toLowerCase();
    const validPass = (password || '').trim();
    if (validUser === 'admin' && validPass === '1234') {
      localStorage.setItem('auth_token', 'local-demo-token');
      onLogin({ user: 'admin' });
    } else {
      setError('Credenciais inválidas. Use admin / 1234 para demo.');
    }
  };

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div className="card" style={{ width: 420, padding: 0, overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)', color: '#fff', padding: '24px 24px 18px 24px' }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>LSR - NF</div>
          <div style={{ marginTop: 6, color: '#9ca3af' }}>Bem-vindo</div>
        </div>
        <form onSubmit={submit} style={{ padding: 16 }}>
          <p style={{ color: '#6b7280', marginBottom: 12 }}>Autentique-se para acessar o sistema.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className="input" placeholder="Usuário" value={username} onChange={(e)=>setUsername(e.target.value)} />
            <input className="input" placeholder="Senha" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
            {error && (<div style={{ color: '#dc2626', fontSize: 13 }}>{error}</div>)}
            <button className="btn btn-primary" type="submit">Entrar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
