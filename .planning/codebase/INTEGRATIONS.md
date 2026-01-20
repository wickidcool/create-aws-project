# External Integrations

**Analysis Date:** 2026-01-20

## APIs & External Services

**Payment Processing:**
- Not applicable (CLI scaffolding tool, no payments)

**Email/SMS:**
- Not applicable

**External APIs:**
- npm Registry - Package publishing only (no runtime API calls)

## Data Storage

**Databases:**
- Not applicable (file-based output only)

**File Storage:**
- Local filesystem - Template reading and project generation
- No cloud storage

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- Not applicable (CLI tool, no auth required)

**OAuth Integrations:**
- None

## Monitoring & Observability

**Error Tracking:**
- None (console.error to stderr)

**Analytics:**
- None

**Logs:**
- Console output only (stdout/stderr)

## CI/CD & Deployment

**Hosting:**
- npm Registry - Package published at `create-aws-starter-kit`
- No server hosting required

**CI Pipeline:**
- Not detected in this project
- Template includes GitHub Actions (`templates/.github/workflows/`)

## Environment Configuration

**Development:**
- No environment variables required
- All configuration via CLI wizard prompts

**Staging:**
- Not applicable

**Production:**
- Published via `npm publish`
- `prepublishOnly` script runs build

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

---

## Template Integrations (Generated Projects)

The CLI generates projects with the following integrations pre-configured:

### AWS Services

**Core Infrastructure:**
- AWS Lambda - Serverless compute (`templates/apps/api/cdk/`)
- AWS DynamoDB - NoSQL database (`templates/apps/api/src/lib/dynamo/`)
- AWS S3 - Static file hosting (`templates/apps/api/cdk/static-stack.ts`)
- AWS CloudFront - CDN (`templates/apps/api/cdk/static-stack.ts`)
- AWS API Gateway - REST API endpoints

**Authentication Options:**
1. AWS Cognito - Native auth (`templates/apps/api/src/middleware/cognito-auth.ts`)
   - Environment: `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`
   - SDK: aws-jwt-verify 4.0.0

2. Auth0 - Third-party auth (`templates/apps/api/src/middleware/auth0-auth.ts`)
   - Environment: `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`
   - SDK: jose 5.2.0

### CI/CD (Optional)

**GitHub Actions** (when `github-actions` feature selected):
- Pull request validation: `templates/.github/workflows/pull-request.yml`
- Dev deployment: `templates/.github/workflows/deploy-dev.yml`
- Stage deployment: `templates/.github/workflows/deploy-stage.yml`
- Prod deployment: `templates/.github/workflows/deploy-prod.yml`
- Custom actions: `templates/.github/actions/`

### Development Tools

**LocalStack:**
- Local AWS emulation for development
- Commands: `npm run cdk:deploy:local`, `npm run cdk:destroy:local`
- SDK: aws-cdk-local 3.0.1

---

*Integration audit: 2026-01-20*
*Update when adding/removing external services*
