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

async function avaliarComGemini(foto) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY nao configurada');

  const imagem = normalizarImagemEntrada(foto);
  const prompt = [
    'Voce esta analisando fotos enviadas por promotores da Clean Tabaco.',
    'O objetivo principal e identificar se existe uma TABELA DE PRECOS oficial da Clean Tabaco ou El Poncio na foto.',
    'Textos reais que podem aparecer na tabela ou no material: Cretec, Gudang, Gudang Garam, El Poncio, El Poncio Gudang Garam, uma evolucao Cretec.',
    'O nome Cretec pode ter variacao visual no logo, incluindo um C invertido no ultimo C; considere isso como indicio valido.',
    'A tabela verde e a tabela vermelha sao modelos oficiais importantes; se houver uma tabela verde ou tabela vermelha com colunas, precos, produtos ou esses textos, considere como forte indicio de tabela oficial.',
    'Tolere leitura imperfeita de OCR: textos parecidos como gurjao garam, gudan garam, gudang garan ou garam devem ser tratados como possivel Gudang Garam quando aparecerem em uma tabela verde ou vermelha.',
    'Considere como tabela valida mesmo se estiver inclinada, parcialmente cortada, com reflexo, distante ou presa em parede, balcao, expositor ou display.',
    'Nao exija que o ambiente seja um PDV real. A prioridade e reconhecer a tabela ou material de marketing.',
    'Se houver qualquer indicio claro de tabela de precos da Clean Tabaco ou El Poncio, retorne aprovado true e inclua tabela_precos em materiais_detectados.',
    'Use score alto quando houver texto de precos, colunas, lista de produtos, logo, marca Clean Tabaco ou El Poncio.',
    'Se houver sinais visuais de tabela verde ou vermelha oficial mas a leitura do texto estiver ruim, use score intermediario e nao retorne reprovado direto.',
    'Use score intermediario quando parecer tabela ou material oficial, mas a imagem estiver ruim ou parcialmente visivel.',
    'Tambem procure wobler, display, cartaz, adesivo, expositor ou material similar.',
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
