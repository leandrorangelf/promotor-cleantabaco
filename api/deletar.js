import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ erro: 'Método não permitido' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    const { id, promotor, gestor } = req.body;
    if (gestor) {
      await sql`delete from visitas where id = ${id}`;
    } else {
      await sql`delete from visitas where id = ${id} and promotor = ${promotor}`;
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
