# Phase 20: End-to-End Verification - Research

**Researched:** 2026-02-11
**Domain:** End-to-end testing, AWS integration verification, idempotency testing, manual test execution
**Confidence:** MEDIUM

## Summary

Phase 20 is about verification, not new feature development. The goal is to confirm that the complete workflow (project generation → setup-aws-envs with root credentials → initialize-github → successful deployment) works reliably end-to-end, and that re-running commands is idempotent.

This phase requires a **manual testing approach** because:
1. Testing real AWS Organizations/IAM operations requires actual AWS credentials and resources
2. GitHub Actions deployment verification needs a real repository and secrets
3. LocalStack doesn't fully support AWS Organizations (confirmed via research - Organizations not listed in supported services)
4. The existing e2e test harness only validates generated project builds, not AWS/GitHub setup commands

The standard approach is to create a **test execution checklist** documenting the exact steps to perform, expected results, and verification criteria. This creates a repeatable manual test protocol that can be executed on-demand and potentially automated in the future when AWS Organizations mocking becomes viable.

**Primary recommendation:** Create a comprehensive manual test script with detailed verification steps, execute it to validate all success criteria, document results in a verification report, and commit the test protocol for future use.

## Standard Stack

### Core Testing Tools (Already Present)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| execa | ^9.6.1 | CLI command execution in tests | Industry standard for Node.js CLI testing with timeout support and output capture |
| Jest | ^30.2.0 | Test framework | Project's existing test infrastructure |
| tsx | ^4.21.0 | TypeScript execution | Used for e2e runner, good for test scripts |

### Manual Testing Documentation

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Markdown checklist | N/A | Test case documentation | Standard format for manual test protocols |
| Test execution reports | N/A | Verification documentation | Record test outcomes and evidence |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual testing | LocalStack | LocalStack doesn't support AWS Organizations; would miss real IAM eventual consistency issues |
| Test script | Ad-hoc testing | Scripts are repeatable; ad-hoc testing is error-prone and inconsistent |
| Markdown checklist | Test management tool | Markdown is version-controlled, no external dependencies, sufficient for CLI tool |

**Installation:**
No new dependencies needed. All testing tools already present in package.json.

## Architecture Patterns

### Recommended Test Organization

```
.planning/phases/20-end-to-end-verification/
├── 20-RESEARCH.md              # This file
├── 20-01-PLAN.md               # Execution plan (creates test script)
├── 20-TEST-PROTOCOL.md         # Manual test checklist
└── 20-VERIFICATION-REPORT.md   # Test execution results
```

### Pattern 1: Manual Test Protocol Structure

**What:** A structured checklist documenting every step of the end-to-end workflow with clear pass/fail criteria
**When to use:** When automated testing requires resources that are impractical to mock (AWS Organizations, real deployments)
**Example:**
```markdown
## Test Case: Full Workflow from Root Credentials

### Prerequisites
- [ ] Clean AWS management account with root credentials
- [ ] No existing organization
- [ ] GitHub PAT with repo scope

### Steps
1. **Generate Project**
   - Command: `npx create-aws-project my-test-project`
   - Inputs: [documented choices]
   - Expected: Project created in ./my-test-project

2. **Setup AWS Environments (with root credentials)**
   - Command: `cd my-test-project && npx setup-aws-envs`
   - Expected: Root detection → admin user created → 3 accounts created
   - Verification: Check AWS Console for accounts, IAM users

### Pass Criteria
- All steps complete without errors
- Resources created match expectations
- Re-running commands is idempotent
```

### Pattern 2: Verification Report Structure

**What:** Document proving that success criteria were met with evidence
**When to use:** After executing manual test protocol
**Example:**
```markdown
## Verification Report

**Executed:** 2026-02-11
**Tester:** [name]
**Environment:** AWS account [id]

### Test Results

| Test Case | Status | Evidence | Notes |
|-----------|--------|----------|-------|
| Full workflow | ✓ PASS | Screenshots, AWS Console | All 3 accounts created |
| Idempotent re-run | ✓ PASS | Terminal output | No errors, no duplicates |
| GitHub deployment | ✓ PASS | Actions logs | Dev deploy succeeded |

### Success Criteria Verification

1. ✓ User can run full workflow without errors
   - Evidence: [link to terminal recording or logs]
2. ✓ Generated project deploys successfully to AWS
   - Evidence: GitHub Actions log showing successful deployment
3. ✓ Re-running commands is idempotent
   - Evidence: Second run logs showing skip behavior
```

### Anti-Patterns to Avoid

- **Testing in production account:** Use a dedicated test AWS account to avoid polluting production organization
- **Incomplete cleanup:** Always document cleanup steps to remove test resources
- **Undocumented verification:** Just running commands isn't enough - must verify results and document evidence
- **Skipping idempotency testing:** Testing only the happy path misses critical re-run scenarios

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test case management | Custom test tracking system | Markdown checklist | Version-controlled, simple, sufficient for CLI tool |
| AWS Organizations mocking | Custom mock implementations | Accept manual testing for now | LocalStack doesn't support Organizations; mocking IAM eventual consistency is complex |
| Test evidence collection | Screenshot tools, video recording | Terminal output + AWS Console checks | Built-in tools are sufficient, reproducible |

**Key insight:** Manual testing is appropriate for verification phases. Not everything needs automation - sometimes a well-documented manual protocol is more maintainable than fragile mocks.

## Common Pitfalls

### Pitfall 1: Testing Without Cleanup Strategy

**What goes wrong:** Test resources accumulate in AWS account; accounts hit limits; costs increase
**Why it happens:** Tests create resources but don't document removal steps
**How to avoid:** Include cleanup section in test protocol with exact commands to remove accounts, users, access keys
**Warning signs:** AWS account has multiple test accounts with similar names; can't run tests again due to limits

### Pitfall 2: Insufficient Evidence Collection

**What goes wrong:** Test passes but no way to prove it or debug failures later
**Why it happens:** Tester runs commands, sees success, doesn't capture output
**How to avoid:** Require evidence for every verification step (terminal output, screenshots, AWS Console checks, GitHub Actions logs)
**Warning signs:** Verification report has no links/attachments; can't reproduce results

### Pitfall 3: Not Testing Failure Recovery

**What goes wrong:** Tests only validate happy path; real users encounter errors and get stuck
**Why it happens:** Manual tests are time-consuming; tester skips negative test cases
**How to avoid:** Include at least one interruption test (Ctrl+C during account creation, re-run after partial failure)
**Warning signs:** Users report "stuck" states that weren't tested; no retry/resume guidance

### Pitfall 4: Environment Inconsistencies

**What goes wrong:** Tests pass on one machine, fail on another due to credential location, AWS CLI version, Node version
**Why it happens:** Test protocol doesn't document required environment setup
**How to avoid:** Include prerequisites section with exact versions, credential configuration, initial state requirements
**Warning signs:** "Works on my machine" syndrome; unreproducible test results

### Pitfall 5: AWS Eventual Consistency Blind Spots

**What goes wrong:** Tests pass with sleeps/delays but real usage has timing-dependent failures
**Why it happens:** Manual testing doesn't reveal retry logic bugs; delays mask real issues
**How to avoid:** Verify that commands have proper retry logic (already implemented in Phase 17); test immediately after resource creation without manual delays
**Warning signs:** Tests need "wait 30 seconds" steps; users report intermittent IAM errors

### Pitfall 6: GitHub Actions Credential Mismatch

**What goes wrong:** Deployment fails because secrets in GitHub don't match credentials in config
**Why it happens:** initialize-github reads from config; if config is wrong or credentials changed, deployment breaks
**How to avoid:** Verify that AWS_ACCESS_KEY_ID in GitHub secrets matches accessKeyId in project config
**Warning signs:** GitHub Actions shows authentication errors; CDK deploy fails with permission denied

## Code Examples

Verified patterns from the existing codebase:

### Running Commands in Tests (Existing Pattern)

```typescript
// Source: src/__tests__/harness/run-command.ts
import { execa } from 'execa';

export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeout: number = 600000
): Promise<CommandResult> {
  try {
    const result = await execa(command, args, {
      cwd,
      all: true,
      timeout,
    });
    return {
      success: true,
      exitCode: result.exitCode ?? 0,
      output: result.all ?? '',
      timedOut: false,
    };
  } catch (error) {
    return {
      success: false,
      exitCode: error.exitCode ?? 1,
      output: error.all ?? error.message ?? '',
      timedOut: error.timedOut ?? false,
    };
  }
}
```

### Test Execution Script (New Pattern for Phase 20)

```typescript
// Example: Manual test helper script
// Location: .planning/phases/20-end-to-end-verification/run-e2e-test.ts

import { execa } from 'execa';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface TestStep {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  verify: () => Promise<void>;
}

// Run test protocol and generate report
async function runE2ETest() {
  const results: Array<{ step: string; passed: boolean; output: string }> = [];

  // Test steps would be defined here
  const steps: TestStep[] = [
    {
      name: 'Generate project',
      command: 'npx',
      args: ['create-aws-project', 'e2e-test-project'],
      cwd: '/tmp',
      verify: async () => {
        // Check that project directory exists
      }
    },
    // More steps...
  ];

  for (const step of steps) {
    console.log(`\n▶ ${step.name}...`);
    try {
      const result = await execa(step.command, step.args, {
        cwd: step.cwd,
        all: true,
      });
      await step.verify();
      results.push({ step: step.name, passed: true, output: result.all ?? '' });
      console.log(`✓ ${step.name} PASSED`);
    } catch (error) {
      results.push({ step: step.name, passed: false, output: error.message });
      console.log(`✗ ${step.name} FAILED`);
      break; // Stop on first failure
    }
  }

  // Generate report
  const report = generateReport(results);
  writeFileSync(
    resolve(__dirname, '20-VERIFICATION-REPORT.md'),
    report
  );
}
```

### Idempotency Verification (Pattern to Test)

```typescript
// Test that re-running commands is safe
async function testIdempotency() {
  const projectDir = '/tmp/e2e-test-project';

  // Run setup-aws-envs first time
  const firstRun = await execa('npx', ['setup-aws-envs'], {
    cwd: projectDir,
    all: true
  });

  // Run setup-aws-envs second time (should skip existing resources)
  const secondRun = await execa('npx', ['setup-aws-envs'], {
    cwd: projectDir,
    all: true
  });

  // Verify:
  // 1. Both runs succeed
  // 2. Second run output shows "skip" behavior
  // 3. No duplicate resources created (check AWS Console or API)

  const hasSkipMessages = secondRun.all?.includes('already exists') ||
                          secondRun.all?.includes('Skipping');

  if (!firstRun.exitCode && !secondRun.exitCode && hasSkipMessages) {
    console.log('✓ Idempotency verified');
  } else {
    throw new Error('Idempotency test failed');
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ad-hoc testing | Documented test protocols | 2020s | Repeatable verification, knowledge transfer |
| Automated only | Pragmatic mix of automated + manual | Ongoing | Faster feedback for automatable tests, realistic testing for complex integrations |
| Unit tests only | Test pyramid (unit → integration → e2e) | 2010s | Better coverage of real-world scenarios |
| LocalStack for all AWS | LocalStack for supported services, manual/real AWS for unsupported | 2024+ | More reliable tests that catch real AWS behavior |

**Current 2026 trends:**
- AI-assisted test case generation (not applicable to this phase - manual protocol needed first)
- Shift-left testing in CI/CD pipelines (already present in project)
- Observability-driven testing (verify with real AWS Console, GitHub Actions logs)

**Deprecated/outdated:**
- Mocking complex AWS services like Organizations: LocalStack doesn't support it; mocks miss eventual consistency issues
- 100% automation requirement: Manual testing for verification phases is industry-accepted practice

## Open Questions

1. **Should we include automated AWS resource cleanup?**
   - What we know: Tests create real AWS resources that cost money and count against limits
   - What's unclear: Should cleanup be automated (risks deleting important resources) or manual (documented in test protocol)?
   - Recommendation: Start with manual cleanup documented in test protocol; automate only if tests run frequently

2. **How much evidence is sufficient for verification?**
   - What we know: Need proof that success criteria were met
   - What's unclear: Is terminal output enough, or should we require screenshots, AWS Console exports, GitHub Actions logs?
   - Recommendation: Require at minimum: (1) terminal output for each command, (2) AWS Console screenshot showing created accounts/users, (3) GitHub Actions log showing successful deployment

3. **Should we test with real root credentials or simulate with pre-created admin user?**
   - What we know: Root credential handling is a key Phase 17 feature
   - What's unclear: Is it safe to test root detection with real root credentials in a test account?
   - Recommendation: Test with real root credentials in a dedicated test AWS account (not production). This is the only way to verify root detection works.

4. **How to handle long-running AWS operations in manual tests?**
   - What we know: Account creation takes 2-5 minutes per account
   - What's unclear: Should test protocol include timing expectations, or just note "this step takes several minutes"?
   - Recommendation: Document expected durations in test protocol (e.g., "Step 2: Setup AWS environments - Expected duration: 5-15 minutes"). This helps testers distinguish normal delays from hangs.

5. **Should verification be part of execution or a separate phase?**
   - What we know: Phase 20 is listed in roadmap, suggesting it's intentional
   - What's unclear: Could verification have been part of Phase 19, or is standalone phase better?
   - Recommendation: Standalone verification phase is correct - it validates the integrated system, not individual features. This is standard practice (development → integration → verification).

## Sources

### Primary (HIGH confidence)

- [Test AWS CDK applications - AWS Cloud Development Kit](https://docs.aws.amazon.com/cdk/v2/guide/testing.html) - Official AWS CDK testing documentation
- [REL04-BP04 Make mutating operations idempotent - AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_prevent_interaction_failure_idempotent.html) - AWS best practices for idempotent operations
- [Best practices for testing serverless applications - AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/serverless-application-testing/best-practices.html) - AWS official testing guidance
- Project codebase analysis - Existing test infrastructure at /Users/alwick/development/projects/create-aws-project/src/__tests__

### Secondary (MEDIUM confidence)

- [10 Best Practices for End-to-End Testing AWS Apps](https://awsforengineers.com/blog/10-best-practices-for-end-to-end-testing-aws-apps/) - E2E testing strategies verified with AWS official guidance
- [How to write and execute integration tests for AWS CDK applications](https://aws.amazon.com/blogs/devops/how-to-write-and-execute-integration-tests-for-aws-cdk-applications/) - AWS DevOps blog on CDK integration testing
- [GitHub Actions: Complete CI/CD Guide for Developers](https://dasroot.net/posts/2026/01/github-actions-complete-ci-cd-guide/) - Current 2026 GitHub Actions practices
- [Smoke Testing in 2026: Essential QA Guide](https://blog.qasource.com/a-complete-guide-to-smoke-testing-in-software-qa) - Modern smoke testing approaches
- [End-to-end Testing - Tools and Frameworks Guide for 2026](https://bugbug.io/blog/test-automation/end-to-end-testing/) - Current E2E testing best practices
- [Test Reporting Essentials: Metrics, Practices & Tools](https://www.testrail.com/blog/test-reporting-success/) - Test documentation standards
- [A Primer on Idempotence for AWS Serverless Architecture](https://www.infoq.com/articles/idempotence-aws-serverless-architecture/) - Idempotency testing strategies

### Tertiary (LOW confidence)

- [Integration tests on Node.js CLI: Part 1](https://medium.com/@zorrodg/integration-tests-on-node-js-cli-part-1-why-and-how-fa5b1ba552fe) - Community article on CLI testing (not verified with official source)
- [LocalStack GitHub repository](https://github.com/localstack/localstack) - LocalStack capabilities (confirmed Organizations not supported via documentation check)

## Metadata

**Confidence breakdown:**
- Manual testing approach: HIGH - Verified with multiple sources (AWS guidance, industry practices); LocalStack doesn't support Organizations
- Test protocol structure: HIGH - Standard pattern from test management literature, adapted to project needs
- Verification report format: MEDIUM - Based on industry practices but not project-specific precedent
- Idempotency testing: HIGH - AWS Well-Architected Framework explicitly covers this
- Evidence requirements: MEDIUM - Based on QA best practices but specific to this project's needs

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (30 days - testing practices are relatively stable)

**Key insights for planning:**
1. This phase requires manual execution - don't plan automated test tasks
2. Focus on creating reusable test documentation (protocol + report template)
3. Verification evidence is critical - plan for screenshot capture, log collection
4. Idempotency testing is non-negotiable - must test re-run scenarios
5. AWS Organizations testing requires real AWS account - no mocking available
