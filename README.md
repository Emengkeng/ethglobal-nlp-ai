# Secure Interactive Agent System

## 📋 Table of Contents
- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
  - [Repository Cloning](#1-repository-cloning)
  - [Dependency Installation](#2-dependency-installation)
  - [Environment Configuration](#3-environment-configuration)
- [Deployment Infrastructure](#deployment-infrastructure)
  - [Docker Deployment](#-docker-deployment)
  - [Key Deployment Components](#key-deployment-components)
- [Running the System](#running-the-system)
  - [Build Application](#1-build-application)
  - [Start Interactive Agent](#2-start-interactive-agent)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
  - [Commit Message Convention](#commit-message-convention)
  - [Semantic Release](#semantic-release)
- [Security Principles](#security-principles)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

## Overview
A sophisticated, secure CDP (Coinbase Developer Platform) Agent system designed for isolated, interactive user experiences with robust deployment and infrastructure management.

## System Architecture

### 🏗️ Core Components
- **Interactive Agent**: Individual user interaction endpoint
- **Secure Containerization**: Isolated deployment for each agent
- **Infrastructure Management**: Docker, RabbitMQ, and Redis integration
- **Semantic Versioning**: Automated release and versioning

## Prerequisites

### 🖥️ System Requirements
- Node.js (v20.x recommended)
- Docker (latest version)
- npm
- RabbitMQ
- Redis
- GitHub Account
- CDP API Credentials

## Installation & Setup

### 1. Repository Cloning
```bash
git clone <your-repo-url>
cd <your-repo-name>
```

### 2. Dependency Installation
```bash
npm install
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your specific configurations
```

### 4. Required Environment Variables
```env
# API & Platform Credentials
XAI_API_KEY=your_ai_api_key
CDP_API_KEY_NAME=your_cdp_api_key_name
CDP_API_KEY_PRIVATE_KEY=your_private_key

# Network Configuration
NETWORK_ID=base-sepolia
NODE_ENV=development
LOG_LEVEL=info

# Infrastructure Connection
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://user:password@localhost:5672
```

## Deployment Infrastructure

### 🐳 Docker Deployment

#### Infrastructure Services
```bash
# Start required services
docker-compose up -d
```

#### Agent Container Build
```bash
# Build Docker image for trading agent
docker build -t trading-agent-image:latest .
```

### Key Deployment Components
- **DockerDeployment**: Manages container creation
- **AgentLifecycleManager**: Handles agent state management
- **MessageQueue**: Inter-agent communication via RabbitMQ
- **SecureAgentContainer**: Agent initialization and message processing

## Running the System

### 1. Build Application
```bash
npm run build
```

### 2. Start Interactive Agent
```bash
npm start
```

### Interaction Modes
- Interactive Chat Mode: Direct user interaction
- Secure, isolated agent deployment for each user

## Project Structure
```
├── src/
│   ├── config/           # Configuration management
│   ├── controllers/      # Request handling
│   ├── services/         # Core business logic
│   │   ├── AgentService.ts
│   │   ├── WalletService.ts
│   │   └── LoggerService.ts
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   └── index.ts          # Application entry point
├── tests/                # Testing suites
│   ├── unit/
│   └── integration/
├── deployment/           # Docker and deployment configs
├── .env                  # Environment configuration
└── tsconfig.json         # TypeScript configuration
```

## Development Workflow

### Commit Message Convention
Follows Conventional Commits specification:
- `feat:` New features (triggers minor version)
- `fix:` Bug fixes (triggers patch version)
- `BREAKING CHANGE:` Major version changes
- `chore:` Maintenance tasks
- `docs:` Documentation updates
- `refactor:` Code restructuring

### Semantic Release
- Automated versioning via `semantic-release`
- Generates changelogs
- Publishes to npm and GitHub

## Security Principles

### Isolation Strategies
- Separate Docker containers per agent
- Granular access controls
- Input sanitization
- Stateless design minimizing persistent data risks

## Troubleshooting

### Common Setup Issues
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# Verify semantic-release configuration
npx semantic-release --dry-run
```

## Contributing
1. Fork repository
2. Create feature branch
3. Commit using conventional commits
4. Push changes
5. Open Pull Request
6. Pass security and integration tests

## Support
- Review [Issues](../../issues) section
- Create detailed issue reports
- Include comprehensive logs and error messages

## License
MIT License
```