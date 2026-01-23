# {{PROJECT_NAME}}

Full-stack application built with create-aws-project.

## Quick Start

```bash
npm install
```

{{#if WEB}}
Start the web app:
```bash
npm run web
```
{{/if WEB}}

{{#if MOBILE}}
Start the mobile app:
```bash
npm run mobile
```
{{/if MOBILE}}

{{#if API}}
Deploy to AWS:
```bash
npm run cdk:deploy
```
{{/if API}}

## Project Structure

```
{{PROJECT_NAME}}/
{{#if WEB}}
├── apps/web/          # React + Vite web application
{{/if WEB}}
{{#if MOBILE}}
├── apps/mobile/       # React Native + Expo mobile app
{{/if MOBILE}}
{{#if API}}
├── apps/api/          # AWS Lambda API + CDK infrastructure
{{/if API}}
├── packages/
│   ├── common-types/  # Shared TypeScript types
│   └── api-client/    # Shared API client
└── package.json       # Root package with Nx scripts
```

## Available Commands

| Command | Description |
|---------|-------------|
{{#if WEB}}
| `npm run web` | Start web development server |
| `npm run build:web` | Build web app for production |
{{/if WEB}}
{{#if MOBILE}}
| `npm run mobile` | Start Expo development server |
| `npm run mobile:ios` | Run on iOS simulator |
| `npm run mobile:android` | Run on Android emulator |
{{/if MOBILE}}
{{#if API}}
| `npm run cdk:deploy` | Deploy to AWS (dev environment) |
| `npm run cdk:deploy:stage` | Deploy to staging |
| `npm run cdk:deploy:prod` | Deploy to production |
| `npm run cdk:synth` | Synthesize CloudFormation template |
{{/if API}}
| `npm run test` | Run all tests |
| `npm run lint` | Lint all projects |

## AWS Setup

Before deploying to AWS, you need to set up your AWS environments and GitHub deployment pipeline.

### Prerequisites

- AWS Root account created
- AWS CLI configured with management account credentials
- GitHub repository created for this project
- GitHub Personal Access Token with "repo" scope

### 1. Set Up AWS Environments

```bash
npx create-aws-project setup-aws-envs
```

This creates an AWS Organization with three environment accounts (dev, stage, prod).

### 2. Configure GitHub Deployment

For each environment:

```bash
npx create-aws-project initialize-github dev
npx create-aws-project initialize-github stage
npx create-aws-project initialize-github prod
```

This configures GitHub Environment secrets for automated deployments.

### 3. Deploy

Push to main to trigger your first deployment:

```bash
git push origin main
```

For detailed setup instructions and troubleshooting, see the [create-aws-project documentation](https://www.npmjs.com/package/create-aws-starter-kit).

## CI/CD Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| pull-request.yml | Any PR | Runs lint, test, and build validation |
| deploy-dev.yml | Push to main | Deploys to development environment |
| deploy-stage.yml | Manual | Deploys to staging environment |
| deploy-prod.yml | Manual | Deploys to production environment |

## Environment Variables

{{#if WEB}}
### Web App

Copy `apps/web/.env.example` to `apps/web/.env.local` and configure:

- `VITE_API_URL` - API Gateway endpoint URL
{{/if WEB}}

{{#if API}}
### API

Environment variables are configured in CDK stacks (`apps/api/cdk/`).
{{/if API}}

## Technology Stack

{{#if WEB}}
- **Web**: React 19, Vite, Chakra UI, TypeScript
{{/if WEB}}
{{#if MOBILE}}
- **Mobile**: React Native, Expo, TypeScript
{{/if MOBILE}}
{{#if API}}
- **API**: AWS Lambda, API Gateway, DynamoDB, CDK
{{/if API}}
- **Monorepo**: Nx
- **Testing**: Jest, Testing Library
- **CI/CD**: GitHub Actions

## License

ISC
