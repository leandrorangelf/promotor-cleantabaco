import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

const SKUS = ['GR', 'GM', 'CM', 'CC'];

function listaQuery(valor = '') {
  return [...new Set(String(valor).split(',').map(v => v.trim()).filter(Boolean))];
}

function mesesValidos(valor) {
  return listaQuery(valor).filter(m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m)).sort();
}

function limitesMeses(meses) {
  const inicio = `${meses[0]}-01T00:00:00-03:00`;
  const [ano, mes] = meses[meses.length - 1].split('-').map(Number);
  const fim = new Date(Date.UTC(ano, mes, 1, 3)).toISOString();
  return { inicio, fim };
}

function numeros(row = {}) {
  return Object.fromEntries(Object.entries(row).map(([chave, valor]) => [chave, typeof valor === 'string' && /^-?\d+(\.\d+)?$/.test(valor) ? Number(valor) : valor]));
}

async function promotoresPermitidos(sql, sessao, coordenadores) {
  if (sessao.tipo === 'coordenador') {
    const rows = await sql`
      SELECT nome FROM promotores
      WHERE ativo = TRUE AND tipo = 'promotor' AND coordenador_usuario = ${sessao.usuario}
    `;
    return rows.map(row => row.nome);
  }
  if (!coordenadores.length) return [];
  const rows = await sql`
    SELECT nome FROM promotores
    WHERE ativo = TRUE AND tipo = 'promotor' AND coordenador_usuario = ANY(${coordenadores})
  `;
  return rows.map(row => row.nome);
}

export default async function handler(req, res) {
  const inicioMs = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'private, max-age=30');
  res.setHeader('Vary', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Metodo nao permitido' });

  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
  if (sessao.tipo === 'promotor') return res.status(403).json({ erro: 'Acesso restrito a gestao' });

  const meses = mesesValidos(req.query.meses);
  if (!meses.length) return res.status(400).json({ erro: 'Informe ao menos um mes valido' });
  const limites = limitesMeses(meses);

  const filtros = {
    promotores: listaQuery(req.query.promotores),
    coordenadores: listaQuery(req.query.coordenadores),
    ufs: listaQuery(req.query.ufs).map(v => v.toUpperCase()),
    cidades: listaQuery(req.query.cidades),
    produtos: listaQuery(req.query.produtos).filter(v => SKUS.includes(v))
  };

  try {
    const sql = neon(process.env.DATABASE_URL);
    const permitidos = await promotoresPermitidos(sql, sessao, filtros.coordenadores);
    const restringePermitidos = sessao.tipo === 'coordenador' || filtros.coordenadores.length > 0;
    const promotores = filtros.promotores.length
      ? filtros.promotores.filter(nome => !restringePermitidos || permitidos.includes(nome))
      : permitidos;
    if (restringePermitidos && !promotores.length) {
      return res.status(200).json({
        periodo: { meses },
        totais: { visitas: 0, pedidos: 0, GR: 0, GM: 0, CM: 0, CC: 0, pacotes: 0 },
        estados: [], ranking: [], opcoes: { promotores: [], coordenadores: [], ufs: [], cidades: [], produtos: SKUS }
      });
    }

    const usaPromotores = restringePermitidos || promotores.length > 0;
    const [totalRows, estadosRows, rankingRows, opcoesRows] = await Promise.all([
      sql`
        WITH base AS (
          SELECT promotor,
            UPPER(TRIM(COALESCE(dados->'pdv'->>'uf',''))) AS uf,
            TRIM(COALESCE(dados->'pdv'->>'cidade','')) AS cidade,
            COALESCE(dados->'comercial'->>'statusPedido',
              CASE WHEN dados->'comercial'->>'pedidoEntregue' = 'true' THEN 'Pedido entregue'
                   WHEN dados->'comercial'->>'pedidoFeito' = 'Sim' THEN 'Pedido confirmado'
                   ELSE 'Sem negociação' END) AS statusPedido,
            COALESCE(dados->'comercial'->'pedidoPac', dados->'comercial'->'pedidoQty', '{}'::jsonb) AS quantidades
          FROM visitas v
          WHERE v.criado_em >= ${limites.inicio}::timestamptz AND v.criado_em < ${limites.fim}::timestamptz
            AND to_char(v.criado_em AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = ANY(${meses})
            AND (${usaPromotores} = FALSE OR v.promotor = ANY(${promotores}))
            AND (${filtros.coordenadores.length} = 0 OR EXISTS (SELECT 1 FROM promotores p WHERE p.nome = v.promotor AND p.coordenador_usuario = ANY(${filtros.coordenadores})))
        ), filtradas AS (
          SELECT * FROM base
          WHERE (${filtros.ufs.length} = 0 OR uf = ANY(${filtros.ufs}))
            AND (${filtros.cidades.length} = 0 OR cidade = ANY(${filtros.cidades}))
            AND (${filtros.produtos.length} = 0 OR EXISTS (
              SELECT 1 FROM unnest(${filtros.produtos}::text[]) produto
              WHERE CASE WHEN TRIM(COALESCE(quantidades->>produto,'')) ~ '^[0-9]+([.,][0-9]+)?$'
                THEN REPLACE(quantidades->>produto, ',', '.')::numeric ELSE 0 END > 0
            ))
        )
        SELECT COUNT(*)::int AS visitas,
          COUNT(*) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue'))::int AS pedidos,
          COALESCE(SUM(CASE WHEN COALESCE(quantidades->>'GR','') ~ '^[0-9]+([.,][0-9]+)?$' THEN REPLACE(quantidades->>'GR',',','.')::numeric ELSE 0 END) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue')),0) AS "GR",
          COALESCE(SUM(CASE WHEN COALESCE(quantidades->>'GM','') ~ '^[0-9]+([.,][0-9]+)?$' THEN REPLACE(quantidades->>'GM',',','.')::numeric ELSE 0 END) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue')),0) AS "GM",
          COALESCE(SUM(CASE WHEN COALESCE(quantidades->>'CM','') ~ '^[0-9]+([.,][0-9]+)?$' THEN REPLACE(quantidades->>'CM',',','.')::numeric ELSE 0 END) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue')),0) AS "CM",
          COALESCE(SUM(CASE WHEN COALESCE(quantidades->>'CC','') ~ '^[0-9]+([.,][0-9]+)?$' THEN REPLACE(quantidades->>'CC',',','.')::numeric ELSE 0 END) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue')),0) AS "CC"
        FROM filtradas
      `,
      sql`
        WITH base AS (
          SELECT UPPER(TRIM(COALESCE(dados->'pdv'->>'uf',''))) AS uf,
            TRIM(COALESCE(dados->'pdv'->>'cidade','')) AS cidade,
            COALESCE(dados->'comercial'->>'statusPedido', CASE WHEN dados->'comercial'->>'pedidoFeito' = 'Sim' THEN 'Pedido confirmado' ELSE 'Sem negociação' END) AS statusPedido,
            COALESCE(dados->'comercial'->'pedidoPac', dados->'comercial'->'pedidoQty', '{}'::jsonb) AS quantidades
          FROM visitas v
          WHERE v.criado_em >= ${limites.inicio}::timestamptz AND v.criado_em < ${limites.fim}::timestamptz
            AND to_char(v.criado_em AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = ANY(${meses})
            AND (${usaPromotores} = FALSE OR v.promotor = ANY(${promotores}))
            AND (${filtros.coordenadores.length} = 0 OR EXISTS (SELECT 1 FROM promotores p WHERE p.nome = v.promotor AND p.coordenador_usuario = ANY(${filtros.coordenadores})))
        )
        SELECT uf, COUNT(*)::int AS visitas,
          COUNT(*) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue'))::int AS pedidos,
          COALESCE(SUM(
            (CASE WHEN COALESCE(quantidades->>'GR','') ~ '^[0-9]+([.,][0-9]+)?$' THEN REPLACE(quantidades->>'GR',',','.')::numeric ELSE 0 END) +
            (CASE WHEN COALESCE(quantidades->>'GM','') ~ '^[0-9]+([.,][0-9]+)?$' THEN REPLACE(quantidades->>'GM',',','.')::numeric ELSE 0 END) +
            (CASE WHEN COALESCE(quantidades->>'CM','') ~ '^[0-9]+([.,][0-9]+)?$' THEN REPLACE(quantidades->>'CM',',','.')::numeric ELSE 0 END) +
            (CASE WHEN COALESCE(quantidades->>'CC','') ~ '^[0-9]+([.,][0-9]+)?$' THEN REPLACE(quantidades->>'CC',',','.')::numeric ELSE 0 END)
          ) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue')),0) AS pacotes
        FROM base WHERE uf <> ''
          AND (${filtros.ufs.length} = 0 OR uf = ANY(${filtros.ufs}))
          AND (${filtros.cidades.length} = 0 OR cidade = ANY(${filtros.cidades}))
          AND (${filtros.produtos.length} = 0 OR EXISTS (
            SELECT 1 FROM unnest(${filtros.produtos}::text[]) produto
            WHERE CASE WHEN TRIM(COALESCE(quantidades->>produto,'')) ~ '^[0-9]+([.,][0-9]+)?$'
              THEN REPLACE(quantidades->>produto, ',', '.')::numeric ELSE 0 END > 0
          ))
        GROUP BY uf ORDER BY visitas DESC
      `,
      sql`
        WITH base AS (
          SELECT promotor, UPPER(TRIM(COALESCE(dados->'pdv'->>'uf',''))) AS uf,
            TRIM(COALESCE(dados->'pdv'->>'cidade','')) AS cidade,
            COALESCE(dados->'comercial'->>'statusPedido', CASE WHEN dados->'comercial'->>'pedidoFeito' = 'Sim' THEN 'Pedido confirmado' ELSE 'Sem negociação' END) AS statusPedido,
            COALESCE(dados->'comercial'->'pedidoPac', dados->'comercial'->'pedidoQty', '{}'::jsonb) AS quantidades
          FROM visitas v
          WHERE v.criado_em >= ${limites.inicio}::timestamptz AND v.criado_em < ${limites.fim}::timestamptz
            AND to_char(v.criado_em AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = ANY(${meses})
            AND (${usaPromotores} = FALSE OR v.promotor = ANY(${promotores}))
            AND (${filtros.coordenadores.length} = 0 OR EXISTS (SELECT 1 FROM promotores p WHERE p.nome = v.promotor AND p.coordenador_usuario = ANY(${filtros.coordenadores})))
        )
        SELECT promotor, COUNT(*)::int AS visitas,
          COUNT(*) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue'))::int AS pedidos,
          COALESCE(SUM(CASE WHEN COALESCE(quantidades->>'GR','') ~ '^[0-9]+([.,][0-9]+)?$' THEN REPLACE(quantidades->>'GR',',','.')::numeric ELSE 0 END) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue')),0) AS "GR",
          COALESCE(SUM(CASE WHEN COALESCE(quantidades->>'GM','') ~ '^[0-9]+([.,][0-9]+)?$' THEN REPLACE(quantidades->>'GM',',','.')::numeric ELSE 0 END) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue')),0) AS "GM",
          COALESCE(SUM(CASE WHEN COALESCE(quantidades->>'CM','') ~ '^[0-9]+([.,][0-9]+)?$' THEN REPLACE(quantidades->>'CM',',','.')::numeric ELSE 0 END) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue')),0) AS "CM",
          COALESCE(SUM(CASE WHEN COALESCE(quantidades->>'CC','') ~ '^[0-9]+([.,][0-9]+)?$' THEN REPLACE(quantidades->>'CC',',','.')::numeric ELSE 0 END) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue')),0) AS "CC"
        FROM base WHERE (${filtros.ufs.length} = 0 OR uf = ANY(${filtros.ufs}))
          AND (${filtros.cidades.length} = 0 OR cidade = ANY(${filtros.cidades}))
          AND (${filtros.produtos.length} = 0 OR EXISTS (
            SELECT 1 FROM unnest(${filtros.produtos}::text[]) produto
            WHERE CASE WHEN TRIM(COALESCE(quantidades->>produto,'')) ~ '^[0-9]+([.,][0-9]+)?$'
              THEN REPLACE(quantidades->>produto, ',', '.')::numeric ELSE 0 END > 0
          ))
        GROUP BY promotor ORDER BY visitas DESC
      `,
      sql`
        SELECT DISTINCT v.promotor, p.coordenador_usuario,
          UPPER(TRIM(COALESCE(v.dados->'pdv'->>'uf',''))) AS uf,
          TRIM(COALESCE(v.dados->'pdv'->>'cidade','')) AS cidade
        FROM visitas v LEFT JOIN promotores p ON p.nome = v.promotor
        WHERE v.criado_em >= ${limites.inicio}::timestamptz AND v.criado_em < ${limites.fim}::timestamptz
          AND to_char(v.criado_em AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = ANY(${meses})
          AND (${restringePermitidos} = FALSE OR v.promotor = ANY(${permitidos}))
      `
    ]);

    const totais = numeros(totalRows[0] || {});
    totais.pacotes = SKUS.reduce((s, sku) => s + Number(totais[sku] || 0), 0);
    const ranking = rankingRows.map(row => {
      const item = numeros(row);
      item.pacotes = SKUS.reduce((s, sku) => s + Number(item[sku] || 0), 0);
      return item;
    });
    const unicos = chave => [...new Set(opcoesRows.map(row => row[chave]).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b), 'pt-BR'));

    res.setHeader('Server-Timing', `dashboard;dur=${Date.now() - inicioMs}`);
    return res.status(200).json({
      periodo: { meses }, totais, estados: estadosRows.map(numeros), ranking,
      opcoes: { promotores: unicos('promotor'), coordenadores: unicos('coordenador_usuario'), ufs: unicos('uf'), cidades: unicos('cidade'), produtos: SKUS }
    });
  } catch (e) {
    res.setHeader('Server-Timing', `dashboard;dur=${Date.now() - inicioMs}`);
    return res.status(500).json({ erro: e.message });
  }
}
