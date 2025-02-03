# CDP Agent with Semantic Release

## Overview
This project implements a CDP (Coinbase Developer Platform) Agent with automated semantic versioning capabilities. It uses TypeScript and includes features for both interactive chat and autonomous blockchain interactions.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Development](#development)
- [CI/CD](#cicd)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)

## Features
- 🤖 CDP Agent integration for blockchain interactions
- 💬 Interactive chat mode
- 🔄 Autonomous operation mode
- 📦 Automated semantic versioning
- 📝 TypeScript support
- 📊 Logging system

## Prerequisites
- Node.js (v20.x recommended)
- npm (latest version)
- GitHub account
- npm account (for publishing)
- CDP API credentials

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd <your-repo-name>
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure your environment variables:
```env
XAI_API_KEY=your_api_key_here
CDP_API_KEY_NAME=your_key_name_here
CDP_API_KEY_PRIVATE_KEY=your_private_key_here
NETWORK_ID=base-sepolia
NODE_ENV=development
LOG_LEVEL=info
```

## Configuration

### Semantic Release
The project uses semantic-release for automated versioning and publishing. Configuration is in `release.config.js`:

```javascript
module.exports = {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    '@semantic-release/npm',
    '@semantic-release/github',
    '@semantic-release/git'
  ]
}
```

### GitHub Actions
Automated releases are handled by GitHub Actions workflow in `.github/workflows/release.yml`. The workflow:
- Runs on pushes to main branch
- Performs build and tests
- Creates releases

Required secrets:
- `GITHUB_TOKEN`: Automatically provided by GitHub

## Usage

### Running the Agent

1. Start the application:
```bash
npm start
```

2. Choose operation mode:
- Interactive chat mode: Enter `1` or `chat`
- Autonomous mode: Enter `2` or `auto`

### Interactive Chat Mode
```bash
Prompt: <enter your command>
```

### Autonomous Mode
The agent will automatically perform blockchain interactions at set intervals.

## Project Structure
```
├── src/
│   ├── config/
│   │   └── environment.ts
│   ├── controllers/
│   │   ├── AutoModeController.ts
│   │   └── ChatController.ts
│   ├── services/
│   │   ├── AgentService.ts
│   │   ├── WalletService.ts
│   │   └── LoggerService.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── error.ts
│   │   └── constants.ts
│   └── index.ts
├── tests/
│   ├── unit/
│   └── integration/
├── .env
├── .releaserc.js
├── package.json
└── tsconfig.json
```

## Development

### Commit Messages
Follow the Conventional Commits specification:
- `feat:` New features (minor version)
- `fix:` Bug fixes (patch version)
- `BREAKING CHANGE:` Breaking changes (major version)
- `chore:` Maintenance
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Adding tests


### Building
```bash
npm run build
```

## CI/CD

### GitHub Actions Workflow
The release process is automated through GitHub Actions:
1. Triggers on push to main branch
2. Sets up Node.js environment
3. Installs dependencies
4. Runs build
5. Performs semantic release


## Contributing
1. Fork the repository
2. Create your feature branch
3. Commit changes using conventional commits
4. Push to your branch
5. Create a Pull Request

## Troubleshooting

### Common Issues

1. npm install errors
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

2. Semantic Release Issues
```bash
# Check semantic-release configuration
npx semantic-release --dry-run
```

3. GitHub Actions Failures
- Verify all required secrets are set
- Check Node.js version compatibility
- Ensure npm authentication is correct


#Deployment

1. Prerequisites:
- Docker installed
- Node.js 18+
- RabbitMQ
- Redis

4. Environment Variables:
You'll need to set these environment variables:
```
XAI_API_KEY=your_ai_api_key
CDP_API_KEY_NAME=your_cdp_api_key_name
CDP_API_KEY_PRIVATE_KEY=your_private_key
NETWORK_ID=base-sepolia
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://user:password@localhost:5672
```

5. Deployment Steps:
```bash
# Install
npm i

#build 
np run build 

# Start infrastructure services
docker-compose up -d

# Build Docker image for trading agent
docker build -t trading-agent-image:latest .

```

Key Components:
- `DockerDeployment`: Manages container creation and deployment
- `AgentLifecycleManager`: Handles agent state, creation, freezing, and termination
- `MessageQueue`: Manages inter-agent communication via RabbitMQ
- `SecureAgentContainer`: Manages individual agent initialization and message processing

### Support
For issues and questions:
1. Check the [Issues](../../issues) section
2. Create a new issue if needed
3. Include relevant logs and error messages

## License
MIT