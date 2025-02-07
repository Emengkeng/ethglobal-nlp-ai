import { App } from './app';

const startServer = async () => {
  const app = new App();
  await app.start();
};

startServer().catch(console.error);