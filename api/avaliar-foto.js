function respostaMock() {
  return {
    aprovado: true,
    score: 82,
    modo: 'mock',
    materiais_detectados: ['tabela_precos'],
    pdv_detectado: false,
    qualidade_foto: 'boa',
    motivo: 'Simulacao: estrutura pronta para receber analise real da IA.'
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

async function avaliarComGemini(foto) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY nao configurada');

  const base64 = String(foto).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  const prompt = [
    'Analise a foto enviada para validar material de marketing da Clean Tabaco ou El Poncio.',
    'Procure tabela de precos, wobler, display, cartaz, adesivo, expositor ou material similar.',
    'Modo de teste: nao reprove apenas por nao parecer um PDV real.',
    'Responda somente JSON valido com os campos:',
    'aprovado boolean, score number 0-100, materiais_detectados array de strings,',
    'pdv_detectado boolean, qualidade_foto string, motivo string.'
  ].join(' ');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: base64 } }
        ]
      }]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Erro ao chamar Gemini');
  }

  const texto = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
  return normalizarResultado({ ...extrairJson(texto), modo: 'gemini' });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Metodo nao permitido' });

  const { foto } = req.body || {};
  if (!foto || typeof foto !== 'string') {
    return res.status(400).json({ erro: 'Foto obrigatoria' });
  }

  try {
    if (process.env.IA_VALIDACAO_REAL !== 'true') {
      return res.status(200).json(respostaMock());
    }

    const resultado = await avaliarComGemini(foto);
    return res.status(200).json(resultado);
  } catch (e) {
    return res.status(500).json({
      erro: 'Nao foi possivel avaliar a foto agora',
      detalhe: e.message
    });
  }
}
