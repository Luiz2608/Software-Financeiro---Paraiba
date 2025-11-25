import React, { useEffect, useState } from 'react';
import { listMovimentos } from '../services/api';

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState('30d');
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState({
    totalReceber: 0,
    totalPagar: 0,
    recebidos: 0,
    pagos: 0,
    pendentesReceber: 0,
    pendentesPagar: 0,
    qtdMovimentos: 0,
  });

  const carregar = async () => {
    setLoading(true);
    try {
      const data = await listMovimentos({ periodo, order: 'desc', sort: 'data' });
      const rows = data.items || [];
      let totalReceber = 0, totalPagar = 0, recebidos = 0, pagos = 0, pendentesReceber = 0, pendentesPagar = 0;
      rows.forEach(r => {
        const valor = Number(r.valor || r.valor_total || 0) || 0;
        const isEntrada = (r.tipo || '').toLowerCase().startsWith('entr');
        const isPago = (r.status || '').toLowerCase() === 'pago';
        if (isEntrada) {
          totalReceber += valor;
          if (isPago) recebidos += valor; else pendentesReceber += valor;
        } else {
          totalPagar += valor;
          if (isPago) pagos += valor; else pendentesPagar += valor;
        }
      });
      setKpis({ totalReceber, totalPagar, recebidos, pagos, pendentesReceber, pendentesPagar, qtdMovimentos: rows.length });
    } catch (err) {
      console.error('Erro ao carregar KPIs:', err);
      setKpis({ totalReceber: 0, totalPagar: 0, recebidos: 0, pagos: 0, pendentesReceber: 0, pendentesPagar: 0, qtdMovimentos: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [periodo]);

  const moeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div>
      <div className="card">
        <h2>Dashboard</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="select" value={periodo} onChange={(e)=>setPeriodo(e.target.value)}>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="hoje">Hoje</option>
            <option value="">Todos</option>
          </select>
          <button className="btn btn-primary" onClick={carregar} disabled={loading}>{loading ? 'Carregando...' : 'Atualizar'}</button>
        </div>
      </div>

      <div className="card">
        <h3>Resumo</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <KPI title="A Receber" value={moeda(kpis.totalReceber)} icon="💰" color="#2563eb" />
          <KPI title="A Pagar" value={moeda(kpis.totalPagar)} icon="💸" color="#dc2626" />
          <KPI title="Recebido" value={moeda(kpis.recebidos)} icon="✅" color="#16a34a" />
          <KPI title="Pago" value={moeda(kpis.pagos)} icon="✅" color="#16a34a" />
          <KPI title="Receber Pendente" value={moeda(kpis.pendentesReceber)} icon="⏳" color="#f59e0b" />
          <KPI title="Pagar Pendente" value={moeda(kpis.pendentesPagar)} icon="⏳" color="#f59e0b" />
          <KPI title="Movimentos" value={String(kpis.qtdMovimentos)} icon="📊" color="#6b7280" />
        </div>
      </div>
    </div>
  );
}

function KPI({ title, value, icon, color }) {
  return (
    <div className="card" style={{ borderLeft: `6px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: '#6b7280' }}>{title}</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{value}</div>
        </div>
      </div>
    </div>
  );
}