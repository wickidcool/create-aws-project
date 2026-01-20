# Technology Stack

**Analysis Date:** 2026-01-20

## Languages

**Primary:**
- TypeScript 5.9.3 - All application code (`package.json`, `tsconfig.json`)

**Secondary:**
- JavaScript (ES2022) - Build output, config files
- YAML - GitHub Actions workflows (`templates/.github/workflows/`)

## Runtime

**Environment:**
- Node.js 22.16.0 - `.nvmrc`, `package.json` engines field (>=22.0.0)
- ES Modules - `package.json` ("type": "module")

**Package Manager:**
- npm 10.0.0+ - `package.json` engines field
- Lockfile: `package-lock.json` present (~261 dependencies)
- Config: `.npmrc` with `legacy-peer-deps=true`

## Frameworks

**Core:**
- None (vanilla Node.js CLI tool)

**Testing:**
- Jest 30.2.0 - Unit testing (`jest.config.ts`)
- ts-jest 29.4.5 - TypeScript support for Jest

**Build/Dev:**
- TypeScript 5.9.3 - Compilation to JavaScript
- ESLint 9.39.1 - Code linting (`eslint.config.js`)
- @typescript-eslint - TypeScript linting plugins

**Template Stack (Generated Projects):**
- Nx 22.3.3 - Monorepo build system (`templates/root/package.json`)
- React 19.2.0 - UI framework (web)
- Vite 7.2.2 - Web bundler (`templates/apps/web/vite.config.ts`)
- Chakra UI 2.10.9 - Component library
- React Native 0.76.5 - Mobile framework
- Expo ~52.0.0 - React Native tooling
- AWS CDK 2.1100.1 - Infrastructure as code

## Key Dependencies

**Critical (CLI Tool):**
- prompts 2.4.2 - Interactive CLI prompts (`package.json`)
- picocolors 1.1.1 - Terminal color formatting (`package.json`)
- validate-npm-package-name 7.0.2 - NPM package name validation (`package.json`)

**Template Dependencies:**
- axios 1.13.2 - HTTP client (`templates/root/package.json`)
- zustand 5.0.8 - State management (`templates/root/package.json`)
- aws-jwt-verify 4.0.0 - Cognito JWT verification (`templates/root/package.json`)
- jose 5.2.0 - JWT library for Auth0 (`templates/root/package.json`)
- @aws-sdk/client-dynamodb 3.940.0 - DynamoDB client (`templates/root/package.json`)
- @aws-lambda-powertools/logger 2.29.0 - Lambda logging (`templates/root/package.json`)

## Configuration

**Environment:**
- No environment variables required for CLI
- Configuration via CLI wizard only

**Build:**
- `tsconfig.json` - TypeScript compiler options (ES2022 target, NodeNext modules)
- `tsconfig.spec.json` - Test TypeScript config
- `jest.config.ts` - Jest test runner with ESM support
- `eslint.config.js` - ESLint flat config with TypeScript support

## Platform Requirements

**Development:**
- macOS/Linux/Windows (any platform with Node.js)
- No external dependencies (no Docker required)

**Production:**
- Distributed as npm package
- Installed globally via `npx create-aws-starter-kit`
- Runs on user's Node.js installation (>=22.0.0)

---

*Stack analysis: 2026-01-20*
*Update after major dependency changes*
