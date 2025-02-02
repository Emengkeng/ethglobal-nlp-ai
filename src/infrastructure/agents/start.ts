import { SecureAgentContainer } from './SecureAgentContainer';

async function main() {
  const userId = process.env.USER_ID;
  const agentId = process.env.AGENT_ID;

  if (!userId || !agentId) {
    throw new Error('Missing required environment variables');
  }

  const container = new SecureAgentContainer(userId, agentId);
  await container.initialize();

  // Keep the process alive
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM signal, preparing for shutdown...');
    // Perform cleanup if needed
    process.exit(0);
  });
}

main().catch(error => {
  console.error('Failed to start agent container:', error);
  process.exit(1);
});