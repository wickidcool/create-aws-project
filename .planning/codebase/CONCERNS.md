# Codebase Concerns

**Analysis Date:** 2026-01-20

## Tech Debt

**Missing Error Handling in File Operations:**
- Issue: Synchronous file operations without try-catch blocks
- Files: `src/cli.ts` (line 15), `src/generator/copy-file.ts` (lines 27-29, 43, 45)
- Why: Rapid development, synchronous operations simplify flow
- Impact: Crashes with raw stack traces on I/O failures (missing templates, disk errors)
- Fix approach: Wrap file operations in try-catch, provide meaningful error messages

**Silent Template Missing Warning:**
- Issue: Missing templates log warning but generation continues
- File: `src/generator/generate-project.ts` (lines 40-41)
- Why: Allows partial generation
- Impact: Users get incomplete projects without knowing
- Fix approach: Fail loudly on missing critical templates, or track and report at end

## Known Bugs

**No known bugs at analysis time.**

The codebase has 71 passing tests with no reported failures.

## Security Considerations

**Package Name Validation:**
- Risk: Low - Uses trusted `validate-npm-package-name` library
- File: `src/validation/project-name.ts`
- Current mitigation: External library handles edge cases
- Recommendations: None needed, well-implemented

**No Hardcoded Secrets:**
- Status: GOOD - No credentials, API keys, or secrets in codebase
- The CLI generates placeholder environment variables for users to fill

## Performance Bottlenecks

**Synchronous File Operations:**
- Problem: All file operations block the process
- Files: `src/generator/copy-file.ts` (all functions use sync methods)
- Measurement: Acceptable for CLI context (~seconds for typical project)
- Cause: Simpler code, appropriate for one-time scaffold operation
- Improvement path: Convert to async if projects grow significantly larger

## Fragile Areas

**Token Regex Patterns:**
- File: `src/generator/replace-tokens.ts` (lines 12-22)
- Why fragile: Complex regex with backreferences, handles multiple formats
- Common failures: New conditional syntax not matched
- Safe modification: Add comprehensive tests before changing regex
- Test coverage: Well covered with 100+ assertions in `replace-tokens.spec.ts`

## Scaling Limits

**Template Size:**
- Current capacity: Handles ~100 template files efficiently
- Limit: Memory-bound for very large templates (reads entire files)
- Symptoms at limit: Slow generation, high memory usage
- Scaling path: Stream processing for large files (unlikely to be needed)

## Dependencies at Risk

**@types/node:**
- Risk: Minor version behind (24.10.9 vs 25.x available)
- Impact: None - types are compatible
- Migration plan: Update when convenient

**Jest ESM Support:**
- Risk: Uses `--experimental-vm-modules` flag
- Impact: May break with Node.js updates
- Migration plan: Monitor Jest ESM support maturity

## Missing Critical Features

**No missing critical features identified.**

The CLI tool is feature-complete for its purpose (project scaffolding).

## Test Coverage Gaps

**generateProject Function:**
- What's not tested: Full file generation flow (`src/generator/generate-project.ts`)
- File: `src/generator/generate-project.ts` (lines 58-109)
- Risk: File copying logic could break without detection
- Priority: Medium
- Difficulty to test: Requires filesystem mocking or temp directories

**CLI Argument Parsing:**
- What's not tested: `--help`, `--version`, positional args
- File: `src/cli.ts` (lines 88+)
- Risk: Low - simple logic
- Priority: Low
- Difficulty to test: Need to capture stdout/stderr

---

## Positive Findings

**Well-Implemented Areas:**
- Token replacement logic: Excellent test coverage (100+ assertions)
- Validation logic: Thorough tests for edge cases
- Type safety: Strict TypeScript throughout
- Code organization: Clear separation of concerns
- Documentation: Good JSDoc comments on public functions

**Code Quality Metrics:**
- 767 lines of production code
- 852 lines of test code (1.1:1 test ratio)
- 71 passing tests
- No TODO/FIXME comments
- No hardcoded secrets

---

*Concerns audit: 2026-01-20*
*Update as issues are fixed or new ones discovered*
