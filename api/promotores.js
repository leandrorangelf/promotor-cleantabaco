import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

const LEGADOS = [
  { nome: 'Leandro', usuario: 'leandro', senha: 'Lx9#mK2p', tipo: 'gestor' },
  { nome: 'Diretoria', usuario: 'diretoria', senha: 'Dir@2026', tipo: 'diretoria' },
  { nome: 'Francisco', usuario: 'francisco', senha: 'Fj4@nR7w', tipo: 'promotor' },
  { nome: 'Anderson', usuario: 'anderson', senha: 'Ak8!qT3v', tipo: 'promotor' },
  { nome: 'Andre', usuario: 'andre', senha: 'Ad6#hW5z', tipo: 'promotor' },
  { nome: 'Cristiano', usuario: 'cristiano', senha: 'Cr2@bN9x', tipo: 'promotor' },
  { nome: 'Jarbas', usuario: 'jarbas', senha: 'Jb7!sM4k', tipo: 'promotor' },
  { nome: 'Kayan', usuario: 'kayan', senha: 'Ky3#tP6q', tipo: 'promotor' },
  { nome: 'Wil', usuario: 'wil', senha: 'Wi5@dL8n', tipo: 'promotor' }
];

function normalizarUsuario(valor = '') {
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .trim();
}

function hashSenha(senha = '') {
  return createHash('sha256').update(String(senha)).digest('hex');
}

async function garantirTabela(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS promotores (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      usuario TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      senha_hash TEXT,
      tipo TEXT NOT NULL DEFAULT 'promotor',
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      criado_em TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE promotores ADD COLUMN IF NOT EXISTS senha_hash TEXT`;

  for (const p of LEGADOS) {
    await sql`
      INSERT INTO promotores (nome, usuario, senha, senha_hash, tipo, ativo)
      VALUES (${p.nome}, ${p.usuario}, ${''}, ${hashSenha(p.senha)}, ${p.tipo}, TRUE)
      ON CONFLICT (usuario) DO NOTHING
    `;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sql = neon(process.env.DATABASE_URL);
    await garantirTabela(sql);

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, nome, usuario, tipo, ativo, criado_em
        FROM promotores
        ORDER BY ativo DESC, tipo, nome
      `;
      return res.status(200).json({ promotores: rows });
    }

    if (req.method === 'POST') {
      const { nome, usuario, senha, tipo = 'promotor' } = req.body || {};
      const user = normalizarUsuario(usuario || nome);
      if (!nome || !user || !senha) {
        return res.status(400).json({ erro: 'Nome, usuario e senha sao obrigatorios' });
      }

      const [novo] = await sql`
        INSERT INTO promotores (nome, usuario, senha, senha_hash, tipo, ativo)
        VALUES (${nome.trim()}, ${user}, ${''}, ${hashSenha(senha)}, ${tipo}, TRUE)
        ON CONFLICT (usuario) DO UPDATE SET
          nome = EXCLUDED.nome,
          senha = EXCLUDED.senha,
          senha_hash = EXCLUDED.senha_hash,
          tipo = EXCLUDED.tipo,
          ativo = TRUE
        RETURNING id, nome, usuario, tipo, ativo, criado_em
      `;
      return res.status(201).json({ promotor: novo });
    }

    if (req.method === 'PUT') {
      const { id, nome, usuario, senha, tipo = 'promotor', ativo = true } = req.body || {};
      if (!id || !nome || !usuario) return res.status(400).json({ erro: 'Dados incompletos' });
      const user = normalizarUsuario(usuario);

      const [editado] = senha
        ? await sql`
            UPDATE promotores
            SET nome = ${nome.trim()}, usuario = ${user}, senha = ${''}, senha_hash = ${hashSenha(senha)}, tipo = ${tipo}, ativo = ${!!ativo}
            WHERE id = ${id}
            RETURNING id, nome, usuario, tipo, ativo, criado_em
          `
        : await sql`
            UPDATE promotores
            SET nome = ${nome.trim()}, usuario = ${user}, tipo = ${tipo}, ativo = ${!!ativo}
            WHERE id = ${id}
            RETURNING id, nome, usuario, tipo, ativo, criado_em
          `;
      return res.status(200).json({ promotor: editado });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ erro: 'ID obrigatorio' });
      await sql`UPDATE promotores SET ativo = FALSE WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ erro: 'Metodo nao permitido' });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
