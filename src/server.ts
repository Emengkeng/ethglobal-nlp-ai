import { App } from './App';

const startServer = async () => {
  const app = new App();
  await app.start();
};

startServer().catch(console.error);