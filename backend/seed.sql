INSERT INTO pessoas (tipo, razao_social, nome_fantasia, cnpj_cpf, endereco, telefone, email, ativo, data_cadastro)
SELECT 'FORNECEDOR',
       'Fornecedor ' || gs,
       'Fornecedor ' || gs,
       '99' || LPAD(gs::text, 12, '0'),
       'Rua ' || gs || ', Centro',
       '62-' || LPAD(gs::text, 8, '0'),
       'fornecedor' || gs || '@teste.com',
       TRUE,
       NOW()
FROM generate_series(1,50) AS gs;

INSERT INTO pessoas (tipo, razao_social, nome_fantasia, cnpj_cpf, endereco, telefone, email, ativo, data_cadastro)
SELECT 'FATURADO',
       'Cliente ' || gs,
       'Cliente ' || gs,
       '88' || LPAD(gs::text, 9, '0'),
       'Av ' || gs || ', Bairro',
       '64-' || LPAD(gs::text, 8, '0'),
       'cliente' || gs || '@teste.com',
       TRUE,
       NOW()
FROM generate_series(1,50) AS gs;

INSERT INTO classificacao (nome, descricao, tipo, ativo, data_cadastro)
SELECT 'Categoria ' || gs,
       'Categoria ' || gs,
       CASE WHEN gs % 2 = 0 THEN 'DESPESA' ELSE 'RECEITA' END,
       TRUE,
       NOW()
FROM generate_series(1,20) AS gs;

WITH new_movs AS (
  INSERT INTO movimentocontas (tipo, id_pessoa, numero_nota_fiscal, data_emissao, valor_total, observacao, data_cadastro)
  SELECT CASE WHEN gs % 2 = 0 THEN 'APAGAR' ELSE 'ARECEBER' END,
         CASE WHEN gs % 2 = 0 THEN (
           SELECT id FROM pessoas WHERE tipo = 'FORNECEDOR' ORDER BY random() LIMIT 1
         ) ELSE (
           SELECT id FROM pessoas WHERE tipo = 'FATURADO' ORDER BY random() LIMIT 1
         ) END,
         LPAD(gs::text, 9, '0'),
         (CURRENT_DATE - ((random()*365)::int)),
         ROUND((random()*10000 + 100)::numeric, 2),
         'Seed movimento ' || gs,
         NOW()
  FROM generate_series(1,200) AS gs
  RETURNING id, data_emissao, valor_total
)
INSERT INTO parcelacontas (id_movimento, identificacao, numero_parcela, data_vencimento, valor_parcela, situacao, data_cadastro)
SELECT id,
       'PARCELA-' || id,
       1,
       (data_emissao + INTERVAL '30 days')::date,
       ROUND((valor_total)::numeric, 2),
       'ABERTA',
       NOW()
FROM new_movs;

WITH nm AS (
  SELECT id, valor_total FROM movimentocontas ORDER BY id DESC LIMIT 200
)
INSERT INTO movimento_classificacao (id_movimento, id_classificacao, valor, data_cadastro)
SELECT nm.id,
       (SELECT id FROM classificacao ORDER BY random() LIMIT 1),
       ROUND((nm.valor_total * 0.5)::numeric, 2),
       NOW()
FROM nm;
