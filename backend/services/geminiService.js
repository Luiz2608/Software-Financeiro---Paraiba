const { GoogleGenerativeAI } = require('@google/generative-ai');
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';


function normalizeNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    let s = value.trim();

    if (s.includes(',') && s.includes('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',') && !s.includes('.')) {
      s = s.replace(',', '.');
    }
    
    s = s.replace(/,/g, '');
    const n = parseFloat(s);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function validateProducts(produtos, valorTotalNotaRaw) {
  if (!produtos || !Array.isArray(produtos)) {
    console.warn('⚠️ Nenhum produto encontrado para validar');
    return;
  }

  let soma = 0;
  const valorTotalNota = normalizeNumber(valorTotalNotaRaw);

  produtos.forEach((produto, idx) => {
    const logPrefix = `Produto ${idx + 1} (${produto.descricao?.substring(0, 30)}...)`;

    const q = normalizeNumber(produto.quantidade);
    const u = normalizeNumber(produto.valorUnitario);
    const t = normalizeNumber(produto.valorTotal);

    if (Number.isFinite(q) && Number.isFinite(u) && Number.isFinite(t)) {
      const calculado = q * u;
      const diff = Math.abs(calculado - t);
      
      if (diff > 0.01) {
        console.warn(`⚠️ ${logPrefix}: diferença encontrada (${q} x ${u} = ${calculado.toFixed(2)} vs ${t})`);
      } else {
        console.log(`✅ ${logPrefix}: correto (${q} x ${u} = ${t})`);
      }
      
      soma += t;
    } else {
      console.warn(`⚠️ ${logPrefix}: valores inválidos ou não numéricos`);
      if (Number.isFinite(t)) soma += t;
    }
  });

  if (valorTotalNota !== null && !Number.isNaN(valorTotalNota)) {
    const diff = Math.abs(soma - valorTotalNota);
    if (diff > 0.01) {
      console.warn(`⚠️ Soma dos produtos (${soma.toFixed(2)}) diferente do valor total da nota (${valorTotalNota.toFixed(2)}) - diferença: ${diff.toFixed(2)}`);
    } else {
      console.log(`✅ Soma dos produtos conferida: ${soma.toFixed(2)}`);
    }
  } else {
    console.log(`ℹ️ Soma dos produtos: ${soma.toFixed(2)}`);
  }
}

function determineTipoConta(jsonResult) {
  const { fornecedor, cliente, naturezaOperacao } = jsonResult;
  
  console.log('🔍 Analisando tipo de conta...');
  console.log('Fornecedor:', fornecedor?.razaoSocial);
  console.log('Cliente:', cliente?.nome, 'Tipo:', cliente?.tipo);
  console.log('Natureza Operação:', naturezaOperacao);

  if (cliente && cliente.tipo === 'PF') {
    console.log('✅ Tipo: APAGAR (Cliente é Pessoa Física)');
    return 'APAGAR';
  }

  if (naturezaOperacao && naturezaOperacao !== 'N/A') {
    const natureza = naturezaOperacao.toLowerCase();
    
    const indicadoresAPagar = [
      'compra', 'aquisição', 'aquisiçao', 'serviço', 'servico', 
      'despesa', 'conta', 'receb.de terceiros', 'receb de terceiros',
      'merc.aág.receb.de terceiros', 'merc aág receb de terceiros'
    ];
    
    const indicadoresAReceber = [
      'venda', 'prestação', 'prestacao', 'receita', 'faturamento',
      'comercialização', 'comercializacao', 'revenda'
    ];

    for (const indicador of indicadoresAPagar) {
      if (natureza.includes(indicador)) {
        console.log(`✅ Tipo: APAGAR (Natureza: ${naturezaOperacao})`);
        return 'APAGAR';
      }
    }

    for (const indicador of indicadoresAReceber) {
      if (natureza.includes(indicador)) {
        console.log(`✅ Tipo: ARECEBER (Natureza: ${naturezaOperacao})`);
        return 'ARECEBER';
      }
    }
  }

  if (fornecedor && cliente && fornecedor.tipo === 'PJ' && cliente.tipo === 'PJ') {
    console.log('✅ Tipo: APAGAR (Padrão para PJ-PJ)');
    return 'APAGAR';
  }

  console.log('✅ Tipo: APAGAR (Padrão)');
  return 'APAGAR';
}

function applyBasicAdjustments(jsonResult) {
  
  if (jsonResult.cliente) {
    if (jsonResult.cliente.cpf && jsonResult.cliente.cpf !== 'N/A' && jsonResult.cliente.cpf !== '') {
      jsonResult.cliente.tipo = 'PF';
      jsonResult.cliente.cnpj = jsonResult.cliente.cnpj || '';
    } else if (jsonResult.cliente.cnpj && jsonResult.cliente.cnpj !== 'N/A' && jsonResult.cliente.cnpj !== '') {
      jsonResult.cliente.tipo = 'PJ';
      jsonResult.cliente.cpf = jsonResult.cliente.cpf || '';
    } else {
      jsonResult.cliente.tipo = 'N/A';
    }
  }

  if (jsonResult.fornecedor) {
    jsonResult.fornecedor.tipo = 'PJ';
  }

  if (jsonResult.valorFrete === undefined || jsonResult.valorFrete === null) {
    jsonResult.valorFrete = 0;
  }

  if (!jsonResult.naturezaOperacao) {
    jsonResult.naturezaOperacao = 'N/A';
  }

  jsonResult.tipoConta = determineTipoConta(jsonResult);

  if (jsonResult.classificacaoDespesa && Array.isArray(jsonResult.classificacaoDespesa)) {
    const categoriasValidas = [
      'INSUMOS_AGRICOLAS', 'MANUTENCAO_OPERACAO', 'RECURSOS_HUMANOS',
      'SERVICOS_OPERACIONAIS', 'INFRAESTRUTURA_UTILIDADES', 'ADMINISTRATIVAS',
      'SEGUROS_PROTECAO', 'IMPOSTOS_TAXAS', 'INVESTIMENTOS'
    ];
    jsonResult.classificacaoDespesa = jsonResult.classificacaoDespesa.filter(
      cat => categoriasValidas.includes(cat)
    );
  }

  return jsonResult;
}

function extractFallbackFromText(pdfText) {
  const text = (pdfText || '').replace(/\r\n|\r/g, '\n');
  const cnpjMatch = text.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/) || text.match(/\b\d{14}\b/);
  const cpfMatch = text.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/) || text.match(/\b\d{11}\b/);
  const cnpj = cnpjMatch ? cnpjMatch[0] : 'N/A';
  const cpf = cpfMatch ? cpfMatch[0] : 'N/A';
  const numeroNotaFiscal = (() => {
    const notaMatch = text.match(/(nota\s*fiscal|nfe|n\.\s*\d+|número\s*da\s*nota)\s*[:#-]?\s*(\d{4,})/i);
    return notaMatch ? (notaMatch[2] || notaMatch[0].match(/\d+/)?.[0]) : 'N/A';
  })();
  const valorTotal = (() => {
    const valorMatch = text.match(/(valor\s*total|total\s*da\s*nota|total)\s*[:\-]?\s*R?\$?\s*([\d\.,]+)/i);
    return valorMatch ? normalizeNumber(valorMatch[2]) : null;
  })();
  const dataEmissao = (() => {
    const dataMatch = text.match(/(emiss[aã]o|data)\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i);
    return dataMatch ? dataMatch[2] : new Date().toISOString().split('T')[0];
  })();
  const naturezaOperacao = (() => {
    const naturezaMatch = text.match(/natureza\s*da\s*opera[cç][aã]o\s*[:\-]?\s*(.+)/i);
    return naturezaMatch ? naturezaMatch[1].split('\n')[0].trim() : 'N/A';
  })();

  const clienteTipo = cpf !== 'N/A' ? 'PF' : (cnpj !== 'N/A' ? 'PJ' : 'PF');
  const result = {
    fornecedor: { razaoSocial: 'N/A', cnpj },
    cliente: { nome: 'N/A', cpf, cnpj: cpf !== 'N/A' ? '' : cnpj, tipo: clienteTipo },
    numeroNotaFiscal,
    dataEmissao,
    naturezaOperacao,
    produtos: [],
    valorTotal: valorTotal ?? 0,
    parcelas: [],
  };

  const adjusted = applyBasicAdjustments(result);
  adjusted.tipoConta = determineTipoConta(adjusted);
  return adjusted;
}

const analyzeWithGemini = async (pdfText, apiKey) => {
  try {
    if (!apiKey || String(apiKey).trim().length === 0) {
      const fallback = extractFallbackFromText(pdfText);
      return fallback;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    console.log('Iniciando análise com Gemini...');
    
    const model = genAI.getGenerativeModel({ 
      model: DEFAULT_MODEL,
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      }
    });

    const examples = `
EXEMPLOS DE NOTAS FISCAIS E SUAS SAÍDAS JSON:

--- EXEMPLO 1 (NOTA DE DEFENSIVOS AGRÍCOLAS - CONTA A PAGAR) ---
TEXTO DA NOTA:
NECRET(EMOS) DE CTVA PROTEGAO DE CULTIVOS LTDA., OS PRODUTOS CONSTANTE DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO, BEM COMO ATESTADOS QUE OS MESMOS FORAM EXAMINADOS, SERVIDIO O ACEITE DA PRESENTE PARA TODOS OS EFEITOS LEGAIS.

CTVA PROTEGAO DE CULTIVOS LTDA.
AV EURIPEDES MENEZES, S/N – QUADRA004
PQ IND AP VICE-PRESIDENTE JOSE D – APARECIDA DE GÓIANIA/GO
CEP: 74993540

**NATUREZA DA OPERAÇÃO**
Venda merc.aág.receb.de terceiros

**CNPJ**
47.180.625/0058-81

**DESTINATÁRIO/REMETENTE**

| NOME/RAZÃO SOCIAL    | C.N.F.J./C.P.F.    | DATA DA EMISSÃO    |
|---|---|---|
| BEITRANO DE SOUZA    | 111.111.111-11    | 30/04/2025    |

| ENDEREÇO    | BAIRRO/DISTRITO    | CEP    | DATA DA SAÍDA/ENTRADA |
|---|---|---|---|
| ROD.GO 174, KM 72, S/N    | ZONA RURAL    | 75915000    | 30/04/2025    |

| MUNICÍPIO    | FONE/FAX    | UF    | INSCRIÇÃO ESTADUAL    | HORA DA SAÍDA    |
|---|---|---|---|---|
| MONTIVIDIU    | 6436210420    | GO    | 113440928    | 15:45:16    |

**FATURA/DUPLICATAS**
001: 05/05/2025 R$163.520,00;

**CÁLCULO DO IMPOSTO**

| VALOR TOTAL DOS PRODUTOS    | VALOR TOTAL DA NOTA    |
|---|---|
| 201.876,54    | 163.520,00    |

**DADOS DOS PRODUTOS/SERVIÇOS**

| DESCRIÇÃO    | UN. | QUANT. | V.UNIT. | V.TOTAL |
|---|---|---|---|---|
| VESSARIA BOMBONA 10L FUNCICIDA 05691545 | L    | 1120    | 180,24691| 201876,54 |

SAÍDA JSON ESPERADA:
{
  "fornecedor": {
    "razaoSocial": "CTVA PROTEGAO DE CULTIVOS LTDA",
    "fantasia": "CTVA PROTEGAO DE CULTIVOS",
    "cnpj": "47.180.625/0058-81",
    "tipo": "PJ",
    "endereco": "AV EURIPEDES MENEZES, S/N – QUADRA004, PQ IND AP VICE-PRESIDENTE JOSE D, APARECIDA DE GOIANIA/GO"
  },
  "cliente": {
    "nome": "BEITRANO DE SOUZA",
    "cpf": "111.111.111-11",
    "cnpj": "",
    "tipo": "PF",
    "endereco": "ROD.GO 174, KM 72, S/N, ZONA RURAL, MONTIVIDIU/GO"
  },
  "numeroNotaFiscal": "000.012.776",
  "dataEmissao": "30/04/2025",
  "valorFrete": 0.00,
  "produtos": [
    {
      "descricao": "VESSARIA BOMBONA 10L FUNCICIDA 05691545",
      "quantidade": 1120,
      "valorUnitario": 180.25,
      "valorTotal": 201876.54
    }
  ],
  "quantidadeParcelas": 1,
  "parcelas": [
    {
      "dataVencimento": "05/05/2025",
      "valor": 163520.00
    }
  ],
  "valorTotal": 163520.00,
  "classificacaoDespesa": ["INSUMOS_AGRICOLAS"],
  "naturezaOperacao": "Venda merc.aág.receb.de terceiros",
  "tipoConta": "APAGAR"
}

--- EXEMPLO 2 (NOTA DE VENDA - CONTA A RECEBER) ---
TEXTO DA NOTA:
DANFE - DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA

**EMITENTE**
Fazenda Boa Esperança LTDA
CNPJ: 12.345.678/0001-90
Endereço: Rodovia BR-060, Km 45, Zona Rural, Rio Verde/GO

**DESTINATÁRIO**
Supermercado Central SA
CNPJ: 98.765.432/0001-10
Endereço: Rua Comercial, 1000, Centro, Rio Verde/GO

**NATUREZA DA OPERAÇÃO**
Venda de produção do estabelecimento

**PRODUTOS**
| Descrição | Quantidade | Valor Unitário | Valor Total |
|---|---|---|---|
| Soja em grãos | 1000 | 150.00 | 150000.00 |
| Milho | 500 | 80.00 | 40000.00 |

**TOTAL DA NOTA: R$ 190.000,00**

SAÍDA JSON ESPERADA:
{
  "fornecedor": {
    "razaoSocial": "Fazenda Boa Esperança LTDA",
    "fantasia": "Fazenda Boa Esperança",
    "cnpj": "12.345.678/0001-90",
    "tipo": "PJ",
    "endereco": "Rodovia BR-060, Km 45, Zona Rural, Rio Verde/GO"
  },
  "cliente": {
    "nome": "Supermercado Central SA",
    "cpf": "",
    "cnpj": "98.765.432/0001-10",
    "tipo": "PJ",
    "endereco": "Rua Comercial, 1000, Centro, Rio Verde/GO"
  },
  "numeroNotaFiscal": "000.123.456",
  "dataEmissao": "15/10/2025",
  "valorFrete": 0.00,
  "produtos": [
    {
      "descricao": "Soja em grãos",
      "quantidade": 1000,
      "valorUnitario": 150.00,
      "valorTotal": 150000.00
    },
    {
      "descricao": "Milho",
      "quantidade": 500,
      "valorUnitario": 80.00,
      "valorTotal": 40000.00
    }
  ],
  "quantidadeParcelas": 1,
  "parcelas": [
    {
      "dataVencimento": "30/10/2025",
      "valor": 190000.00
    }
  ],
  "valorTotal": 190000.00,
  "classificacaoDespesa": ["INSUMOS_AGRICOLAS"],
  "naturezaOperacao": "Venda de produção do estabelecimento",
  "tipoConta": "ARECEBER"
}
`;

    const prompt = `
${examples}

INSTRUÇÕES GERAIS:
Analise o texto abaixo de uma nota fiscal e extraia as informações no formato JSON especificado, seguindo os exemplos acima.

TEXTO DA NOTA FISCAL PARA ANÁLISE:
${pdfText}

FORMATO JSON REQUERIDO:
{
  "fornecedor": {
    "razaoSocial": "string",
    "fantasia": "string",
    "cnpj": "string",
    "tipo": "PJ",
    "endereco": "string"
  },
  "cliente": {
    "nome": "string",
    "cpf": "string",
    "cnpj": "string",
    "tipo": "PF ou PJ",
    "endereco": "string"
  },
  "numeroNotaFiscal": "string",
  "dataEmissao": "string",
  "valorFrete": number,
  "produtos": [
    {
      "descricao": "string",
      "quantidade": number,
      "valorUnitario": number,
      "valorTotal": number
    }
  ],
  "quantidadeParcelas": number,
  "parcelas": [
    {
      "dataVencimento": "string",
      "valor": number
    }
  ],
  "valorTotal": number,
  "classificacaoDespesa": ["string"],
  "naturezaOperacao": "string",
  "tipoConta": "APAGAR ou ARECEBER"
}

CATEGORIAS DE DESPESA:
- "INSUMOS_AGRICOLAS" (Sementes, Fertilizantes, Defensivos Agrícolas, Corretivos)
- "MANUTENCAO_OPERACAO" (Combustíveis, Lubrificantes, Peças, Parafusos, Componentes Mecânicos, Manutenção de Máquinas e Equipamentos, Pneus, Filtros, Correias, Ferramentas e Utensílios)
- "RECURSOS_HUMANOS" (Mão de Obra Temporária, Salários e Encargos)
- "SERVICOS_OPERACIONAIS" (Frete e Transporte, Colheita Terceirizada, Secagem e Armazenagem, Pulverização e Aplicação)
- "INFRAESTRUTURA_UTILIDADES" (Energia Elétrica, Arrendamento de Terras, Construções e Reformas, Materiais de Construção)
- "ADMINISTRATIVAS" (Honorários Contábeis, Honorários Advocatícios, Honorários Agronômicos, Despesas Bancárias e Financeiras)
- "SEGUROS_PROTECAO" (Seguro Agrícola, Seguro de Ativos Máquinas/Veículos, Seguro Prestamista)
- "IMPOSTOS_TAXAS" (ITR, IPTU, IPVA, INCRA-CCIR)
- "INVESTIMENTOS" (Aquisição de Máquinas e Implementos, Aquisição de Veículos, Aquisição de Imóveis, Infraestrutura Rural)

REGRAS PARA TIPO DE CONTA (tipoConta):
- "APAGAR": Quando a empresa/cliente está COMPRANDO/PAGANDO por produtos/serviços (despesas, compras, serviços)
- "ARECEBER": Quando a empresa/cliente está VENDENDO/RECEBENDO por produtos/serviços (vendas, receitas, faturamento)

DETERMINAÇÃO DO TIPO DE CONTA:
1. Se o CLIENTE for Pessoa Física (CPF) → "APAGAR"
2. Se a natureza da operação contém: "venda", "faturamento", "receita", "prestação", "comercialização" → "ARECEBER"
3. Se a natureza da operação contém: "compra", "aquisição", "despesa", "serviço", "receb.de terceiros" → "APAGAR"
4. Se não conseguir determinar, use "APAGAR" como padrão

REGRAS GERAIS:
1. Retorne APENAS o JSON válido, sem texto adicional
2. Para cliente: use "PF" para CPF, "PJ" para CNPJ
3. Para fornecedor.tipo: sempre "PJ"
4. Extraia TODOS os produtos
5. Use 0 para frete não encontrado
6. Use "N/A" para strings não encontradas
7. Verifique coerência matemática dos produtos
8. Valide soma dos produtos com valor total da nota
9. EXTRAIA SEMPRE a "naturezaOperacao" da nota fiscal
10. BASEIE-SE NOS EXEMPLOS FORNECIDOS para entender o formato exato das notas fiscais

IMPORTANTE: As notas fiscais reais seguem exatamente o formato dos exemplos fornecidos. Preste atenção especial:
- No formato dos endereços (juntar informações de rua, bairro, cidade)
- Na identificação de CPF vs CNPJ
- Na extração correta de todos os produtos da tabela
- No tratamento de valores com vírgula como separador decimal
- Na natureza da operação para determinar se é conta a pagar ou receber
- Na extração da natureza da operação que geralmente aparece como "NATUREZA DA OPERAÇÃO" no texto
`;

    console.log('Enviando prompt para Gemini...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('Resposta recebida do Gemini:', text.substring(0, 200) + '...');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Resposta do Gemini não contém JSON válido');
    }

    const jsonResult = JSON.parse(jsonMatch[0]);
    console.log('✅ JSON parseado com sucesso');

    const adjustedResult = applyBasicAdjustments(jsonResult);

    validateProducts(adjustedResult.produtos, adjustedResult.valorTotal);

    console.log('🎯 Tipo de Conta Definido:', adjustedResult.tipoConta);
    console.log('📋 Natureza da Operação:', adjustedResult.naturezaOperacao);

    return adjustedResult;

  } catch (error) {
    console.error('❌ Erro no Gemini:', error);
    const msg = String(error?.message || '').toLowerCase();
    const isRateLimit = msg.includes('429') || msg.includes('too many requests') || msg.includes('exceeded your current quota');
    if (isRateLimit) {
      console.warn('⚠️ Cota do Gemini excedida. Usando extração básica por regex como fallback.');
      const fallback = extractFallbackFromText(pdfText);
      return fallback;
    }
    throw new Error(`Erro ao analisar com Gemini: ${error.message}`);
  }
};

module.exports = { analyzeWithGemini };
