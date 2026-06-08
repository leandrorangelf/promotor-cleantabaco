import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    const { promotor, de, ate } = req.query;

    let rows;
    if (promotor && de && ate) {
      rows = await sql`select * from visitas where promotor = ${promotor} and criado_em >= ${de}::timestamptz and criado_em <= ${ate}::timestamptz order by criado_em desc`;
    } else if (promotor) {
      rows = await sql`select * from visitas where promotor = ${promotor} order by criado_em desc limit 200`;
    } else if (de && ate) {
      rows = await sql`select * from visitas where criado_em >= ${de}::timestamptz and criado_em <= ${ate}::timestamptz order by criado_em desc`;
    } else {
      rows = await sql`select * from visitas order by criado_em desc limit 500`;
    }

    return res.status(200).json({ visitas: rows });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
