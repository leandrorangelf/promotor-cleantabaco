import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

async function preparar(sql) {
  await sql`CREATE TABLE IF NOT EXISTS app_presencas (
    usuario TEXT PRIMARY KEY,
    promotor TEXT NOT NULL,
    versao_nome TEXT NOT NULL DEFAULT '',
    versao_codigo INTEGER NOT NULL DEFAULT 0,
    plataforma TEXT NOT NULL DEFAULT 'android',
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessão inválida ou expirada' });
  try {
    const sql = neon(process.env.DATABASE_URL);
    await preparar(sql);
    if (req.method === 'POST') {
      if (!(sessao.tipo === 'promotor')) return res.status(403).json({ erro: 'Somente promotor registra presença' });
      const nome = String(req.body?.versaoNome || '').slice(0, 40);
      const codigo = Number(req.body?.versaoCodigo || 0);
      await sql`INSERT INTO app_presencas (usuario, promotor, versao_nome, versao_codigo, plataforma)
        VALUES (${sessao.usuario}, ${sessao.nome}, ${nome}, ${Number.isInteger(codigo) ? codigo : 0}, 'android')
        ON CONFLICT (usuario) DO UPDATE SET promotor = EXCLUDED.promotor, versao_nome = EXCLUDED.versao_nome,
          versao_codigo = EXCLUDED.versao_codigo, atualizado_em = NOW()`;
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'GET' && ['gestor', 'diretoria'].includes(sessao.tipo)) {
      const presencas = await sql`SELECT usuario, promotor, versao_nome, versao_codigo, atualizado_em FROM app_presencas ORDER BY promotor`;
      return res.status(200).json({ ok: true, presencas, versaoAtual: { nome: '1.1.0', codigo: 2 } });
    }
    return res.status(405).json({ erro: 'Método não permitido' });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
