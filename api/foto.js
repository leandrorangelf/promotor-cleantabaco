import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Vary', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' });

  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessao invalida ou expirada' });

  const { id, variant = 'full' } = req.query;
  const indexRaw = req.query.index;
  if (!id) return res.status(400).json({ erro: 'ID obrigatorio' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`select promotor, fotos from visitas where id = ${id} limit 1`;
    if (!rows.length) return res.status(404).json({ erro: 'Visita nao encontrada' });

    const visita = rows[0];
    if (sessao.tipo === 'promotor' && visita.promotor !== sessao.nome) {
      return res.status(403).json({ erro: 'Sem permissao para ver fotos desta visita' });
    }
    if (sessao.tipo === 'coordenador') {
      const promotores_permitidos = await sql`
        SELECT nome FROM promotores
        WHERE ativo = TRUE AND tipo = 'promotor' AND coordenador_usuario = ${sessao.usuario}
      `;
      const permitido = promotores_permitidos.some(p => p.nome === visita.promotor);
      if (!permitido) return res.status(403).json({ erro: 'Sem permissao para ver fotos desta visita' });
    }

    const fotos = (visita.fotos || []).map(f => {
      if (typeof f !== 'string') return f;
      try { return JSON.parse(f); } catch(e) { return { imagem: f, origem: 'legado' }; }
    });
    if (indexRaw !== undefined) {
      const index = Number(indexRaw);
      if (!Number.isInteger(index) || index < 0 || index >= fotos.length) {
        return res.status(404).json({ erro: 'Foto nao encontrada' });
      }
      const fotoOriginal = fotos[index];
      const variante = variant === 'thumb' ? 'thumb' : 'full';
      const foto = variante === 'thumb' && fotoOriginal?.miniatura
        ? { ...fotoOriginal, imagem: fotoOriginal.miniatura }
        : fotoOriginal;
      return res.status(200).json({ foto, variante });
    }
    return res.status(200).json({ fotos });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
