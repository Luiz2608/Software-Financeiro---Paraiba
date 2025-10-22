// Funções auxiliares para validação de documentos
const validateDocument = (documento) => {
  if (!documento || documento === 'N/A' || documento === '') return { tipo: 'N/A', documento: '' };
  
  const documentoLimpo = documento.replace(/\D/g, '');
  
  if (documentoLimpo.length === 11) {
    return { tipo: 'PF', documento: documentoLimpo };
  } else if (documentoLimpo.length === 14) {
    return { tipo: 'PJ', documento: documentoLimpo };
  } else {
    return { tipo: 'N/A', documento: documentoLimpo };
  }
};

const validateCPF = (cpf) => {
  if (!cpf) return false;
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.length === 11;
};

const validateCNPJ = (cnpj) => {
  if (!cnpj) return false;
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.length === 14;
};

module.exports = {
  validateDocument,
  validateCPF,
  validateCNPJ
};