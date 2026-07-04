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

  const { id } = req.query;
  if (!id) return res.status(400).json({ erro: 'ID obrigatorio' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`select promotor, fotos from visitas where id = ${id} limit 1`;
    if (!rows.length) return res.status(404).json({ erro: 'Visita nao encontrada' });

    const visita = rows[0];
    if (sessao.tipo === 'promotor' && visita.promotor !== sessao.nome) {
      return res.status(403).json({ erro: 'Sem permissao para ver fotos desta visita' });
    }

    return res.status(200).json({ fotos: visita.fotos || [] });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
