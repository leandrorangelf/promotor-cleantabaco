const MODELO_GEMINI = 'gemini-2.5-flash';
const PRECO_INPUT_USD_M = 0.30;
const PRECO_OUTPUT_USD_M = 2.50;

function calcularUso(data = {}) {
  const input = Number(data.usageMetadata?.promptTokenCount || 0);
  const output = Number(data.usageMetadata?.candidatesTokenCount || 0);
  return {
    modelo: MODELO_GEMINI,
    input_tokens: input,
    output_tokens: output,
    custo_usd_estimado: (input * PRECO_INPUT_USD_M + output * PRECO_OUTPUT_USD_M) / 1_000_000
  };
}

function respostaMock() {
  return {
    aprovado: true,
    score: 82,
    modo: 'mock',
    materiais_detectados: ['tabela_precos'],
    pdv_detectado: false,
    qualidade_foto: 'boa',
    motivo: 'Simulacao: estrutura pronta para receber analise real da IA.',
    uso: { modelo: 'mock', input_tokens: 0, output_tokens: 0, custo_usd_estimado: 0 }
  };
}

function normalizarResultado(valor) {
  return {
    aprovado: Boolean(valor?.aprovado),
    score: Number.isFinite(Number(valor?.score)) ? Math.max(0, Math.min(100, Number(valor.score))) : 0,
    modo: valor?.modo || 'gemini',
    materiais_detectados: Array.isArray(valor?.materiais_detectados) ? valor.materiais_detectados : [],
    pdv_detectado: Boolean(valor?.pdv_detectado),
    qualidade_foto: valor?.qualidade_foto || 'nao_avaliada',
    motivo: valor?.motivo || 'Analise concluida sem motivo detalhado.'
  };
}

function extrairJson(texto) {
  const bruto = String(texto || '').trim();
  try {
    return JSON.parse(bruto);
  } catch (e) {
    const match = bruto.match(/\{[\s\S]*\}/);
    if (!match) throw e;
    return JSON.parse(match[0]);
  }
}

function normalizarImagemEntrada(foto) {
  const valor = String(foto || '').trim();
  const dataUrl = valor.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  const mimeType = dataUrl ? dataUrl[1].toLowerCase() : 'image/jpeg';
  const base64 = (dataUrl ? dataUrl[2] : valor).replace(/\s/g, '');

  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new Error('Imagem invalida para analise IA');
  }

  return { mimeType, base64 };
}

export async function avaliarComGemini(foto) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY nao configurada');

  const imagem = normalizarImagemEntrada(foto);
  const prompt = [
    'Voce esta analisando fotos enviadas por promotores da Clean Tabaco para validar se mostram a TABELA DE PRECOS oficial da Clean Tabaco ou El Poncio.',
    'So aprove a foto se voce conseguir ler, na propria imagem, pelo menos uma das seguintes evidencias textuais/visuais oficiais:',
    '- As palavras Gudang, Garam, Gudang Garam (ou variacao de OCR proxima como gudan garam, gudang garan);',
    '- A palavra Click;',
    '- A palavra Cretec (o logo pode ter um C invertido no ultimo C, isso ainda conta como Cretec);',
    '- A frase "evolucao Cretec";',
    '- A marca El Poncio;',
    '- A frase "aqui tem" seguida de uma das marcas acima (ex: "aqui tem Gudang", "aqui tem Cretec");',
    '- Uma tabela de precos no modelo oficial verde ou vermelho contendo o numero 30 (ex: "tabela verde com 30" ou "tabela vermelha com 30").',
    'Se NENHUMA dessas evidencias estiver legivel na foto, retorne aprovado false e score baixo (0 a 30), mesmo que a imagem pareca ser de um PDV ou pareca uma tabela generica.',
    'Fotos de pessoas, objetos aleatorios, prints de tela, ou qualquer imagem sem relacao com material de PDV Clean Tabaco/El Poncio devem ser reprovadas com score proximo de 0.',
    'Se a evidencia textual estiver presente mas a foto estiver borrada, escura, cortada ou de dificil leitura, use score intermediario (40 a 60) e aprovado false, pedindo revisao manual.',
    'Se a evidencia estiver clara e legivel, use score alto (70 a 100) e aprovado true.',
    'Inclua em materiais_detectados os itens especificos encontrados (ex: gudang_garam, cretec, click, el_poncio, tabela_verde_30, tabela_vermelha_30).',
    'Responda somente JSON valido com os campos:',
    'aprovado boolean, score number 0-100, materiais_detectados array de strings,',
    'pdv_detectado boolean, qualidade_foto string, motivo string.'
  ].join(' ');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO_GEMINI}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: imagem.mimeType, data: imagem.base64 } }
        ]
      }]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Erro ao chamar Gemini');
  }

  const texto = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
  return { ...normalizarResultado({ ...extrairJson(texto), modo: 'gemini' }), uso: calcularUso(data) };
}

export async function avaliarFotoConfigurada(foto) {
  if (process.env.IA_VALIDACAO_REAL !== 'true') return respostaMock();
  return avaliarComGemini(foto);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Metodo nao permitido' });
  return res.status(410).json({ erro: 'Use /api/analisar-foto para uma analise autenticada e auditavel' });
}
