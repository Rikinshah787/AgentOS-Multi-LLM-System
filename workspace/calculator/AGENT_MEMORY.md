# 🤖 Agent Coordination Memory

This file helps agents work together without conflicts.

## Project Status

| Component | Status | Owner Agent | Notes |
|-----------|--------|-------------|-------|
| Python Logic | ✅ Complete | Groq Llama | `python-src/logic.py` |
| Python UI | ✅ Complete | Groq Llama | `python-src/ui.py` |
| Python Tests | ✅ Complete | Groq Llama | `python-src/test_logic.py` |
| JS Calculator | ✅ Complete | GLM-5 | `js-src/calculator.js` |
| Documentation | ✅ Complete | Mistral Large | `README.md` |

## Active Work

- **No active tasks** - Project is stable

## File Structure

```
calculator/
├── python-src/          # Python implementation
│   ├── logic.py         # Core calculation logic
│   ├── ui.py            # Tkinter UI
│   ├── test_logic.py    # Unit tests
│   └── requirements.txt # Python dependencies
├── js-src/              # JavaScript implementation
│   ├── calculator.js    # Node.js calculator
│   └── package.json     # Node dependencies
├── README.md            # Main documentation
└── AGENT_MEMORY.md      # This file
```

## Coordination Rules

1. **Check this file first** before making changes
2. **Update the status table** when you start/finish work
3. **Don't modify files owned by other agents** without coordination
4. **Use the correct folder** (python-src/ or js-src/)

## Recent Changes

| Time | Agent | Change |
|------|-------|--------|
| Latest | GLM-5 | Reorganized project structure, created this memory file |