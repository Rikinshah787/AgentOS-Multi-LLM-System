---
name: Documentation Writer
triggers: doc, document, readme, explain
agents: *
risk: low
---
# Documentation Writer

Generates clear documentation including JSDoc comments, README sections, and API docs.

## Prompt Template
```
Generate documentation for the following code.

Include:
1. JSDoc/TSDoc comments for all public functions, classes, and interfaces
2. A brief module overview at the top
3. Usage examples where helpful
4. Parameter descriptions and return types
5. Any important notes or caveats

Keep the documentation concise but complete. Match the style of existing docs in the project.

Code to document:
{{file_content}}
```
