import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'GET') {
    const { promotor, q } = req.query;
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
    const { promotor, nome_fantasia, cnpj, tipo, ie, endereco, cidade, uf, nome_comprador, telefone, distribuidor } = req.body;
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
