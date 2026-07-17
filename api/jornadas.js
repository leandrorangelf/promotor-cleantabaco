import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

function respostaCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function permitidos(tipo) {
  return ['gestor', 'coordenador', 'diretoria'].includes(tipo);
}

export default async function handler(req, res) {
  respostaCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' });
  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessão inválida ou expirada' });
  if (!permitidos(sessao.tipo)) return res.status(403).json({ erro: 'Perfil sem acesso às jornadas' });

  try {
    const sql = neon(process.env.DATABASE_URL);
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
    const inicio = typeof req.query?.inicio === 'string' ? req.query.inicio : '';
    const fim = typeof req.query?.fim === 'string' ? req.query.fim : '';
    const promotor = typeof req.query?.promotor === 'string' ? req.query.promotor : '';
    const jornadas = await sql`
      SELECT id, promotor, data_local, status, iniciado_em, encerrado_em, motivo_encerramento
      FROM jornadas
      WHERE (${inicio} = '' OR data_local >= ${inicio}::date)
        AND (${fim} = '' OR data_local <= ${fim}::date)
        AND (${promotor} = '' OR promotor = ${promotor})
        AND (${sessao.tipo} <> 'coordenador' OR promotor IN (
          SELECT nome FROM usuarios WHERE coordenador_usuario = ${sessao.usuario}
        ))
      ORDER BY data_local DESC, iniciado_em DESC
      LIMIT 500
    `;
    const ids = jornadas.map(j => j.id);
    const pontos = ids.length ? await sql`
      SELECT jornada_id, ponto_id, latitude, longitude, precisao, altitude, velocidade, direcao, capturado_em
      FROM jornada_pontos WHERE jornada_id = ANY(${ids}) ORDER BY capturado_em ASC
    ` : [];
    const porJornada = new Map(jornadas.map(j => [String(j.id), []]));
    for (const ponto of pontos) porJornada.get(String(ponto.jornada_id))?.push(ponto);
    return res.status(200).json({ ok: true, jornadas: jornadas.map(j => ({ ...j, pontos: porJornada.get(String(j.id)) || [] })) });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
