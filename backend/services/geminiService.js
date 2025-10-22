const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


function normalizeNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    let s = value.trim();
    // se tiver vírgula (formato brasileiro), remover pontos (milhares) e trocar vírgula por ponto
    if (s.includes(',') && s.includes('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',') && !s.includes('.')) {
      s = s.replace(',', '.');
    }
    // Remove qualquer vírgula restante
    s = s.replace(/,/g, '');
    const n = parseFloat(s);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/**
 * Validação simples dos produtos - apenas verifica e loga problemas
 */
function validateProducts(produtos, valorTotalNotaRaw) {
  if (!produtos || !Array.isArray(produtos)) {
    console.warn('⚠️ Nenhum produto encontrado para validar');
    return;
  }

  let soma = 0;
  const valorTotalNota = normalizeNumber(valorTotalNotaRaw);

  produtos.forEach((produto, idx) => {
    const logPrefix = `Produto ${idx + 1} (${produto.descricao?.substring(0, 30)}...)`;

    // Normalizar valores
    const q = normalizeNumber(produto.quantidade);
    const u = normalizeNumber(produto.valorUnitario);
    const t = normalizeNumber(produto.valorTotal);

    // Verificar se todos os valores são válidos
    if (Number.isFinite(q) && Number.isFinite(u) && Number.isFinite(t)) {
      const calculado = q * u;
      const diff = Math.abs(calculado - t);
      
      // Verificar se a multiplicação bate
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

  // Validar soma com valor total da nota
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

/**
 * Determina se a nota é Conta a Pagar ou Conta a Receber
 */
function determineTipoConta(jsonResult) {
  const { fornecedor, cliente, naturezaOperacao } = jsonResult;
  
  console.log('🔍 Analisando tipo de conta...');
  console.log('Fornecedor:', fornecedor?.razaoSocial);
  console.log('Cliente:', cliente?.nome, 'Tipo:', cliente?.tipo);
  console.log('Natureza Operação:', naturezaOperacao);

  // REGRA 1: Se o cliente é Pessoa Física (CPF) → Conta a Pagar
  if (cliente && cliente.tipo === 'PF') {
    console.log('✅ Tipo: APAGAR (Cliente é Pessoa Física)');
    return 'APAGAR';
  }

  // REGRA 2: Analisar a natureza da operação
  if (naturezaOperacao && naturezaOperacao !== 'N/A') {
    const natureza = naturezaOperacao.toLowerCase();
    
    // Operações que geralmente são contas a pagar
    const indicadoresAPagar = [
      'compra', 'aquisição', 'aquisiçao', 'serviço', 'servico', 
      'despesa', 'conta', 'receb.de terceiros', 'receb de terceiros',
      'merc.aág.receb.de terceiros', 'merc aág receb de terceiros'
    ];
    
    // Operações que geralmente são contas a receber
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

  // REGRA 3: Se ambos são PJ, analisar contexto
  if (fornecedor && cliente && fornecedor.tipo === 'PJ' && cliente.tipo === 'PJ') {
    // Se não conseguiu determinar pela natureza, assume Conta a Pagar (mais comum)
    console.log('✅ Tipo: APAGAR (Padrão para PJ-PJ)');
    return 'APAGAR';
  }

  // REGRA 4: Padrão final - Conta a Pagar
  console.log('✅ Tipo: APAGAR (Padrão)');
  return 'APAGAR';
}

/**
 * Aplica ajustes automáticos básicos ao resultado do Gemini
 */
function applyBasicAdjustments(jsonResult) {
  // Ajustar cliente
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

  // Ajustar fornecedor
  if (jsonResult.fornecedor) {
    jsonResult.fornecedor.tipo = 'PJ';
  }

  // Ajustar valor do frete
  if (jsonResult.valorFrete === undefined || jsonResult.valorFrete === null) {
    jsonResult.valorFrete = 0;
  }

  // Garantir que naturezaOperacao existe
  if (!jsonResult.naturezaOperacao) {
    jsonResult.naturezaOperacao = 'N/A';
  }

  // 🔍 DETERMINAR TIPO DE CONTA (NOVA FUNCIONALIDADE)
  jsonResult.tipoConta = determineTipoConta(jsonResult);

  // Filtrar categorias válidas
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

const analyzeWithGemini = async (pdfText) => {
  try {
    console.log('Iniciando análise com Gemini...');
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
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

    // Extrair JSON da resposta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Resposta do Gemini não contém JSON válido');
    }

    const jsonResult = JSON.parse(jsonMatch[0]);
    console.log('✅ JSON parseado com sucesso');

    // Aplicar ajustes automáticos
    const adjustedResult = applyBasicAdjustments(jsonResult);

    // Validar produtos (apenas verificação, sem correção)
    validateProducts(adjustedResult.produtos, adjustedResult.valorTotal);

    console.log('🎯 Tipo de Conta Definido:', adjustedResult.tipoConta);
    console.log('📋 Natureza da Operação:', adjustedResult.naturezaOperacao);

    return adjustedResult;

  } catch (error) {
    console.error('❌ Erro no Gemini:', error);
    throw new Error(`Erro ao analisar com Gemini: ${error.message}`);
  }
};

module.exports = { analyzeWithGemini };