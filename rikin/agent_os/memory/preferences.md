# AgentOS Preferences

## Auto-Apply Rules
- Low-risk changes (docs, tests, types, configs): **auto-apply**
- High-risk changes (core logic, refactoring, security): **require approval**

## Agent Preferences
- Default planning agent: auto (picks highest-level agent with planning role)
- Default review agent: auto (picks agent with code-review role)
- Default test agent: prefer local models (ollama-local) for speed

## Task Settings
- Max task depth (agent-to-agent spawning): 3
- Max concurrent agents: 5
- Auto-triggers: enabled (configure in triggers.json)
