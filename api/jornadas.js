import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';
import { autenticar } from './_auth.js';
import mapMatch from './_map-match.cjs';

const { ajustarTrilha, normalizarPontos, segmentosRaw } = mapMatch;

function respostaCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function permitidos(tipo) {
  return ['gestor', 'coordenador', 'diretoria'].includes(tipo);
}

function assinaturaPontos(pontos) {
  const essenciais = normalizarPontos(pontos).map(ponto => [
    ponto.latitude,
    ponto.longitude,
    ponto.precisao,
    ponto.velocidade ?? null,
    ponto.capturado_em
  ]);
  return createHash('sha256').update(JSON.stringify(essenciais)).digest('hex');
}

function lerCache(valor) {
  if (!valor) return null;
  try {
    const cache = typeof valor === 'string' ? JSON.parse(valor) : valor;
    return Array.isArray(cache?.segmentos) && cache?.ajuste?.status ? cache : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  respostaCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' });
  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessão inválida ou expirada' });
  if (!permitidos(sessao.tipo)) return res.status(403).json({ erro: 'Perfil sem acesso às jornadas' });

  let etapa = 'inicializacao';
  try {
    const sql = neon(process.env.DATABASE_URL);
    etapa = 'criar_tabela_jornadas';
    await sql`
      CREATE TABLE IF NOT EXISTS jornadas (
        id BIGSERIAL PRIMARY KEY,
        promotor TEXT NOT NULL,
        data_local DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'aberta',
        dispositivo_id TEXT NOT NULL DEFAULT '',
        iniciado_em TIMESTAMPTZ NOT NULL,
        encerrado_em TIMESTAMPTZ,
        motivo_encerramento TEXT NOT NULL DEFAULT '',
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (promotor, data_local)
      )
    `;
    etapa = 'criar_tabela_pontos';
    await sql`
      CREATE TABLE IF NOT EXISTS jornada_pontos (
        id BIGSERIAL PRIMARY KEY,
        jornada_id BIGINT NOT NULL,
        promotor TEXT NOT NULL,
        ponto_id TEXT NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        precisao DOUBLE PRECISION,
        altitude DOUBLE PRECISION,
        velocidade DOUBLE PRECISION,
        direcao DOUBLE PRECISION,
        capturado_em TIMESTAMPTZ NOT NULL,
        recebido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (jornada_id, ponto_id)
      )
    `;
    etapa = 'preparar_cache_rota';
    await sql`ALTER TABLE jornadas ADD COLUMN IF NOT EXISTS rota_assinatura TEXT`;
    await sql`ALTER TABLE jornadas ADD COLUMN IF NOT EXISTS rota_ajustada JSONB`;
    await sql`ALTER TABLE jornadas ADD COLUMN IF NOT EXISTS rota_ajustada_em TIMESTAMPTZ`;
    const inicio = typeof req.query?.inicio === 'string' ? req.query.inicio : '';
    const fim = typeof req.query?.fim === 'string' ? req.query.fim : '';
    const promotor = typeof req.query?.promotor === 'string' ? req.query.promotor : '';
    const deveAjustar = req.query?.ajustar === 'true' && Boolean(promotor);
    etapa = 'consultar_jornadas';
    const jornadas = await sql`
      SELECT id, promotor, data_local, status, iniciado_em, encerrado_em, motivo_encerramento,
             rota_assinatura, rota_ajustada, rota_ajustada_em
      FROM jornadas
      WHERE (${inicio} = '' OR data_local >= ${inicio}::date)
        AND (${fim} = '' OR data_local <= ${fim}::date)
        AND (${promotor} = '' OR promotor = ${promotor})
        AND (${sessao.tipo} <> 'coordenador' OR promotor IN (
          SELECT nome FROM promotores
          WHERE ativo = TRUE AND tipo = 'promotor' AND coordenador_usuario = ${sessao.usuario}
        ))
      ORDER BY data_local DESC, iniciado_em DESC
      LIMIT 500
    `;
    const ids = jornadas.map(j => j.id);
    etapa = 'consultar_pontos';
    const pontos = ids.length ? await sql`
      SELECT jornada_id, ponto_id, latitude, longitude, precisao, altitude, velocidade, direcao, capturado_em
      FROM jornada_pontos WHERE jornada_id = ANY(${ids}) ORDER BY capturado_em ASC
    ` : [];
    const porJornada = new Map(jornadas.map(j => [String(j.id), []]));
    for (const ponto of pontos) porJornada.get(String(ponto.jornada_id))?.push(ponto);
    const resposta = [];
    for (const jornada of jornadas) {
      const pontosJornada = porJornada.get(String(jornada.id)) || [];
      const assinatura = assinaturaPontos(pontosJornada);
      const cache = jornada.rota_assinatura === assinatura ? lerCache(jornada.rota_ajustada) : null;
      let rota;
      if (cache) {
        rota = cache;
      } else if (deveAjustar) {
        rota = await ajustarTrilha(pontosJornada, {
          token: process.env.GEOAPIFY_API_KEY || '',
          fetchImpl: fetch
        });
        if (['completo', 'parcial'].includes(rota.ajuste.status)) {
          try {
            await sql`
              UPDATE jornadas
              SET rota_assinatura = ${assinatura}, rota_ajustada = ${JSON.stringify(rota)}::jsonb, rota_ajustada_em = NOW()
              WHERE id = ${jornada.id}
            `;
          } catch {
            // O cache é uma otimização; a rota calculada continua válida para esta resposta.
          }
        }
      } else {
        const segmentos = segmentosRaw(pontosJornada);
        rota = {
          segmentos,
          ajuste: { status: segmentos.length ? 'indisponivel' : 'sem_dados', provedor: null }
        };
      }
      const { rota_assinatura, rota_ajustada, rota_ajustada_em, ...dadosJornada } = jornada;
      resposta.push({ ...dadosJornada, pontos: pontosJornada, segmentos: rota.segmentos, ajuste: rota.ajuste });
    }
    return res.status(200).json({ ok: true, jornadas: resposta });
  } catch (e) {
    console.error('Falha em /api/jornadas', { etapa, mensagem: e?.message, codigo: e?.code });
    return res.status(500).json({ erro: e.message });
  }
}
