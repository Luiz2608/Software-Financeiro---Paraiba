import axios from 'axios';

// CORREÇÃO: Detecta automaticamente se está em desenvolvimento ou produção
const getApiBaseUrl = () => {
  // Se estiver rodando no navegador em localhost, usa localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000/api';
  }
  // Se estiver rodando no Docker, usa caminho relativo (proxy pelo nginx)
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

console.log('🔗 API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 segundos timeout
});

// Interceptor para logs de debug
api.interceptors.request.use(
  (config) => {
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

export const processInvoice = async (file) => {
  const formData = new FormData();
  formData.append('pdfFile', file);
  
  const response = await api.post('/invoices/process', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 60000, // 60 segundos para upload
  });
  return response.data;
};

// Novas funções para histórico
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

// Função para verificar saúde do backend
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api;