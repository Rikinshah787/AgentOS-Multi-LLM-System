require('dotenv').config();
const OpenAI = require('openai');

const models = [
  {
    name: 'Mistral Large',
    endpoint: 'https://api.mistral.ai/v1',
    apiKey: process.env.MISTRAL_API_KEY,
    model: 'mistral-large-latest',
    extraBody: null,
    isNim: false,
  },
  {
    name: 'Groq Llama',
    endpoint: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
    extraBody: null,
    isNim: false,
  },
  {
    name: 'Kimi K2.5 (NVIDIA NIM)',
    endpoint: 'https://integrate.api.nvidia.com/v1',
    apiKey: process.env.NVIDIA_KIMI_API_KEY,
    model: 'moonshotai/kimi-k2.5',
    extraBody: { chat_template_kwargs: { thinking: true } },
    isNim: true,
  },
  {
    name: 'GLM-5 (NVIDIA NIM)',
    endpoint: 'https://integrate.api.nvidia.com/v1',
    apiKey: process.env.NVIDIA_API_KEY,
    model: 'z-ai/glm5',
    extraBody: { chat_template_kwargs: { enable_thinking: true, clear_thinking: false } },
    isNim: true,
  },
];

async function testModel(cfg) {
  const tag = `[${cfg.name}]`;
  if (!cfg.apiKey) {
    console.log(`${tag} SKIP — no API key`);
    return;
  }

  const client = new OpenAI({
    baseURL: cfg.endpoint,
    apiKey: cfg.apiKey,
    timeout: 300000,
  });

  const params = {
    model: cfg.model,
    messages: [
      { role: 'user', content: 'Say "echo 2" and confirm your model name in one short sentence.' },
    ],
    max_tokens: 256,
    temperature: 0.3,
  };
  if (cfg.extraBody) params.extra_body = cfg.extraBody;

  const t0 = Date.now();
  try {
    if (cfg.isNim) {
      params.stream = true;
      console.log(`${tag} Calling (streaming mode for NIM)...`);
      const stream = await client.chat.completions.create(params);
      let text = '';
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) text += delta.content;
      }
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`${tag} OK  (${elapsed}s, streaming)`);
      console.log(`  → ${(text || '(empty)').substring(0, 300)}`);
    } else {
      console.log(`${tag} Calling (non-streaming)...`);
      const res = await client.chat.completions.create(params);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const text = res.choices?.[0]?.message?.content?.trim() || '(empty response)';
      const tokens = res.usage?.total_tokens || '?';
      console.log(`${tag} OK  (${elapsed}s, ${tokens} tokens)`);
      console.log(`  → ${text.substring(0, 300)}`);
    }
  } catch (err) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const msg = err?.message || String(err);
    console.log(`${tag} FAIL (${elapsed}s)`);
    console.log(`  → ${msg.substring(0, 300)}`);
  }
}

async function main() {
  console.log('=== AgentOS Model Connectivity Test (streaming for NIM) ===\n');
  await Promise.all(models.map(m => testModel(m)));
  console.log('\n=== All tests done ===');
}

main();
