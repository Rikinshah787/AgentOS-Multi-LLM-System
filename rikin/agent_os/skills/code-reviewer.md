---
name: Code Reviewer
triggers: review, check, audit, inspect
agents: *
risk: low
---
# Code Reviewer

Reviews code for bugs, security issues, performance problems, and best practice violations.
Provides actionable suggestions with specific line references.

## Prompt Template
```
Review the following code carefully. Look for:
1. Bugs and logic errors
2. Security vulnerabilities
3. Performance issues
4. Code style and best practice violations
5. Missing error handling

For each issue found, provide:
- The specific line or section
- What the problem is
- How to fix it

Be concise and actionable. Prioritize critical issues.

Code to review:
{{file_content}}
```
