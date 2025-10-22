import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const processInvoice = async (file) => {
  const formData = new FormData();
  formData.append('pdfFile', file);
  
  const response = await api.post('/invoices/process', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
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