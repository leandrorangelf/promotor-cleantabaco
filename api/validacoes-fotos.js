import { neon } from '@neondatabase/serverless';
import { autenticar } from './_auth.js';

export async function garantirTabela(sql) {
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
  await sql`ALTER TABLE validacoes_fotos ADD COLUMN IF NOT EXISTS modelo_ia TEXT DEFAULT ''`;
  await sql`ALTER TABLE validacoes_fotos ADD COLUMN IF NOT EXISTS input_tokens INTEGER DEFAULT 0`;
  await sql`ALTER TABLE validacoes_fotos ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0`;
  await sql`ALTER TABLE validacoes_fotos ADD COLUMN IF NOT EXISTS custo_usd_estimado NUMERIC DEFAULT 0`;
  await sql`ALTER TABLE validacoes_fotos ADD COLUMN IF NOT EXISTS erro_ia TEXT DEFAULT ''`;
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

function codificarCursor(item) {
  if (!item) return '';
  return Buffer.from(JSON.stringify({ criado_em: item.criado_em, visita_id: String(item.visita_id), foto_index: Number(item.foto_index) })).toString('base64url');
}

function decodificarCursor(valor = '') {
  if (!valor) return null;
  try {
    const cursor = JSON.parse(Buffer.from(String(valor), 'base64url').toString('utf8'));
    if (!cursor.criado_em || cursor.visita_id == null || !Number.isInteger(Number(cursor.foto_index))) throw new Error('incompleto');
    return cursor;
  } catch {
    throw new Error('Cursor invalido');
  }
}

function statusIa(resultado = {}) {
  if (resultado.aprovado === true || resultado.status_ia === 'aprovado') return 'aprovado';
  if (resultado.status_ia === 'reprovado') return 'reprovado';
  return 'revisao_manual';
}

export async function validarAcessoVisita(sql, sessao, visitaId, incluirFotos = false) {
  const rows = incluirFotos
    ? await sql`SELECT id, promotor, dados, fotos FROM visitas WHERE id = ${visitaId} LIMIT 1`
    : await sql`SELECT id, promotor, dados FROM visitas WHERE id = ${visitaId} LIMIT 1`;
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
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sessao = autenticar(req);
  if (!sessao) return res.status(401).json({ erro: 'Sessao invalida ou expirada' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    await garantirTabela(sql);

    if (req.method === 'GET') {
      let { promotor, status = '', de = '', ate = '', limite = '24', cursor: cursorRaw = '' } = req.query;
      const limiteFotos = Math.max(1, Math.min(48, Number(limite) || 24));
      const cursor = decodificarCursor(cursorRaw);
      if (sessao.tipo === 'promotor') promotor = sessao.nome;

      let promotoresPermitidos = [];
      let restringePromotores = false;
      if (sessao.tipo === 'coordenador') {
        const rowsPromotores = await sql`
          SELECT nome FROM promotores
          WHERE ativo = TRUE AND tipo = 'promotor' AND coordenador_usuario = ${sessao.usuario}
        `;
        promotoresPermitidos = rowsPromotores.map(p => p.nome);
        restringePromotores = true;
        if (promotor && !promotoresPermitidos.includes(promotor)) {
          return res.status(403).json({ erro: 'Sem permissao para ver validacoes deste promotor' });
        }
      }
      if (promotor) {
        promotoresPermitidos = [promotor];
        restringePromotores = true;
      }
      if (restringePromotores && !promotoresPermitidos.length) {
        return res.status(200).json({ validacoes: [], proximo_cursor: '', tem_mais: false });
      }

      const rows = await sql`
        SELECT vf.id, v.id AS visita_id, v.promotor,
          COALESCE(v.dados->'pdv'->>'nomeFantasia', vf.cliente_nome, '') AS cliente_nome,
          v.criado_em, (foto.ord - 1)::int AS foto_index,
          COALESCE(vf.imagem_hash, CASE WHEN jsonb_typeof(foto.valor) = 'object' THEN foto.valor->>'imagemHash' ELSE '' END, '') AS imagem_hash,
          COALESCE(CASE WHEN jsonb_typeof(foto.valor) = 'object' THEN foto.valor->>'origem' END, 'legado') AS origem,
          COALESCE(CASE WHEN jsonb_typeof(foto.valor) = 'object' THEN foto.valor->>'capturadaEm' END, '') AS "capturadaEm",
          COALESCE(CASE WHEN jsonb_typeof(foto.valor) = 'object' THEN foto.valor->>'enviadaEm' END, '') AS "enviadaEm",
          COALESCE(vf.status_ia, 'pendente') AS status_ia, COALESCE(vf.score, 0) AS score,
          COALESCE(vf.motivo, '') AS motivo, COALESCE(vf.materiais_detectados, '[]'::jsonb) AS materiais_detectados,
          COALESCE(vf.status_manual, '') AS status_manual, COALESCE(vf.revisado_por, '') AS revisado_por,
          vf.revisado_em, COALESCE(vf.possivel_reuso, FALSE) AS possivel_reuso
        FROM visitas v
        CROSS JOIN LATERAL jsonb_array_elements(to_jsonb(v.fotos)) WITH ORDINALITY AS foto(valor, ord)
        LEFT JOIN validacoes_fotos vf ON vf.visita_id = v.id::text AND vf.foto_index = (foto.ord - 1)::int
        WHERE (${restringePromotores} = FALSE OR v.promotor = ANY(${promotoresPermitidos}))
          AND (${de || null}::timestamptz IS NULL OR v.criado_em >= ${de || null}::timestamptz)
          AND (${ate || null}::timestamptz IS NULL OR v.criado_em <= ${ate || null}::timestamptz)
          AND (${status} = '' OR COALESCE(NULLIF(vf.status_manual,''), NULLIF(vf.status_ia,''), 'pendente') = ${status})
          AND (${cursor?.criado_em || null}::timestamptz IS NULL OR
            (v.criado_em, v.id::text, (foto.ord - 1)::int) < (${cursor?.criado_em || null}::timestamptz, ${cursor?.visita_id || ''}, ${Number(cursor?.foto_index || 0)}))
        ORDER BY v.criado_em DESC, v.id::text DESC, foto.ord DESC
        LIMIT ${limiteFotos + 1}
      `;

      const temMais = rows.length > limiteFotos;
      const pagina = rows.slice(0, limiteFotos).map(row => ({
        ...row,
        score: Number(row.score || 0),
        miniatura_url: `/api/foto?id=${encodeURIComponent(row.visita_id)}&index=${row.foto_index}&variant=thumb`,
        foto_url: `/api/foto?id=${encodeURIComponent(row.visita_id)}&index=${row.foto_index}&variant=full`
      }));
      return res.status(200).json({
        validacoes: pagina,
        proximo_cursor: temMais ? codificarCursor(pagina[pagina.length - 1]) : '',
        tem_mais: temMais
      });
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
