import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

function respostaCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function numeroValido(value) {
  return value === null || value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

export default async function handler(req, res) {
  respostaCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessão inválida ou expirada' });
  if (sessao.tipo !== 'promotor') return res.status(403).json({ erro: 'Somente promotores podem enviar pontos' });

  const pontos = req.body?.pontos;
  const jornadaId = Number(req.body?.jornadaId);
  if (!Number.isInteger(jornadaId) || jornadaId <= 0) return res.status(400).json({ erro: 'jornadaId inválido' });
  if (!Array.isArray(pontos) || pontos.length === 0 || pontos.length > 50) {
    return res.status(400).json({ erro: 'pontos deve conter entre 1 e 50 itens' });
  }

  const validos = pontos.filter(p => p && typeof p.pontoId === 'string' && p.pontoId.length <= 160
    && Number.isFinite(p.latitude) && p.latitude >= -90 && p.latitude <= 90
    && Number.isFinite(p.longitude) && p.longitude >= -180 && p.longitude <= 180
    && numeroValido(p.precisao) && (p.precisao == null || p.precisao >= 0)
    && typeof p.capturadoEm === 'string' && !Number.isNaN(new Date(p.capturadoEm).getTime()));
  if (validos.length !== pontos.length) return res.status(400).json({ erro: 'Um ou mais pontos são inválidos' });

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
    await sql`CREATE INDEX IF NOT EXISTS jornada_pontos_jornada_idx ON jornada_pontos (jornada_id, capturado_em)`;

    const [jornada] = await sql`
      SELECT id, status FROM jornadas WHERE id = ${jornadaId} AND promotor = ${sessao.nome}
    `;
    if (!jornada) return res.status(404).json({ erro: 'Jornada não encontrada' });
    if (jornada.status !== 'aberta') return res.status(409).json({ erro: 'Jornada encerrada' });

    let aceitos = 0;
    let duplicados = 0;
    for (const ponto of validos) {
      const inseridos = await sql`
        INSERT INTO jornada_pontos
          (jornada_id, promotor, ponto_id, latitude, longitude, precisao, altitude, velocidade, direcao, capturado_em)
        VALUES
          (${jornadaId}, ${sessao.nome}, ${ponto.pontoId}, ${ponto.latitude}, ${ponto.longitude},
           ${ponto.precisao ?? null}, ${ponto.altitude ?? null}, ${ponto.velocidade ?? null},
           ${ponto.direcao ?? null}, ${new Date(ponto.capturadoEm).toISOString()})
        ON CONFLICT (jornada_id, ponto_id) DO NOTHING
        RETURNING id
      `;
      if (inseridos.length) aceitos += 1;
      else duplicados += 1;
    }
    await sql`UPDATE jornadas SET atualizado_em = NOW() WHERE id = ${jornadaId}`;
    return res.status(200).json({ ok: true, aceitos, duplicados, rejeitados: 0 });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
