import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

async function garantirTabela(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS validacoes_fotos (
      id SERIAL PRIMARY KEY,
      visita_id TEXT NOT NULL,
      promotor TEXT NOT NULL,
      cliente_nome TEXT DEFAULT '',
      foto_index INTEGER NOT NULL,
      imagem_hash TEXT DEFAULT '',
      status_ia TEXT NOT NULL DEFAULT 'pendente',
      score NUMERIC NOT NULL DEFAULT 0,
      motivo TEXT DEFAULT '',
      materiais_detectados JSONB NOT NULL DEFAULT '[]'::jsonb,
      status_manual TEXT DEFAULT '',
      revisado_por TEXT DEFAULT '',
      revisado_em TIMESTAMPTZ,
      possivel_reuso BOOLEAN NOT NULL DEFAULT FALSE,
      criado_em TIMESTAMPTZ DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(visita_id, foto_index)
    )
  `;
  try {
    await sql`ALTER TABLE validacoes_fotos ALTER COLUMN visita_id TYPE TEXT`;
  } catch (e) {
    // Coluna ja e TEXT ou tabela recem-criada — nao bloqueia o handler
  }
}

function normalizarDados(dados) {
  if (!dados) return {};
  if (typeof dados === 'string') {
    try { return JSON.parse(dados); } catch(e) { return {}; }
  }
  return dados;
}

function normalizarFoto(foto) {
  if (typeof foto !== 'string') return foto;
  try { return JSON.parse(foto); } catch(e) { return { imagem: foto, origem: 'legado' }; }
}

function statusIa(resultado = {}) {
  if (resultado.aprovado === true || resultado.status_ia === 'aprovado') return 'aprovado';
  const score = Number(resultado.score || 0);
  if (score >= 50) return 'revisao_manual';
  if (resultado.status_ia) return resultado.status_ia;
  return 'reprovado';
}

async function validarAcessoVisita(sql, sessao, visitaId) {
  const rows = await sql`SELECT id, promotor, dados FROM visitas WHERE id = ${visitaId} LIMIT 1`;
  if (!rows.length) return null;
  const visita = rows[0];
  if (sessao.tipo === 'promotor' && visita.promotor !== sessao.nome) return null;
  if (sessao.tipo === 'coordenador') {
    const permitido = await sql`
      SELECT id FROM promotores
      WHERE ativo = TRUE AND tipo = 'promotor' AND coordenador_usuario = ${sessao.usuario} AND nome = ${visita.promotor}
      LIMIT 1
    `;
    if (!permitido.length) return null;
  }
  return visita;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessao invalida ou expirada' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    await garantirTabela(sql);

    if (req.method === 'GET') {
      let { promotor, status = '', de = '', ate = '', limite = '80' } = req.query;
      const limiteFotos = Math.max(20, Math.min(120, Number(limite) || 80));
      if (sessao.tipo === 'promotor') promotor = sessao.nome;

      let promotoresPermitidos = null;
      if (sessao.tipo === 'coordenador') {
        const rowsPromotores = await sql`
          SELECT nome FROM promotores
          WHERE ativo = TRUE AND tipo = 'promotor' AND coordenador_usuario = ${sessao.usuario}
        `;
        promotoresPermitidos = rowsPromotores.map(p => p.nome);
        if (promotor && !promotoresPermitidos.includes(promotor)) {
          return res.status(403).json({ erro: 'Sem permissao para ver validacoes deste promotor' });
        }
      }

      let visitas;
      if (promotoresPermitidos && !promotor && de && ate) {
        visitas = promotoresPermitidos.length
          ? await sql`SELECT id, promotor, dados, criado_em, fotos FROM visitas WHERE promotor = ANY(${promotoresPermitidos}) AND jsonb_array_length(to_jsonb(fotos)) > 0 AND criado_em >= ${de}::timestamptz AND criado_em <= ${ate}::timestamptz ORDER BY criado_em DESC LIMIT 200`
          : [];
      } else if (promotoresPermitidos && !promotor) {
        visitas = promotoresPermitidos.length
          ? await sql`SELECT id, promotor, dados, criado_em, fotos FROM visitas WHERE promotor = ANY(${promotoresPermitidos}) AND jsonb_array_length(to_jsonb(fotos)) > 0 ORDER BY criado_em DESC LIMIT 200`
          : [];
      } else if (promotor && de && ate) {
        visitas = await sql`SELECT id, promotor, dados, criado_em, fotos FROM visitas WHERE promotor = ${promotor} AND jsonb_array_length(to_jsonb(fotos)) > 0 AND criado_em >= ${de}::timestamptz AND criado_em <= ${ate}::timestamptz ORDER BY criado_em DESC LIMIT 200`;
      } else if (promotor) {
        visitas = await sql`SELECT id, promotor, dados, criado_em, fotos FROM visitas WHERE promotor = ${promotor} AND jsonb_array_length(to_jsonb(fotos)) > 0 ORDER BY criado_em DESC LIMIT 200`;
      } else if (de && ate) {
        visitas = await sql`SELECT id, promotor, dados, criado_em, fotos FROM visitas WHERE jsonb_array_length(to_jsonb(fotos)) > 0 AND criado_em >= ${de}::timestamptz AND criado_em <= ${ate}::timestamptz ORDER BY criado_em DESC LIMIT 300`;
      } else {
        visitas = await sql`SELECT id, promotor, dados, criado_em, fotos FROM visitas WHERE jsonb_array_length(to_jsonb(fotos)) > 0 ORDER BY criado_em DESC LIMIT 300`;
      }

      const ids = visitas.map(v => v.id).filter(Boolean);
      const validacoes = ids.length
        ? await sql`SELECT * FROM validacoes_fotos WHERE visita_id = ANY(${ids})`
        : [];
      const porChave = new Map(validacoes.map(v => [`${v.visita_id}:${v.foto_index}`, v]));
      const hashCount = {};
      validacoes.forEach(v => {
        if (v.imagem_hash) hashCount[v.imagem_hash] = (hashCount[v.imagem_hash] || 0) + 1;
      });

      const itens = [];
      visitas.forEach(visita => {
        if (itens.length >= limiteFotos) return;
        const dados = normalizarDados(visita.dados);
        const fotos = Array.isArray(visita.fotos) ? visita.fotos : [];
        fotos.forEach((fotoRaw, index) => {
          if (itens.length >= limiteFotos) return;
          const foto = normalizarFoto(fotoRaw);
          const validacao = porChave.get(`${visita.id}:${index}`) || {};
          const itemStatus = validacao.status_manual || validacao.status_ia || 'pendente';
          if (status && itemStatus !== status) return;
          const hash = validacao.imagem_hash || foto?.imagemHash || '';
          itens.push({
            id: validacao.id || null,
            visita_id: visita.id,
            promotor: visita.promotor,
            cliente_nome: dados?.pdv?.nomeFantasia || validacao.cliente_nome || '',
            criado_em: visita.criado_em,
            foto_index: index,
            foto,
            imagem_hash: hash,
            origem: foto?.origem || 'legado',
            capturadaEm: foto?.capturadaEm || '',
            enviadaEm: foto?.enviadaEm || '',
            status_ia: validacao.status_ia || 'pendente',
            score: Number(validacao.score || 0),
            motivo: validacao.motivo || '',
            materiais_detectados: validacao.materiais_detectados || [],
            status_manual: validacao.status_manual || '',
            revisado_por: validacao.revisado_por || '',
            revisado_em: validacao.revisado_em || null,
            possivel_reuso: Boolean(validacao.possivel_reuso || (hash && hashCount[hash] > 1))
          });
        });
      });

      return res.status(200).json({ validacoes: itens });
    }

    if (req.method === 'POST') {
      const { visita_id, foto_index, imagem_hash = '', resultado = {}, cliente_nome = '' } = req.body || {};
      const visita = await validarAcessoVisita(sql, sessao, visita_id);
      if (!visita) return res.status(403).json({ erro: 'Sem permissao para registrar validacao desta visita' });

      const duplicadas = imagem_hash
        ? await sql`SELECT id FROM validacoes_fotos WHERE imagem_hash = ${imagem_hash} AND NOT (visita_id = ${String(visita_id)} AND foto_index = ${Number(foto_index)}) LIMIT 1`
        : [];
      const possivelReuso = duplicadas.length > 0;
      const status = possivelReuso ? 'revisao_manual' : statusIa(resultado);
      const [validacao] = await sql`
        INSERT INTO validacoes_fotos (
          visita_id, promotor, cliente_nome, foto_index, imagem_hash, status_ia,
          score, motivo, materiais_detectados, possivel_reuso, atualizado_em
        )
        VALUES (
          ${String(visita_id)}, ${visita.promotor}, ${cliente_nome}, ${Number(foto_index)}, ${imagem_hash},
          ${status}, ${Number(resultado.score || 0)}, ${resultado.motivo || ''},
          ${JSON.stringify(resultado.materiais_detectados || [])}::jsonb, ${possivelReuso}, NOW()
        )
        ON CONFLICT (visita_id, foto_index) DO UPDATE SET
          imagem_hash = EXCLUDED.imagem_hash,
          status_ia = EXCLUDED.status_ia,
          score = EXCLUDED.score,
          motivo = EXCLUDED.motivo,
          materiais_detectados = EXCLUDED.materiais_detectados,
          possivel_reuso = EXCLUDED.possivel_reuso,
          atualizado_em = NOW()
        RETURNING *
      `;
      return res.status(200).json({ validacao });
    }

    if (req.method === 'PUT') {
      if (sessao.tipo !== 'gestor') return res.status(403).json({ erro: 'Apenas gestor pode revisar validacoes' });
      const { id, status_manual } = req.body || {};
      if (!id || !['aprovado', 'reprovado', ''].includes(status_manual || '')) {
        return res.status(400).json({ erro: 'Revisao invalida' });
      }
      const [validacao] = await sql`
        UPDATE validacoes_fotos SET
          status_manual = ${status_manual || ''},
          revisado_por = ${sessao.nome || sessao.usuario || 'gestor'},
          revisado_em = NOW(),
          atualizado_em = NOW()
        WHERE id = ${Number(id)}
        RETURNING *
      `;
      return res.status(200).json({ validacao });
    }

    return res.status(405).json({ erro: 'Metodo nao permitido' });
  } catch (e) {
    console.error('validacoes-fotos erro:', e);
    return res.status(500).json({ erro: e.message });
  }
}
