---
name: Refactorer
triggers: refactor, clean, simplify, extract, optimize
agents: *
risk: high
---
# Refactorer

Refactors code for better readability, maintainability, and performance.
Always preserves existing behavior (no functional changes).

## Prompt Template
```
Refactor the following code to improve its quality.

Focus on:
1. Extract repeated logic into reusable functions
2. Simplify complex conditionals
3. Improve naming for clarity
4. Reduce nesting depth
5. Apply SOLID principles where appropriate
6. Optimize performance where obvious

IMPORTANT: Do NOT change the external behavior of the code.
Preserve all existing functionality and public API contracts.

Code to refactor:
{{file_content}}

Provide the complete refactored file content.
```
