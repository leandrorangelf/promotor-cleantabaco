import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PUT') return res.status(405).json({ erro: 'Método não permitido' });

  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessao invalida ou expirada' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    const { id, dados, fotos } = req.body;
    const promotor = sessao.tipo === 'promotor' ? sessao.nome : req.body.promotor;
    const atual = await sql`select dados from visitas where id = ${id} and promotor = ${promotor} limit 1`;
    const dadosAtuais = atual[0]?.dados;
    const dadosNormalizados = typeof dadosAtuais === 'string' ? JSON.parse(dadosAtuais) : dadosAtuais;
    const dadosParaSalvar = {
      ...(dados || {}),
      localizacao: dados?.localizacao || dadosNormalizados?.localizacao
    };
    await sql`update visitas set dados = ${JSON.stringify(dadosParaSalvar)}, fotos = ${fotos} where id = ${id} and promotor = ${promotor}`;
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
