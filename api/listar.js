import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' });

  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessao invalida ou expirada' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    let { promotor, de, ate } = req.query;

    if (sessao.tipo === 'promotor') {
      if (promotor && promotor !== sessao.nome) {
        return res.status(403).json({ erro: 'Sem permissao para ver dados de outro promotor' });
      }
      promotor = sessao.nome;
    }

    let rows;
    if (promotor && de && ate) {
      rows = await sql`select id, promotor, regiao, dados, criado_em, coalesce(jsonb_array_length(to_jsonb(fotos)),0) as fotos_count from visitas where promotor = ${promotor} and criado_em >= ${de}::timestamptz and criado_em <= ${ate}::timestamptz order by criado_em desc`;
    } else if (promotor) {
      rows = await sql`select id, promotor, regiao, dados, criado_em, coalesce(jsonb_array_length(to_jsonb(fotos)),0) as fotos_count from visitas where promotor = ${promotor} order by criado_em desc limit 200`;
    } else if (de && ate) {
      rows = await sql`select id, promotor, regiao, dados, criado_em, coalesce(jsonb_array_length(to_jsonb(fotos)),0) as fotos_count from visitas where criado_em >= ${de}::timestamptz and criado_em <= ${ate}::timestamptz order by criado_em desc`;
    } else {
      rows = await sql`select id, promotor, regiao, dados, criado_em, coalesce(jsonb_array_length(to_jsonb(fotos)),0) as fotos_count from visitas order by criado_em desc limit 500`;
    }

    return res.status(200).json({ visitas: rows });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
