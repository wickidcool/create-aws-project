# create-aws-project

Create a new AWS project from scratch including CloudFront, API Gateway, Lambdas, Cognito or Auth0, DynamoDB. GitHub pipeline for testing and deploying.

[![npm version](https://img.shields.io/npm/v/create-aws-starter-kit.svg)](https://www.npmjs.com/package/create-aws-starter-kit)

## Quick Start

```bash
npx create-aws-project my-project
```

**Requirements:** Node.js 22.16.0+ (npm included)

## Features

- **Interactive wizard** - Guided setup with smart defaults
- **Platform selection** - Choose web, mobile, and/or API
- **Feature toggles** - GitHub Actions CI/CD, VS Code configuration
- **Theme customization** - Choose a brand color for your UI
- **AWS region configuration** - Set your deployment region

## What You Get

The generated project is a full-stack Nx monorepo with:

- **React web app** - Vite + Chakra UI
- **React Native mobile app** - Expo
- **AWS Lambda API** - TypeScript handlers
- **AWS CDK infrastructure** - Infrastructure as code
- **Shared packages** - Common types and API client

## CLI Options

```
create-aws-starter-kit [command] [options]

Commands:
  (default)           Create a new project (interactive wizard)
  setup-aws-envs      Set up AWS Organizations and environment accounts
  initialize-github   Configure GitHub Environment for deployment

Options:
  --help, -h          Show help message
  --version, -v       Show version number

Examples:
  npx create-aws-starter-kit my-app
  npx create-aws-starter-kit setup-aws-envs
  npx create-aws-starter-kit initialize-github dev
  npx create-aws-starter-kit --help
```

## Wizard Prompts

The interactive wizard will ask you about:

1. **Project name** - Must be npm-compatible (lowercase, no spaces)
2. **Platforms** - Which platforms to include (web, mobile, api)
3. **Authentication** - Choose your auth provider:
   - None (add later)
   - AWS Cognito
   - Auth0
4. **Auth features** - Social login, MFA (conditional on auth provider)
5. **Features** - Optional extras:
   - GitHub Actions workflows for CI/CD
   - VS Code workspace configuration
6. **AWS region** - Where to deploy your infrastructure
7. **Brand color** - Theme color for your UI (blue, purple, teal, green, orange)

## Requirements

- **Node.js** - Version 22.16.0 or higher
  - Note: Node 25+ has Jest compatibility issues - use 22.x or 24.x
- **npm** - Included with Node.js

## After Generation

Once your project is created:

```bash
cd my-project
npm install
```

Then start developing:

```bash
# Start web app
npm run web

# Start mobile app
npm run mobile

# Deploy API to AWS
npm run cdk:deploy
```

See the generated project's README for detailed documentation.

## License

ISC
