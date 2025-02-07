import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import * as crypto from 'crypto';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const fileExists = promisify(fs.exists);

export class WalletService {
  private static readonly WALLET_DATA_DIR = 'wallet_data';
  private static readonly ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || 'your-encryption-key-here';

  static async initialize(): Promise<void> {
    try {
      // Create wallet data directory if it doesn't exist
      if (!await fileExists(this.WALLET_DATA_DIR)) {
        await mkdir(this.WALLET_DATA_DIR, { recursive: true });
      }
    } catch (error) {
      console.error('Error initializing wallet service:', error);
      throw error;
    }
  }

  private static getWalletFilePath(userId: string): string {
    // Hash the userId to create a safe filename
    const hashedId = crypto
      .createHash('sha256')
      .update(userId)
      .digest('hex');
    return path.join(this.WALLET_DATA_DIR, `${hashedId}.wallet`);
  }

  private static encrypt(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(this.ENCRYPTION_KEY.padEnd(32).slice(0, 32)),
      iv
    );
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private static decrypt(data: string): string {
    const [ivHex, encryptedData] = data.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(this.ENCRYPTION_KEY.padEnd(32).slice(0, 32)),
      iv
    );
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  static async loadWalletData(userId: string): Promise<string | undefined> {
    try {
      const filePath = this.getWalletFilePath(userId);
      
      if (await fileExists(filePath)) {
        const encryptedData = await readFile(filePath, 'utf8');
        return this.decrypt(encryptedData);
      }
      
      return undefined;
    } catch (error) {
      console.error(`Error reading wallet data for user ${userId}:`, error);
      return undefined;
    }
  }

  static async saveWalletData(userId: string, data: string): Promise<void> {
    try {
      // Ensure the wallet directory exists
      await this.initialize();
      
      const filePath = this.getWalletFilePath(userId);
      const encryptedData = this.encrypt(data);
      
      await writeFile(filePath, encryptedData);
    } catch (error) {
      console.error(`Error saving wallet data for user ${userId}:`, error);
      throw error;
    }
  }

  static async deleteWalletData(userId: string): Promise<void> {
    try {
      const filePath = this.getWalletFilePath(userId);
      
      if (await fileExists(filePath)) {
        await promisify(fs.unlink)(filePath);
      }
    } catch (error) {
      console.error(`Error deleting wallet data for user ${userId}:`, error);
      throw error;
    }
  }

  static async listUserWallets(): Promise<string[]> {
    try {
      const files = await promisify(fs.readdir)(this.WALLET_DATA_DIR);
      return files.map(file => file.replace('.wallet', ''));
    } catch (error) {
      console.error('Error listing user wallets:', error);
      return [];
    }
  }
}