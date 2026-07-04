import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessao invalida ou expirada' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    const { dados, fotos } = req.body;
    const promotor = sessao.tipo === 'promotor' ? sessao.nome : req.body.promotor;
    await sql`
      insert into visitas (promotor, regiao, dados, fotos)
      values (${promotor}, ${''}, ${JSON.stringify(dados)}, ${fotos})
    `;

    // Upsert automático do cliente na carteira
    const pdv = dados?.pdv;
    if (pdv?.nomeFantasia && promotor) {
      try {
        const existe = await sql`
          SELECT id FROM clientes
          WHERE promotor = ${promotor} AND lower(nome_fantasia) = lower(${pdv.nomeFantasia})
        `;
        if (existe.length === 0) {
          const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM clientes WHERE promotor = ${promotor}`;
          const codigo = 'PDV-' + String(count + 1).padStart(3, '0');
          await sql`
            INSERT INTO clientes (codigo, promotor, nome_fantasia, cnpj, tipo, ie, endereco, cidade, uf, nome_comprador, telefone, distribuidor)
            VALUES (${codigo}, ${promotor}, ${pdv.nomeFantasia}, ${pdv.cnpj||''}, ${pdv.tipo||''}, ${pdv.ie||''}, ${pdv.endereco||''}, ${pdv.cidade||''}, ${pdv.uf||''}, ${pdv.nomeComprador||''}, ${pdv.telefone||''}, ${pdv.distribuidor||''})
            ON CONFLICT (promotor, nome_fantasia) DO NOTHING
          `;
        } else {
          await sql`
            UPDATE clientes SET
              cnpj = ${pdv.cnpj||''}, tipo = ${pdv.tipo||''}, ie = ${pdv.ie||''},
              endereco = ${pdv.endereco||''}, cidade = ${pdv.cidade||''}, uf = ${pdv.uf||''},
              nome_comprador = ${pdv.nomeComprador||''}, telefone = ${pdv.telefone||''}, distribuidor = ${pdv.distribuidor||''}
            WHERE promotor = ${promotor} AND lower(nome_fantasia) = lower(${pdv.nomeFantasia})
          `;
        }
      } catch(e) {
        // Tabela ainda não criada — não bloqueia o salvamento da visita
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
