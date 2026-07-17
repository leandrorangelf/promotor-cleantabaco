import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

function respostaCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  respostaCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });
  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessão inválida ou expirada' });
  if (sessao.tipo !== 'promotor') return res.status(403).json({ erro: 'Somente promotores podem encerrar jornada' });

  const jornadaId = Number(req.body?.jornadaId);
  if (!Number.isInteger(jornadaId) || jornadaId <= 0) return res.status(400).json({ erro: 'jornadaId inválido' });
  const encerradoEm = req.body?.encerradoEm ? new Date(req.body.encerradoEm) : new Date();
  if (Number.isNaN(encerradoEm.getTime())) return res.status(400).json({ erro: 'encerradoEm inválido' });
  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.slice(0, 120) : 'fim do horário';

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
    const [jornada] = await sql`
      UPDATE jornadas
      SET status = 'encerrada', encerrado_em = COALESCE(encerrado_em, ${encerradoEm.toISOString()}),
          motivo_encerramento = CASE WHEN motivo_encerramento = '' THEN ${motivo} ELSE motivo_encerramento END,
          atualizado_em = NOW()
      WHERE id = ${jornadaId} AND promotor = ${sessao.nome}
      RETURNING id, status, iniciado_em, encerrado_em, motivo_encerramento
    `;
    if (!jornada) return res.status(404).json({ erro: 'Jornada não encontrada' });
    return res.status(200).json({ ok: true, status: jornada.status, jornada });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
