import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' });

  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessao invalida ou expirada' });

  let { promotor, de, ate, incluirProspeccao } = req.query;
  if (!promotor) return res.status(400).json({ erro: 'Promotor obrigatorio' });

  if (sessao.tipo === 'promotor') {
    if (promotor !== sessao.nome) return res.status(403).json({ erro: 'Sem permissao para ver dados de outro promotor' });
  }
  if (sessao.tipo === 'coordenador') {
    const sql = neon(process.env.DATABASE_URL);
    const permitido = await sql`
      SELECT id FROM promotores
      WHERE ativo = TRUE AND tipo = 'promotor' AND coordenador_usuario = ${sessao.usuario} AND nome = ${promotor}
      LIMIT 1
    `;
    if (!permitido.length) return res.status(403).json({ erro: 'Sem permissao para ver dados deste promotor' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = de && ate
      ? await sql`select dados, criado_em from visitas where promotor = ${promotor} and criado_em >= ${de}::timestamptz and criado_em <= ${ate}::timestamptz order by criado_em asc`
      : await sql`select dados, criado_em from visitas where promotor = ${promotor} order by criado_em asc`;

    const visitasComGps = rows
      .map(v => typeof v.dados === 'string' ? JSON.parse(v.dados) : v.dados)
      .map(d => ({ nome: d?.pdv?.nomeFantasia || 'PDV não identificado', localizacao: d?.localizacao, tipo: d?.tipo }))
      .filter(v => v.localizacao?.ok && Number.isFinite(+v.localizacao.latitude) && Number.isFinite(+v.localizacao.longitude))
      .filter(v => incluirProspeccao !== 'false' || v.tipo !== 'prospeccao');

    if (visitasComGps.length < 2) {
      return res.status(200).json({ km: null, motivo: 'Rota insuficiente (menos de 2 visitas com GPS no período)' });
    }

    const chave = process.env.GOOGLE_DIRECTIONS_API_KEY;
    if (!chave) {
      return res.status(200).json({ km: null, motivo: 'Chave do Google Directions nao configurada' });
    }

    const pontos = visitasComGps.map(v => `${v.localizacao.latitude},${v.localizacao.longitude}`);
    const origem = pontos[0];
    const destino = pontos[pontos.length - 1];
    const waypoints = pontos.slice(1, -1);
    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.set('origin', origem);
    url.searchParams.set('destination', destino);
    if (waypoints.length) url.searchParams.set('waypoints', waypoints.join('|'));
    url.searchParams.set('key', chave);

    const resposta = await fetch(url.toString());
    const dados = await resposta.json();
    if (dados.status !== 'OK' || !dados.routes?.length) {
      return res.status(200).json({ km: null, motivo: 'Nao foi possivel calcular a rota agora' });
    }

    const legs = dados.routes[0].legs;
    const metros = legs.reduce((soma, perna) => soma + (perna.distance?.value || 0), 0);
    const trechos = legs.map((perna, i) => ({
      de: visitasComGps[i].nome,
      para: visitasComGps[i + 1].nome,
      km: Math.round((perna.distance?.value || 0) / 100) / 10
    }));
    return res.status(200).json({ km: Math.round(metros / 100) / 10, trechos });
  } catch (e) {
    return res.status(200).json({ km: null, motivo: 'Erro ao calcular rota: ' + e.message });
  }
}
