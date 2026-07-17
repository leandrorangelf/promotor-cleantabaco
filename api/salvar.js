import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

function haversineMetros(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pedidoConfirmadoSemValor(dados = {}) {
  const comercial = dados?.comercial || {};
  if (!['Pedido confirmado', 'Pedido entregue'].includes(comercial.statusPedido) || comercial.pedidoFeito !== 'Sim') return false;
  const qty = comercial.pedidoPac || comercial.pedidoQty || {};
  const preco = comercial.pedidoPreco || {};
  const total = ['GR', 'GM', 'CM', 'CC'].reduce((sum, sku) => sum + (Number(qty[sku]) || 0) * (Number(preco[sku]) || 0), 0);
  return total <= 0;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessao invalida ou expirada' });

  if (pedidoConfirmadoSemValor(req.body?.dados)) {
    return res.status(422).json({ erro: 'Pedido confirmado ou entregue exige valor' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const { dados, fotos } = req.body;
    const promotor = sessao.tipo === 'promotor' ? sessao.nome : req.body.promotor;
    const [visita] = await sql`
      insert into visitas (promotor, regiao, dados, fotos)
      values (${promotor}, ${''}, ${JSON.stringify(dados)}, ${fotos})
      RETURNING id
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
          await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`;
          await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`;
          await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS suspeito_duplicata BOOLEAN DEFAULT FALSE`;

          const loc = dados?.localizacao;
          const lat = (loc?.ok && Number.isFinite(+loc.latitude)) ? +loc.latitude : null;
          const lng = (loc?.ok && Number.isFinite(+loc.longitude)) ? +loc.longitude : null;

          let suspeito_duplicata = false;
          if (lat && lng) {
            const delta = 0.00045;
            const proximos = await sql`
              SELECT latitude, longitude FROM clientes
              WHERE promotor = ${promotor}
                AND latitude BETWEEN ${lat - delta} AND ${lat + delta}
                AND longitude BETWEEN ${lng - delta} AND ${lng + delta}
            `;
            suspeito_duplicata = proximos.some(c => haversineMetros(lat, lng, c.latitude, c.longitude) < 50);
          }

          const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM clientes WHERE promotor = ${promotor}`;
          const codigo = 'PDV-' + String(count + 1).padStart(3, '0');
          await sql`
            INSERT INTO clientes (codigo, promotor, nome_fantasia, cnpj, tipo, ie, endereco, cidade, uf, nome_comprador, telefone, distribuidor, latitude, longitude, suspeito_duplicata)
            VALUES (${codigo}, ${promotor}, ${pdv.nomeFantasia}, ${pdv.cnpj||''}, ${pdv.tipo||''}, ${pdv.ie||''}, ${pdv.endereco||''}, ${pdv.cidade||''}, ${pdv.uf||''}, ${pdv.nomeComprador||''}, ${pdv.telefone||''}, ${pdv.distribuidor||''}, ${lat}, ${lng}, ${suspeito_duplicata})
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

    return res.status(200).json({ ok: true, id: visita?.id });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
