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
    let promotores_permitidos = null;

    if (sessao.tipo === 'promotor') {
      if (promotor && promotor !== sessao.nome) {
        return res.status(403).json({ erro: 'Sem permissao para ver dados de outro promotor' });
      }
      promotor = sessao.nome;
    }

    if (sessao.tipo === 'coordenador') {
      const rowsPromotores = await sql`
        SELECT nome FROM promotores
        WHERE ativo = TRUE AND tipo = 'promotor' AND coordenador_usuario = ${sessao.usuario}
      `;
      promotores_permitidos = rowsPromotores.map(p => p.nome);
      if (promotor && !promotores_permitidos.includes(promotor)) {
        return res.status(403).json({ erro: 'Sem permissao para ver dados deste promotor' });
      }
    }

    let rows;
    if (promotores_permitidos && !promotor && de && ate) {
      rows = promotores_permitidos.length
        ? await sql`select id, promotor, regiao, dados, criado_em, coalesce(jsonb_array_length(to_jsonb(fotos)),0) as fotos_count from visitas where promotor = ANY(${promotores_permitidos}) and criado_em >= ${de}::timestamptz and criado_em <= ${ate}::timestamptz order by criado_em desc`
        : [];
    } else if (promotores_permitidos && !promotor) {
      rows = promotores_permitidos.length
        ? await sql`select id, promotor, regiao, dados, criado_em, coalesce(jsonb_array_length(to_jsonb(fotos)),0) as fotos_count from visitas where promotor = ANY(${promotores_permitidos}) order by criado_em desc limit 500`
        : [];
    } else if (promotor && de && ate) {
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
