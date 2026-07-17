import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

const TIME_ZONE = 'America/Sao_Paulo';

function dataLocalAgora(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

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
  if (sessao.tipo !== 'promotor') return res.status(403).json({ erro: 'Somente promotores podem iniciar jornada' });

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

    const body = req.body || {};
    const iniciadoEm = body.iniciadoEm ? new Date(body.iniciadoEm) : new Date();
    if (Number.isNaN(iniciadoEm.getTime())) return res.status(400).json({ erro: 'iniciadoEm inválido' });
    const dataLocal = dataLocalAgora(iniciadoEm);
    const dispositivoId = typeof body.dispositivoId === 'string' ? body.dispositivoId.slice(0, 180) : '';
    const [jornada] = await sql`
      INSERT INTO jornadas (promotor, data_local, status, dispositivo_id, iniciado_em)
      VALUES (${sessao.nome}, ${dataLocal}, 'aberta', ${dispositivoId}, ${iniciadoEm.toISOString()})
      ON CONFLICT (promotor, data_local) DO UPDATE SET atualizado_em = NOW()
      RETURNING id, promotor, data_local, status, iniciado_em, encerrado_em
    `;
    return res.status(200).json({ ok: true, jornadaId: jornada.id, jornada });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
