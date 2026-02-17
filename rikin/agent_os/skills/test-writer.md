---
name: Test Writer
triggers: test, spec, coverage
agents: *
risk: low
---
# Test Writer

Generates unit tests for the given code. Focuses on edge cases, error conditions, and happy paths.

## Prompt Template
```
Generate comprehensive unit tests for the following code.

Requirements:
1. Test all public functions/methods
2. Include happy path tests
3. Include edge cases (null, empty, boundary values)
4. Include error condition tests
5. Use descriptive test names
6. Follow the existing test framework conventions in the project

Code to test:
{{file_content}}

Generate the test file content. Include all necessary imports.
```
