import * as fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const fileExists = promisify(fs.exists);

export class WalletService {
  private static readonly WALLET_DATA_FILE = 'wallet_data.txt';

  static async loadWalletData(): Promise<string | undefined> {
    try {
      if (await fileExists(this.WALLET_DATA_FILE)) {
        return await readFile(this.WALLET_DATA_FILE, 'utf8');
      }
      return undefined;
    } catch (error) {
      console.error('Error reading wallet data:', error);
      return undefined;
    }
  }

  static async saveWalletData(data: string): Promise<void> {
    try {
      await writeFile(this.WALLET_DATA_FILE, data);
    } catch (error) {
      console.error('Error saving wallet data:', error);
      throw error;
    }
  }
}