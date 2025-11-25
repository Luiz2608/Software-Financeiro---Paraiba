import axios from 'axios';

const getApiBaseUrl = () => {
  if (process.env.REACT_APP_API_BASE) return process.env.REACT_APP_API_BASE;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const port = window.location.port;
    if (port === '3001') return 'http://localhost:3002/api';
    return 'http://localhost:3000/api';
  }
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

console.log('🔗 API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Erro na requisição:', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    console.log(`✅ ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('❌ Erro na resposta:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message
    });
    return Promise.reject(error);
  }
);

export const processInvoice = async (file, apiKey) => {
  const formData = new FormData();
  formData.append('pdfFile', file);
  
  const response = await api.post('/invoices/process', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'X-API-Key': apiKey || ''
    },
    timeout: 60000,
  });
  return response.data;
};

export const getHistory = async () => {
  const response = await api.get('/invoices/history');
  return response.data;
};

export const getHistoryDetail = async (id) => {
  const response = await api.get(`/invoices/history/${id}`);
  return response.data;
};

export const deleteHistoryEntry = async (id) => {
  const response = await api.delete(`/invoices/history/${id}`);
  return response.data;
};

export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

// Pessoas
export const listPessoas = async (params) => {
  try {
    const response = await api.get('/pessoas', { params });
    const d = response.data;
    if (d && Array.isArray(d.data)) return { data: d.data };
    if (d && Array.isArray(d.items)) return { data: d.items };
    return d;
  } catch (err) {
    // Fallback para backend alternativo em dev (3000)
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      try {
        const alt = axios.create({ baseURL: 'http://localhost:3000/api', timeout: 15000 });
        const response = await alt.get('/pessoas', { params });
        const d = response.data;
        if (d && Array.isArray(d.data)) return { data: d.data };
        if (d && Array.isArray(d.items)) return { data: d.items };
        return d;
      } catch (e) {
        throw err;
      }
    }
    throw err;
  }
};
export const createPessoa = async (body) => {
  const response = await api.post('/pessoas', body);
  return response.data;
};
export const updatePessoa = async (id, body) => {
  const response = await api.put(`/pessoas/${id}`, body);
  return response.data;
};
export const deletePessoa = async (id) => {
  const response = await api.delete(`/pessoas/${id}`);
  return response.data;
};

// Classificacao
export const listClassificacao = async (params) => {
  const response = await api.get('/classificacao', { params });
  return response.data;
};
export const createClassificacao = async (body) => {
  const response = await api.post('/classificacao', body);
  return response.data;
};
export const updateClassificacao = async (id, body) => {
  const response = await api.put(`/classificacao/${id}`, body);
  return response.data;
};
export const deleteClassificacao = async (id) => {
  const response = await api.delete(`/classificacao/${id}`);
  return response.data;
};

// Agente3
export const agente3Consulta = async (pergunta, tipo = 'simples') => {
  const response = await api.post('/agente3/perguntar', { pergunta, tipo }, {
    headers: {
      'X-API-Key': window.__GEMINI_API_KEY__ || ''
    }
  });
  return response.data;
};

// Contas / Movimentos
export const listMovimentos = async (params) => {
  const response = await api.get('/contas/movimentos', { params });
  return response.data;
};
export const getMovimento = async (id) => {
  const response = await api.get(`/contas/movimentos/${id}`);
  return response.data;
};
export const getParcelas = async (id) => {
  const response = await api.get(`/contas/movimentos/${id}/parcelas`);
  return response.data;
};
export const updateMovimento = async (id, body) => {
  const response = await api.put(`/contas/movimentos/${id}`, body);
  return response.data;
};
export const createMovimento = async (body) => {
  const response = await api.post('/contas/movimentos', body);
  return response.data;
};
export const deleteMovimento = async (id) => {
  const response = await api.delete(`/contas/movimentos/${id}`);
  return response.data;
};

export default api;

// Auth helpers (frontend only)
export const loginLocal = async (username, password) => {
  return { ok: true };
};
export const logoutLocal = () => {
  localStorage.removeItem('auth_token');
};
