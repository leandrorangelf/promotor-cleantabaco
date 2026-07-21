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
  modelo_ia TEXT DEFAULT '',
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  custo_usd_estimado NUMERIC DEFAULT 0,
  erro_ia TEXT DEFAULT '',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(visita_id, foto_index)
);

ALTER TABLE validacoes_fotos
  ALTER COLUMN visita_id TYPE TEXT,
  ADD COLUMN IF NOT EXISTS modelo_ia TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS input_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_usd_estimado NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS erro_ia TEXT DEFAULT '';
