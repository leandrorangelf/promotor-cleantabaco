import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

async function garantirTabela(sql) {
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

  // Se a tabela acabou de ser criada (vazia), migra as visitas existentes
  const [{ total }] = await sql`SELECT COUNT(*)::int as total FROM clientes`;
  if (total === 0) {
    const visitas = await sql`SELECT promotor, dados, criado_em FROM visitas ORDER BY criado_em ASC`;
    for (const v of visitas) {
      const dados = typeof v.dados === 'string' ? JSON.parse(v.dados) : v.dados;
      const pdv = dados?.pdv;
      if (!pdv?.nomeFantasia || !v.promotor) continue;
      const existe = await sql`SELECT id FROM clientes WHERE promotor = ${v.promotor} AND lower(nome_fantasia) = lower(${pdv.nomeFantasia})`;
      if (existe.length > 0) continue;
      const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM clientes WHERE promotor = ${v.promotor}`;
      const codigo = 'PDV-' + String(count + 1).padStart(3, '0');
      await sql`
        INSERT INTO clientes (codigo, promotor, nome_fantasia, cnpj, tipo, ie, endereco, cidade, uf, nome_comprador, telefone, distribuidor, criado_em)
        VALUES (${codigo}, ${v.promotor}, ${pdv.nomeFantasia}, ${pdv.cnpj||''}, ${pdv.tipo||''}, ${pdv.ie||''}, ${pdv.endereco||''}, ${pdv.cidade||''}, ${pdv.uf||''}, ${pdv.nomeComprador||''}, ${pdv.telefone||''}, ${pdv.distribuidor||''}, ${v.criado_em})
        ON CONFLICT (promotor, nome_fantasia) DO NOTHING
      `;
    }
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessao invalida ou expirada' });

  const sql = neon(process.env.DATABASE_URL);
  await garantirTabela(sql);

  if (req.method === 'GET') {
    let { promotor, q } = req.query;
    if (sessao.tipo === 'promotor') promotor = sessao.nome;
    if (!promotor) return res.status(400).json({ erro: 'Promotor obrigatório' });
    let rows;
    if (q && q.trim()) {
      const busca = `%${q.trim()}%`;
      rows = await sql`
        SELECT * FROM clientes
        WHERE promotor = ${promotor}
          AND (nome_fantasia ILIKE ${busca} OR cnpj LIKE ${busca})
        ORDER BY nome_fantasia LIMIT 30
      `;
    } else {
      rows = await sql`
        SELECT * FROM clientes WHERE promotor = ${promotor}
        ORDER BY nome_fantasia LIMIT 100
      `;
    }
    return res.status(200).json({ clientes: rows });
  }

  if (req.method === 'POST') {
    const { nome_fantasia, cnpj, tipo, ie, endereco, cidade, uf, nome_comprador, telefone, distribuidor } = req.body;
    const promotor = sessao.tipo === 'promotor' ? sessao.nome : req.body.promotor;
    if (!promotor || !nome_fantasia) return res.status(400).json({ erro: 'Promotor e nome são obrigatórios' });

    const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM clientes WHERE promotor = ${promotor}`;
    const codigo = 'PDV-' + String(count + 1).padStart(3, '0');

    const [novo] = await sql`
      INSERT INTO clientes (codigo, promotor, nome_fantasia, cnpj, tipo, ie, endereco, cidade, uf, nome_comprador, telefone, distribuidor)
      VALUES (${codigo}, ${promotor}, ${nome_fantasia}, ${cnpj||''}, ${tipo||''}, ${ie||''}, ${endereco||''}, ${cidade||''}, ${uf||''}, ${nome_comprador||''}, ${telefone||''}, ${distribuidor||''})
      ON CONFLICT (promotor, nome_fantasia) DO UPDATE SET
        cnpj = EXCLUDED.cnpj, tipo = EXCLUDED.tipo, ie = EXCLUDED.ie,
        endereco = EXCLUDED.endereco, cidade = EXCLUDED.cidade, uf = EXCLUDED.uf,
        nome_comprador = EXCLUDED.nome_comprador, telefone = EXCLUDED.telefone,
        distribuidor = EXCLUDED.distribuidor
      RETURNING *
    `;
    return res.status(201).json({ cliente: novo });
  }

  return res.status(405).json({ erro: 'Método não permitido' });
}
