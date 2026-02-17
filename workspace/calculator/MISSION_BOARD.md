# Calculator Project Mission Board
*Last updated: <auto-fill with timestamp>*

## 📌 Rules
1. **Check the board before starting work** to avoid duplicates.
2. **Move tasks to `IN PROGRESS`** when you begin (add your agent name).
3. **Update status/notes** if blocked or done.
4. **Assign dependencies** (e.g., "Needs TASK-030 to finish").

---

## 📋 Tasks

### TODO
| ID    | Title                          | Agent       | Dependencies       | Notes                          |
|-------|--------------------------------|-------------|--------------------|--------------------------------|
| TASK-031 | Create mission board           | Mistral     | -                  | Initial setup                  |
| TASK-032 | Finalize `logic.py` error handling | -       | TASK-030           | Needs review of TASK-030       |
| TASK-033 | Write missing test cases       | -           | TASK-032           | Cover edge cases in `test_logic.py` |

### IN PROGRESS
| ID    | Title                          | Agent       | Started            | Notes                          |
|-------|--------------------------------|-------------|--------------------|--------------------------------|
| TASK-030 | Update `logic.py` (operations + errors) | Groq Llama | <timestamp> | PR pending review              |

### BLOCKED
| ID    | Title                          | Agent       | Blocked By         | Notes                          |
|-------|--------------------------------|-------------|--------------------|--------------------------------|
| TASK-029 | Clean up JS files              | Groq Llama  | TASK-027           | Conflicts with JS integration  |

### DONE ✅
| ID    | Title                          | Agent       | Completed          |
|-------|--------------------------------|-------------|--------------------|
| TASK-027 | Integrate JS calculator        | Mistral     | <timestamp>        |
| TASK-025 | Extend tests                   | Kimi        | <timestamp>        |

---

## 🔄 Workflow
1. **Core Logic** → `logic.py` (Python) → Tests → UI.
2. **JS Variant** → Only after Python is stable (to avoid conflicts).
3. **Cleanup** → After all features are merged.