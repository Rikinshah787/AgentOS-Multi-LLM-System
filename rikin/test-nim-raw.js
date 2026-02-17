require('dotenv').config();

async function testNim(name, model, apiKey, extraParams) {
  const tag = `[${name}]`;
  const url = 'https://integrate.api.nvidia.com/v1/chat/completions';

  const payload = {
    model,
    messages: [{ role: 'user', content: 'Say echo 2 and your model name in 1 sentence.' }],
    max_tokens: 256,
    temperature: 0.7,
    top_p: 1,
    stream: true,
    ...extraParams,
  };

  console.log(`${tag} Sending request to ${model}...`);
  console.log(`${tag} Payload keys: ${Object.keys(payload).join(', ')}`);

  const t0 = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`${tag} HTTP ${res.status} (${elapsed}s)`);

    if (!res.ok) {
      const errText = await res.text();
      console.log(`${tag} Error body: ${errText.substring(0, 400)}`);
      return;
    }

    let fullText = '';
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const j = JSON.parse(line.slice(6));
            const content = j.choices?.[0]?.delta?.content || '';
            if (content) fullText += content;
          } catch {}
        }
      }
    }

    const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`${tag} OK (${totalElapsed}s total)`);
    console.log(`${tag} Response: ${(fullText || '(empty)').substring(0, 300)}`);
  } catch (err) {
    clearTimeout(timer);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`${tag} FAIL (${elapsed}s): ${err.message}`);
  }
}

async function main() {
  console.log('=== NVIDIA NIM Raw HTTP Test ===\n');

  await Promise.all([
    testNim(
      'Kimi K2.5',
      'moonshotai/kimi-k2.5',
      process.env.NVIDIA_KIMI_API_KEY,
      { chat_template_kwargs: { thinking: true } }
    ),
    testNim(
      'GLM-5',
      'z-ai/glm5',
      process.env.NVIDIA_API_KEY,
      { chat_template_kwargs: { enable_thinking: true, clear_thinking: false } }
    ),
  ]);

  console.log('\n=== Done ===');
}

main();
