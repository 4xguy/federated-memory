# Task Completion Checklist

When completing a coding task, always run these commands:

## 1. Type Checking
```bash
npm run typecheck
```
Ensures all TypeScript types are correct and no type errors exist.

## 2. Linting
```bash
npm run lint
```
Checks for code style violations and potential bugs. Use `npm run lint:fix` to auto-fix issues.

## 3. Code Formatting
```bash
npm run format
```
Ensures consistent code formatting according to Prettier rules.

## 4. Tests (if applicable)
```bash
npm test
```
Run relevant tests for the code changes made.

## 5. Build Verification
```bash
npm run build
```
Ensure the project builds successfully without errors.

## Important Notes
- These checks should be run BEFORE considering a task complete
- If any command is missing or fails, ask the user for the correct command
- Consider adding frequently used commands to CLAUDE.md for persistence