import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

const SKUS = ['GR', 'GM', 'CM', 'CC'];

function listaQuery(valor = '') {
  return [...new Set(String(valor).split(',').map(v => v.trim()).filter(Boolean))];
}

function mesesValidos(valor) {
  return listaQuery(valor).filter(m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m)).sort();
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'private, max-age=30');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Metodo nao permitido' });

  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
  if (sessao.tipo === 'promotor') return res.status(403).json({ erro: 'Acesso restrito a gestao' });

  const meses = mesesValidos(req.query.meses);
  if (!meses.length) return res.status(400).json({ erro: 'Informe ao menos um mes valido' });

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
          FROM visitas
          WHERE to_char(criado_em AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = ANY(${meses})
            AND (${usaPromotores} = FALSE OR promotor = ANY(${promotores}))
        ), filtradas AS (
          SELECT * FROM base
          WHERE (${filtros.ufs.length} = 0 OR uf = ANY(${filtros.ufs}))
            AND (${filtros.cidades.length} = 0 OR cidade = ANY(${filtros.cidades}))
            AND (${filtros.produtos.length} = 0 OR EXISTS (
              SELECT 1 FROM unnest(${filtros.produtos}::text[]) produto
              WHERE COALESCE((quantidades->>produto)::numeric,0) > 0
            ))
        )
        SELECT COUNT(*)::int AS visitas,
          COUNT(*) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue'))::int AS pedidos,
          COALESCE(SUM((quantidades->>'GR')::numeric) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue')),0) AS "GR",
          COALESCE(SUM((quantidades->>'GM')::numeric) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue')),0) AS "GM",
          COALESCE(SUM((quantidades->>'CM')::numeric) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue')),0) AS "CM",
          COALESCE(SUM((quantidades->>'CC')::numeric) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue')),0) AS "CC"
        FROM filtradas
      `,
      sql`
        WITH base AS (
          SELECT UPPER(TRIM(COALESCE(dados->'pdv'->>'uf',''))) AS uf,
            TRIM(COALESCE(dados->'pdv'->>'cidade','')) AS cidade,
            COALESCE(dados->'comercial'->>'statusPedido', CASE WHEN dados->'comercial'->>'pedidoFeito' = 'Sim' THEN 'Pedido confirmado' ELSE 'Sem negociação' END) AS statusPedido,
            COALESCE(dados->'comercial'->'pedidoPac', dados->'comercial'->'pedidoQty', '{}'::jsonb) AS quantidades
          FROM visitas WHERE to_char(criado_em AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = ANY(${meses})
            AND (${usaPromotores} = FALSE OR promotor = ANY(${promotores}))
        )
        SELECT uf, COUNT(*)::int AS visitas,
          COUNT(*) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue'))::int AS pedidos,
          COALESCE(SUM(COALESCE((quantidades->>'GR')::numeric,0)+COALESCE((quantidades->>'GM')::numeric,0)+COALESCE((quantidades->>'CM')::numeric,0)+COALESCE((quantidades->>'CC')::numeric,0)),0) AS pacotes
        FROM base WHERE uf <> ''
          AND (${filtros.ufs.length} = 0 OR uf = ANY(${filtros.ufs}))
          AND (${filtros.cidades.length} = 0 OR cidade = ANY(${filtros.cidades}))
          AND (${filtros.produtos.length} = 0 OR EXISTS (
            SELECT 1 FROM unnest(${filtros.produtos}::text[]) produto
            WHERE COALESCE((quantidades->>produto)::numeric,0) > 0
          ))
        GROUP BY uf ORDER BY visitas DESC
      `,
      sql`
        WITH base AS (
          SELECT promotor, UPPER(TRIM(COALESCE(dados->'pdv'->>'uf',''))) AS uf,
            TRIM(COALESCE(dados->'pdv'->>'cidade','')) AS cidade,
            COALESCE(dados->'comercial'->>'statusPedido', CASE WHEN dados->'comercial'->>'pedidoFeito' = 'Sim' THEN 'Pedido confirmado' ELSE 'Sem negociação' END) AS statusPedido,
            COALESCE(dados->'comercial'->'pedidoPac', dados->'comercial'->'pedidoQty', '{}'::jsonb) AS quantidades
          FROM visitas WHERE to_char(criado_em AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = ANY(${meses})
            AND (${usaPromotores} = FALSE OR promotor = ANY(${promotores}))
        )
        SELECT promotor, COUNT(*)::int AS visitas,
          COUNT(*) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue'))::int AS pedidos,
          COALESCE(SUM((quantidades->>'GR')::numeric) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue')),0) AS "GR",
          COALESCE(SUM((quantidades->>'GM')::numeric) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue')),0) AS "GM",
          COALESCE(SUM((quantidades->>'CM')::numeric) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue')),0) AS "CM",
          COALESCE(SUM((quantidades->>'CC')::numeric) FILTER (WHERE statusPedido IN ('Pedido confirmado','Pedido entregue')),0) AS "CC"
        FROM base WHERE (${filtros.ufs.length} = 0 OR uf = ANY(${filtros.ufs}))
          AND (${filtros.cidades.length} = 0 OR cidade = ANY(${filtros.cidades}))
          AND (${filtros.produtos.length} = 0 OR EXISTS (
            SELECT 1 FROM unnest(${filtros.produtos}::text[]) produto
            WHERE COALESCE((quantidades->>produto)::numeric,0) > 0
          ))
        GROUP BY promotor ORDER BY visitas DESC
      `,
      sql`
        SELECT DISTINCT v.promotor, p.coordenador_usuario,
          UPPER(TRIM(COALESCE(v.dados->'pdv'->>'uf',''))) AS uf,
          TRIM(COALESCE(v.dados->'pdv'->>'cidade','')) AS cidade
        FROM visitas v LEFT JOIN promotores p ON p.nome = v.promotor
        WHERE to_char(v.criado_em AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') = ANY(${meses})
          AND (${usaPromotores} = FALSE OR v.promotor = ANY(${promotores}))
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

    return res.status(200).json({
      periodo: { meses }, totais, estados: estadosRows.map(numeros), ranking,
      opcoes: { promotores: unicos('promotor'), coordenadores: unicos('coordenador_usuario'), ufs: unicos('uf'), cidades: unicos('cidade'), produtos: SKUS }
    });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
