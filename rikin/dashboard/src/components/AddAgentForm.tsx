import React, { useState } from 'react';

interface AddAgentFormProps {
  onSubmit: (config: any) => void;
  onCancel: () => void;
}

export const AddAgentForm: React.FC<AddAgentFormProps> = ({ onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('openai-compatible');
  const [endpoint, setEndpoint] = useState('https://api.openai.com/v1');
  const [apiKeyEnvVar, setApiKeyEnvVar] = useState('');
  const [model, setModel] = useState('');
  const [role, setRole] = useState('general');
  const [avatar, setAvatar] = useState('robot');

  const avatars = [
    { id: 'robot', emoji: '🤖' }, { id: 'lightning', emoji: '⚡' },
    { id: 'brain-purple', emoji: '🧠' }, { id: 'fire', emoji: '🔥' },
    { id: 'star', emoji: '⭐' }, { id: 'gem', emoji: '💎' },
    { id: 'shield', emoji: '🛡️' }, { id: 'sword', emoji: '⚔️' },
    { id: 'wind', emoji: '🌀' }, { id: 'eye', emoji: '👁️' },
    { id: 'llama', emoji: '🦙' }, { id: 'google-star', emoji: '✨' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !model) return;

    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    onSubmit({
      id,
      name,
      provider,
      endpoint: provider === 'openai-compatible' ? endpoint : undefined,
      apiKeyEnvVar: apiKeyEnvVar || undefined,
      model,
      avatar,
      role,
      maxTokens: 4096,
      energyRechargeRate: 2,
    });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Add New Agent</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Agent Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g., Grok, My Local Llama" required />
          </div>

          <div className="form-group">
            <label>Provider</label>
            <select value={provider} onChange={e => setProvider(e.target.value)}>
              <option value="openai-compatible">OpenAI-Compatible (Grok, Mistral, Groq, Ollama, etc.)</option>
              <option value="gemini">Google Gemini (Antigravity)</option>
              <option value="anthropic">Anthropic (Claude)</option>
            </select>
          </div>

          {provider === 'openai-compatible' && (
            <div className="form-group">
              <label>API Endpoint</label>
              <input value={endpoint} onChange={e => setEndpoint(e.target.value)}
                placeholder="https://api.x.ai/v1" />
            </div>
          )}

          <div className="form-group">
            <label>API Key Env Variable (leave empty for local models)</label>
            <input value={apiKeyEnvVar} onChange={e => setApiKeyEnvVar(e.target.value)}
              placeholder="e.g., XAI_API_KEY" />
          </div>

          <div className="form-group">
            <label>Model Name</label>
            <input value={model} onChange={e => setModel(e.target.value)}
              placeholder="e.g., grok-2, gpt-4-turbo, llama3" required />
          </div>

          <div className="form-group">
            <label>Role</label>
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="general">General</option>
              <option value="planning">Planning</option>
              <option value="reasoning">Reasoning</option>
              <option value="code-review">Code Review</option>
              <option value="testing">Testing</option>
              <option value="documentation">Documentation</option>
              <option value="refactoring">Refactoring</option>
              <option value="fast-draft">Fast Draft</option>
            </select>
          </div>

          <div className="form-group">
            <label>Avatar</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {avatars.map(a => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => setAvatar(a.id)}
                  style={{
                    fontSize: '22px', padding: '4px 8px', cursor: 'pointer',
                    background: avatar === a.id ? 'rgba(100,255,218,0.15)' : 'transparent',
                    border: avatar === a.id ? '2px solid #64ffda' : '2px solid transparent',
                    borderRadius: '8px',
                  }}
                >
                  {a.emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Agent</button>
          </div>
        </form>
      </div>
    </div>
  );
};
