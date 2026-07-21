import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';
import { avaliarFotoConfigurada } from './avaliar-foto.js';
import { garantirTabela, validarAcessoVisita } from './validacoes-fotos.js';

function normalizarFoto(foto) {
  if (typeof foto !== 'string') return foto || {};
  try { return JSON.parse(foto); } catch { return { imagem: foto, origem: 'legado' }; }
}

function statusFinal(item) {
  return Boolean(item?.status_manual) || ['aprovado','reprovado','revisao_manual'].includes(item?.status_ia);
}

function statusResultado(resultado = {}) {
  if (resultado.aprovado === true || resultado.status_ia === 'aprovado') return 'aprovado';
  if (resultado.status_ia === 'reprovado') return 'reprovado';
  return 'revisao_manual';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Metodo nao permitido' });

  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessao invalida ou expirada' });
  if (sessao.tipo === 'promotor') return res.status(403).json({ erro: 'Analise disponivel apenas no painel de gestao' });

  const { visita_id, foto_index, reanalisar = false } = req.body || {};
  const indice = Number(foto_index);
  if (!visita_id || !Number.isInteger(indice) || indice < 0) return res.status(400).json({ erro: 'Foto invalida' });

  const sql = neon(process.env.DATABASE_URL);
  try {
    await garantirTabela(sql);
    const visita = await validarAcessoVisita(sql, sessao, visita_id, true);
    if (!visita) return res.status(403).json({ erro: 'Sem permissao para analisar esta foto' });
    const fotos = Array.isArray(visita.fotos) ? visita.fotos : [];
    if (indice >= fotos.length) return res.status(404).json({ erro: 'Foto nao encontrada' });

    const existentes = await sql`
      SELECT * FROM validacoes_fotos WHERE visita_id = ${String(visita_id)} AND foto_index = ${indice} LIMIT 1
    `;
    if (existentes[0] && statusFinal(existentes[0]) && reanalisar !== true) {
      return res.status(200).json({ validacao: existentes[0], reutilizada: true });
    }

    const dados = typeof visita.dados === 'string' ? JSON.parse(visita.dados) : (visita.dados || {});
    const foto = normalizarFoto(fotos[indice]);
    const [claim] = await sql`
      INSERT INTO validacoes_fotos (visita_id, promotor, cliente_nome, foto_index, imagem_hash, status_ia, atualizado_em)
      VALUES (${String(visita_id)}, ${visita.promotor}, ${dados?.pdv?.nomeFantasia || ''}, ${indice}, ${foto.imagemHash || ''}, 'analisando', NOW())
      ON CONFLICT (visita_id, foto_index) DO UPDATE SET status_ia = 'analisando', erro_ia = '', atualizado_em = NOW()
      WHERE validacoes_fotos.status_ia <> 'analisando'
        AND (${reanalisar === true} OR COALESCE(validacoes_fotos.status_ia,'') IN ('','pendente','erro'))
      RETURNING *
    `;
    if (!claim) return res.status(409).json({ erro: 'Esta foto ja esta sendo analisada' });

    try {
      const resultado = await avaliarFotoConfigurada(foto.imagem || foto);
      const uso = resultado.uso || {};
      const [validacao] = await sql`
        UPDATE validacoes_fotos SET
          status_ia = ${statusResultado(resultado)}, score = ${Number(resultado.score || 0)},
          motivo = ${resultado.motivo || ''}, materiais_detectados = ${JSON.stringify(resultado.materiais_detectados || [])}::jsonb,
          possivel_reuso = COALESCE(possivel_reuso,FALSE), modelo_ia = ${uso.modelo || ''},
          input_tokens = ${Number(uso.input_tokens || 0)}, output_tokens = ${Number(uso.output_tokens || 0)},
          custo_usd_estimado = ${Number(uso.custo_usd_estimado || 0)}, erro_ia = '', atualizado_em = NOW()
        WHERE visita_id = ${String(visita_id)} AND foto_index = ${indice}
        RETURNING *
      `;
      return res.status(200).json({ validacao, reutilizada: false });
    } catch (e) {
      await sql`
        UPDATE validacoes_fotos SET status_ia = 'erro', erro_ia = ${e.message}, motivo = ${'IA indisponivel: ' + e.message}, atualizado_em = NOW()
        WHERE visita_id = ${String(visita_id)} AND foto_index = ${indice}
      `;
      return res.status(502).json({ erro: 'Nao foi possivel analisar a foto agora', detalhe: e.message });
    }
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
