import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

function mesclarDadosVisita(atuais = {}, alteracoes = {}) {
  const base = (atuais && typeof atuais === 'object' && !Array.isArray(atuais)) ? atuais : {};
  const patch = (alteracoes && typeof alteracoes === 'object' && !Array.isArray(alteracoes)) ? alteracoes : {};
  const resultado = { ...base };
  Object.entries(patch).forEach(([chave, valor]) => {
    if (valor && typeof valor === 'object' && !Array.isArray(valor) && base[chave] && typeof base[chave] === 'object' && !Array.isArray(base[chave])) {
      resultado[chave] = mesclarDadosVisita(base[chave], valor);
    } else if (valor !== undefined) {
      resultado[chave] = valor;
    }
  });
  return resultado;
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
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PUT') return res.status(405).json({ erro: 'Método não permitido' });

  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessao invalida ou expirada' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    const { id, dados, fotos } = req.body;
    const atual = await sql`select id, promotor, dados, fotos from visitas where id = ${id} limit 1`;
    if (!atual.length) return res.status(404).json({ erro: 'Visita nao encontrada' });
    const promotor = sessao.tipo === 'promotor' ? sessao.nome : atual[0].promotor;
    if (sessao.tipo !== 'promotor' && sessao.tipo !== 'gestor') {
      return res.status(403).json({ erro: 'Sem permissao para editar visitas' });
    }
    if (sessao.tipo === 'promotor' && atual[0].promotor !== sessao.nome) {
      return res.status(403).json({ erro: 'Sem permissao para editar esta visita' });
    }
    const dadosAtuais = atual[0].dados;
    const dadosNormalizados = typeof dadosAtuais === 'string' ? JSON.parse(dadosAtuais) : dadosAtuais;
    const dadosParaSalvar = mesclarDadosVisita(dadosNormalizados, dados);
    if (pedidoConfirmadoSemValor(dadosParaSalvar)) {
      return res.status(422).json({ erro: 'Pedido confirmado ou entregue exige valor' });
    }
    const fotosAtuais = atual[0].fotos || [];
    const fotosAtualizadas = fotos === undefined ? fotosAtuais : fotos;
    await sql`update visitas set dados = ${JSON.stringify(dadosParaSalvar)}, fotos = ${fotosAtualizadas} where id = ${id} and promotor = ${promotor}`;
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
