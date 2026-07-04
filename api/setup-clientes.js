import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const sessao = autenticar(req);
  if (!sessao || (sessao.tipo !== 'gestor' && sessao.tipo !== 'diretoria')) {
    return res.status(403).json({ erro: 'Acesso restrito a gestores' });
  }

  const sql = neon(process.env.DATABASE_URL);

  // Cria tabela sem tocar em dados existentes
  await sql`
    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      codigo TEXT NOT NULL,
      promotor TEXT NOT NULL,
      nome_fantasia TEXT NOT NULL,
      cnpj TEXT DEFAULT '',
      tipo TEXT DEFAULT '',
      ie TEXT DEFAULT '',
      endereco TEXT DEFAULT '',
      cidade TEXT DEFAULT '',
      uf TEXT DEFAULT '',
      nome_comprador TEXT DEFAULT '',
      telefone TEXT DEFAULT '',
      distribuidor TEXT DEFAULT '',
      criado_em TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(promotor, nome_fantasia)
    )
  `;

  // Migra PDVs das visitas existentes (deduplicado por promotor + nome_fantasia)
  const visitas = await sql`SELECT promotor, dados, criado_em FROM visitas ORDER BY criado_em ASC`;

  let migrated = 0;
  let ignorados = 0;

  for (const v of visitas) {
    const dados = typeof v.dados === 'string' ? JSON.parse(v.dados) : v.dados;
    const pdv = dados?.pdv;
    if (!pdv?.nomeFantasia || !v.promotor) { ignorados++; continue; }

    // Verifica se já existe (case-insensitive)
    const existe = await sql`
      SELECT id FROM clientes
      WHERE promotor = ${v.promotor} AND lower(nome_fantasia) = lower(${pdv.nomeFantasia})
    `;
    if (existe.length > 0) { ignorados++; continue; }

    // Gera próximo código para este promotor
    const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM clientes WHERE promotor = ${v.promotor}`;
    const codigo = 'PDV-' + String(count + 1).padStart(3, '0');

    await sql`
      INSERT INTO clientes (codigo, promotor, nome_fantasia, cnpj, tipo, ie, endereco, cidade, uf, nome_comprador, telefone, distribuidor, criado_em)
      VALUES (
        ${codigo}, ${v.promotor}, ${pdv.nomeFantasia},
        ${pdv.cnpj||''}, ${pdv.tipo||''}, ${pdv.ie||''},
        ${pdv.endereco||''}, ${pdv.cidade||''}, ${pdv.uf||''},
        ${pdv.nomeComprador||''}, ${pdv.telefone||''}, ${pdv.distribuidor||''},
        ${v.criado_em}
      )
      ON CONFLICT (promotor, nome_fantasia) DO NOTHING
    `;
    migrated++;
  }

  return res.status(200).json({
    ok: true,
    migrated,
    ignorados,
    mensagem: `${migrated} clientes criados, ${ignorados} visitas ignoradas (duplicadas ou sem nome).`
  });
}
