import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    const { promotor, dados, fotos } = req.body;
    await sql`
      insert into visitas (promotor, regiao, dados, fotos)
      values (${promotor}, ${''}, ${JSON.stringify(dados)}, ${fotos})
    `;
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
