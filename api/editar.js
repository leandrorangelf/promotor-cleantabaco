import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PUT') return res.status(405).json({ erro: 'Método não permitido' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    const { id, promotor, dados, fotos } = req.body;
    await sql`update visitas set dados = ${JSON.stringify(dados)}, fotos = ${fotos} where id = ${id} and promotor = ${promotor}`;
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
