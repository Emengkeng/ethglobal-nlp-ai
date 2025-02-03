// In a separate file, e.g., messageQueueSingleton.ts
import { MessageQueue } from './MessageQueue';

export const messageQueueSingleton = new MessageQueue();

// Initialize the message queue at app startup
export async function initializeMessageQueue() {
  await messageQueueSingleton.initialize();
}