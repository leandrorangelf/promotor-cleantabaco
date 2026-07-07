import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';
import { criarToken } from './_auth.js';

const LEGADOS = [
  { nome: 'Leandro', usuario: 'leandro', senha: 'Lx9#mK2p', tipo: 'gestor' },
  { nome: 'Diretoria', usuario: 'diretoria', senha: 'Dir@2026', tipo: 'diretoria' },
  { nome: 'Francisco', usuario: 'francisco', senha: 'Fj4@nR7w', tipo: 'promotor' },
  { nome: 'Andre', usuario: 'andre', senha: 'Ad6#hW5z', tipo: 'promotor' },
  { nome: 'Cristiano', usuario: 'cristiano', senha: 'Cr2@bN9x', tipo: 'promotor' },
  { nome: 'Jarbas', usuario: 'jarbas', senha: 'Jb7!sM4k', tipo: 'promotor' },
  { nome: 'Kayan', usuario: 'kayan', senha: 'Ky3#tP6q', tipo: 'promotor' },
  { nome: 'Wil', usuario: 'wil', senha: 'Wi5@dL8n', tipo: 'promotor' }
];

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

function normalizarUsuario(valor = '') {
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Metodo nao permitido' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    await garantirTabela(sql);

    const { usuario, senha } = req.body || {};
    const user = normalizarUsuario(usuario);
    if (!user || !senha) return res.status(400).json({ erro: 'Usuario e senha obrigatorios' });

    const rows = await sql`
      SELECT id, nome, usuario, tipo, ativo
      FROM promotores
      WHERE usuario = ${user}
        AND ativo = TRUE
        AND (senha_hash = ${hashSenha(senha)} OR senha = ${senha})
      LIMIT 1
    `;

    if (!rows.length) return res.status(401).json({ erro: 'Usuario ou senha invalidos' });
    const contaLogada = rows[0];
    const token = criarToken({ usuario: contaLogada.usuario, nome: contaLogada.nome, tipo: contaLogada.tipo });
    return res.status(200).json({ usuario: contaLogada, token });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
