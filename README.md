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

## Post-Install Setup

After creating your project, you'll set up AWS environments and GitHub deployment. This is a one-time setup.

### Prerequisites

Before you begin:
- AWS CLI configured with credentials from your AWS management account
- GitHub repository created for your project
- GitHub Personal Access Token with "repo" scope ([create one here](https://github.com/settings/tokens/new))

### Step 1: connect to your .git project

* Initialize the repository
```
git init
```

* Add the remote repository using the git remote add <name> <url> command. A common practice is to name it origin.
```bash
git remote add origin <REMOTE_URL>
```

* Verify the connection by listing your remotes. The -v flag shows the URLs.
```bash
git remote -v
```

* Push your local commits to the remote repository for the first time.
```bash
git push -u origin main
```

### Step 2: Set Up AWS Environments

From your project directory, run:

```bash
npx create-aws-project setup-aws-envs
```

This command:
- Creates an AWS Organization (if you don't have one)
- Creates three environment accounts: dev, stage, prod
- Prompts for a unique root email for each account (tip: use aliases like you+dev@email.com)

**What's happening:** AWS Organizations lets you isolate each environment in its own AWS account. This is a security best practice - your production data is completely separate from development.

Expected output:
```
✔ Created AWS Organization: o-xxxxxxxxxx
✔ Created dev account: 123456789012
✔ Created stage account: 234567890123
✔ Created prod account: 345678901234

AWS environment setup complete!
```

Account IDs are saved to `.aws-starter-config.json` for the next step.

### Step 3: Configure GitHub Environments

For each environment, run:

```bash
npx create-aws-project initialize-github dev
```

This command:
- Creates an IAM deployment user in the target AWS account
- Configures GitHub Environment secrets with AWS credentials
- Sets up least-privilege permissions for CDK deployments

**What's happening:** Each GitHub Environment (Development, Staging, Production) gets its own AWS credentials. When GitHub Actions runs, it uses the right credentials for the target environment.

Repeat for each environment:
```bash
npx create-aws-project initialize-github stage
npx create-aws-project initialize-github prod
```

You'll be prompted for your GitHub PAT each time (it's not stored).

### You're Done!

Push to main to trigger your first deployment:
```bash
git push origin main
```

GitHub Actions will deploy to your dev environment automatically.

## Troubleshooting

### setup-aws-envs errors

**"Insufficient AWS permissions"**

Your AWS credentials need Organizations permissions. Ensure you're using credentials from the management account (not a member account).

Required permissions:
- organizations:DescribeOrganization
- organizations:CreateOrganization
- organizations:CreateAccount
- organizations:DescribeCreateAccountStatus

**"AWS Organizations limit reached"**

AWS limits how many accounts you can create. Contact AWS Support to request a limit increase.

**"AWS Organization is still initializing"**

New organizations take up to an hour to fully initialize. Wait and try again.

### initialize-github errors

**"Cannot assume role in target account"**

The command needs to access the target AWS account via `OrganizationAccountAccessRole`. This role is created automatically when you create accounts via `setup-aws-envs`. Ensure:
1. You ran `setup-aws-envs` first
2. Your credentials are from the management account
3. The account ID in `.aws-starter-config.json` is correct

**"IAM user already exists"**

The deployment user already exists in the target account. To retry:
1. Go to AWS Console > IAM > Users
2. Delete the existing `<project>-<env>-deploy` user
3. Run the command again

**"GitHub authentication failed"**

Your Personal Access Token may be invalid or missing permissions. Ensure:
1. Token has "repo" scope enabled
2. Token belongs to the repository owner (or has collaborator access)
3. Token is not expired

Create a new token at: https://github.com/settings/tokens/new

## After Setup

Once your project is set up:

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
