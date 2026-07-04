import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ erro: 'Método não permitido' });

  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessao invalida ou expirada' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    const { id } = req.body;
    const souGestor = sessao.tipo === 'gestor' || sessao.tipo === 'diretoria';
    if (souGestor) {
      await sql`delete from visitas where id = ${id}`;
    } else {
      await sql`delete from visitas where id = ${id} and promotor = ${sessao.nome}`;
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
