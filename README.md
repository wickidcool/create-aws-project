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
create-aws-starter-kit [options] [project-name]

Options:
  --help, -h      Show help message
  --version, -v   Show version number

Examples:
  npx create-aws-starter-kit my-app
  npx create-aws-starter-kit --help
  npx create-aws-starter-kit --version
```

### Setup GitHub Command

After generating a project with AWS Organizations enabled, configure GitHub Actions deployment:

```bash
npx create-aws-starter-kit setup-github
```

This command:
- Creates IAM deployment users per environment (dev, stage, prod)
- Configures GitHub Environments with AWS credentials
- Sets up least-privilege CDK deployment permissions

**Requirements:**
- GitHub Personal Access Token with `repo` and `admin:org` scopes
- AWS credentials with IAM permissions

## Wizard Prompts

The interactive wizard will ask you about:

1. **Project name** - Must be npm-compatible (lowercase, no spaces)
2. **Platforms** - Which platforms to include (web, mobile, api)
3. **Authentication** - Choose your auth provider:
   - None (add later)
   - AWS Cognito
   - Auth0
   - Optional: Social login, MFA
4. **AWS Organizations** - Multi-account setup (optional):
   - Creates separate AWS accounts for each environment
   - Environments: dev, stage, prod (plus optional qa, sandbox)
   - Requires root email per account
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
