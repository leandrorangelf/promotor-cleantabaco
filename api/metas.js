import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

const METAS_PADRAO = [
  ['pdvs_cadastrados', 'global', 'global', 200],
  ['pdvs_visitados_mes', 'global', 'global', 200],
  ['tabela_percentual', 'global', 'global', 50],
  ['pedidos_mes', 'global', 'global', 10],
  ['cliente_novo_positivado', 'global', 'global', 1]
];

async function garantirTabela(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS metas (
      id SERIAL PRIMARY KEY,
      tipo_meta TEXT NOT NULL,
      escopo_tipo TEXT NOT NULL DEFAULT 'global',
      escopo_valor TEXT NOT NULL DEFAULT 'global',
      valor NUMERIC NOT NULL,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      criado_em TIMESTAMPTZ DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tipo_meta, escopo_tipo, escopo_valor)
    )
  `;

  for (const [tipo, escopoTipo, escopoValor, valor] of METAS_PADRAO) {
    await sql`
      INSERT INTO metas (tipo_meta, escopo_tipo, escopo_valor, valor, ativo)
      VALUES (${tipo}, ${escopoTipo}, ${escopoValor}, ${valor}, TRUE)
      ON CONFLICT (tipo_meta, escopo_tipo, escopo_valor) DO NOTHING
    `;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessao invalida ou expirada' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    await garantirTabela(sql);

    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM metas WHERE ativo = TRUE ORDER BY tipo_meta, escopo_tipo, escopo_valor`;
      return res.status(200).json({ metas: rows.map(m => ({ ...m, valor: Number(m.valor) })) });
    }

    if (req.method === 'POST') {
      if (sessao.tipo !== 'gestor') return res.status(403).json({ erro: 'Apenas gestor pode editar metas' });
      const { tipo_meta, escopo_tipo = 'global', escopo_valor = 'global', valor } = req.body || {};
      if (!tipo_meta || !escopo_tipo || !escopo_valor || Number(valor) < 0) {
        return res.status(400).json({ erro: 'Dados da meta invalidos' });
      }
      const [meta] = await sql`
        INSERT INTO metas (tipo_meta, escopo_tipo, escopo_valor, valor, ativo, atualizado_em)
        VALUES (${tipo_meta}, ${escopo_tipo}, ${escopo_valor}, ${Number(valor)}, TRUE, NOW())
        ON CONFLICT (tipo_meta, escopo_tipo, escopo_valor) DO UPDATE SET
          valor = EXCLUDED.valor,
          ativo = TRUE,
          atualizado_em = NOW()
        RETURNING *
      `;
      return res.status(200).json({ meta: { ...meta, valor: Number(meta.valor) } });
    }

    return res.status(405).json({ erro: 'Metodo nao permitido' });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
