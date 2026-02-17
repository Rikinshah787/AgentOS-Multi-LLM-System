# 🧮 Calculator Project

A dual-implementation calculator with both Python and JavaScript versions.

## 📁 Project Structure

```
calculator/
├── python-src/          # Python implementation
│   ├── logic.py         # Core calculation logic
│   ├── ui.py            # Tkinter GUI
│   ├── test_logic.py    # Unit tests
│   └── requirements.txt # Python dependencies
├── js-src/              # JavaScript implementation
│   ├── calculator.js    # Node.js calculator
│   └── package.json     # Node dependencies
├── README.md            # This file
└── AGENT_MEMORY.md      # Agent coordination file
```

## 🐍 Python Version

### Features
- Core arithmetic operations (+, -, *, /, ^, %)
- Tkinter-based GUI
- Unit tests with pytest
- Multi-step calculation support

### Quick Start

```bash
cd python-src
pip install -r requirements.txt
python ui.py
```

### Run Tests

```bash
cd python-src
pytest test_logic.py -v
```

### ASCII Art Screenshot

```
┌─────────────────────────┐
│         42.0            │
│                         │
├─────────────────────────┤
│  C   ←   %   /   │
│  7   8   9   *   │
│  4   5   6   -   │
│  1   2   3   +   │
│  0   .   =   ^   │
└─────────────────────────┘
```

## 📜 JavaScript Version

### Features
- Core arithmetic operations
- Operation history tracking
- CLI interface

### Quick Start

```bash
cd js-src
node calculator.js           # Demo mode
node calculator.js 5 + 3     # CLI mode
```

### Usage as Module

```javascript
const { Calculator } = require('./calculator.js');

const calc = new Calculator();
console.log(calc.add(5, 3));      // 8
console.log(calc.multiply(6, 7)); // 42
console.log(calc.getHistory());   // [...]
```

## 🤝 Contributing

1. Check `AGENT_MEMORY.md` for current project status
2. Choose your implementation (Python or JS)
3. Make changes in the appropriate folder
4. Update `AGENT_MEMORY.md` with your changes
5. Ensure tests pass before submitting

## 📋 Supported Operations

| Operation | Symbol | Example |
|-----------|--------|---------|
| Add       | +      | 5 + 3 = 8 |
| Subtract  | -      | 10 - 4 = 6 |
| Multiply  | *      | 6 * 7 = 42 |
| Divide    | /      | 20 / 4 = 5 |
| Power     | ^      | 2 ^ 8 = 256 |
| Modulo    | %      | 10 % 3 = 1 |

---

*This project is maintained by the AgentOS multi-agent system.*