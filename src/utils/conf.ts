import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { randomBytes } from '@noble/ciphers/webcrypto';
import { hexToBytes, bytesToHex, utf8ToBytes } from '@noble/ciphers/utils';
import Conf from 'conf';
import * as M from '../types/meta';
import path from 'path';

const currVersion = "v1.2_22180_2025.10.16"
type ConfigData = Record<string, any>;
const defAuth: M.SystemAuth = {
  authType: 'free', 
  uuid: '',
  enFullName: 'Unauthorized',
  notes: 'Default configuration',
  enNmuberLimit: 1,
  appNumberLimit: 1,
  userNumberLimit: 5,
  moduleNumberLimit: 20,
  sysVersion: currVersion,
  dateLimit: false, 
  dateExpired: 0, 
  customLogo: 'none'
}

export class ConfigManager {
  private static instance: ConfigManager;
  private readonly store: Conf<ConfigData>;
  private readonly encryptionKey: Uint8Array;
  private readonly encryptedFields: Set<string> = new Set([
    'INIT_PWD',
    'MONGO_USERNAME',
    'MONGO_PASSWORD',
    'HTTP_JWTKEY',
    'SHARED_KEY',
    'DATE_LIMIT',
    'DATE_LIMIT_EXPIRE',
  ]);
  private readonly nonceLength = 24;

  private readonly defConfigs = {
    INIT_TIME: '',
    INIT_PWD: 'qianbone.com',
    DATE_LIMIT: 'none',   // 'none' 'limit'
    DATE_LIMIT_EXPIRE: '',
    CONIFG_VERSION: currVersion, 

    MONGO_IP: '127.0.0.1',
    MONGO_PORT: '27017',
    MONGO_USERNAME: 'qbone',
    MONGO_PASSWORD: '123456',
    MONGO_MAINDB: 'qbdb',
    MONGO_BUSIDB: 'qbdb',
    MONGO_GFSDB: 'qbdb',
    MONGO_JOBDB: 'qbdb',
    MONGO_BUCKETNAME: 'qbfs',
    MONGO_DIMSPLIT: '|',

  }

  private readonly sysKeys = {
    API_KEY: 'fa686bfdffd3758f6377abbc23bf3d9bdc1a0dda4a6e7f8dbdd579fa1ff6d7e1',
    CONFIG_KEY: '4be0f5007803591048363e3f0353c5d3170e250a8e9637c44cece93adff3837f',
  }

  private readonly enKey = this.sysKeys.CONFIG_KEY;
  private readonly configPath: string;

  constructor() {
    this.configPath = path.join(process.cwd(), 'qb-config');
    if (!/^[0-9a-f]{64}$/i.test(this.enKey)) {
      throw new Error('Encryption key must be 64-character hex string (256-bit)');
    }
    this.encryptionKey = hexToBytes(this.enKey);

    this.store = new Conf<ConfigData>({
      configName: path.basename(this.configPath, '.json'),
      cwd: path.dirname(this.configPath),
      projectName: 'qbone', 
      projectVersion: '2025.7.25',
      defaults: this.defConfigs as any,
      serialize: (value) => this.encryptConfig(value),
      deserialize: (raw) => this.decryptConfig(raw),
    });
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private isEncryptedValue(value: string): boolean {
    try {
      const bytes = hexToBytes(value);
      return bytes.length > this.nonceLength;
    } catch {
      return false;
    }
  }

  private decryptValue(value: string | undefined): string | undefined {
    if (!value) return value;

    if (!this.isEncryptedValue(value)) {
      return value;
    }

    try {
      const data = hexToBytes(value);
      if (data.length <= this.nonceLength) {
        console.error('Invalid encrypted data length');
        return value;
      }

      const nonce = data.slice(0, this.nonceLength);
      const ciphertext = data.slice(this.nonceLength);
      const cipher = xchacha20poly1305(this.encryptionKey, nonce);
      return new TextDecoder().decode(cipher.decrypt(ciphertext));
    } catch (error) {
      console.error('Failed to decrypt value:', error);
      return value; 
    }
  }

  private encryptConfig(config: ConfigData): string {
    const result: ConfigData = { ...config };

    this.encryptedFields.forEach((field) => {
      if (result[field] && !this.isEncryptedValue(result[field]!)) {
        const nonce = randomBytes(this.nonceLength);
        const cipher = xchacha20poly1305(this.encryptionKey, nonce);
        const encrypted = cipher.encrypt(utf8ToBytes(result[field]!));
        result[field] = bytesToHex(new Uint8Array([...nonce, ...encrypted]));
      }
    });

    const entries = Object.entries(result);
    const formattedLines = entries.map(([key, value]) => {
      const escapedValue = JSON.stringify(value);
      return `  "${key}": ${escapedValue}`;
    });

    return `{\n${formattedLines.join(',\n')}\n}`;
  }

  private decryptConfig(raw: string): ConfigData {
    try {
      const parsed = JSON.parse(raw) as ConfigData;
      const result: ConfigData = { ...parsed };

      this.encryptedFields.forEach((field) => {
        if (result[field]) {
          result[field] = this.decryptValue(result[field]);
        }
      });

      return result;
    } catch (error) {
      console.error('Failed to parse config file:', error);
      return this.defConfigs as ConfigData;
    }
  }

  public get(key: string): string | undefined {
    const value = this.store.get(key);
    return this.encryptedFields.has(key) ? this.decryptValue(value) : value;
  }

  public getDefAuth() {
    return defAuth;
  }

  public getAll(): ConfigData {
    const allConfigs = { ...this.store.store };
    const result: ConfigData = {};

    Object.entries(allConfigs).forEach(([key, value]) => {
      result[key] = this.encryptedFields.has(key) ? this.decryptValue(value) : value;
    });

    return result;
  }

  public set(key: string, value: string | undefined): void {
    let finalValue = value;

    if (value && this.encryptedFields.has(key) && !this.isEncryptedValue(value)) {
      const nonce = randomBytes(this.nonceLength);
      const cipher = xchacha20poly1305(this.encryptionKey, nonce);
      const encrypted = cipher.encrypt(utf8ToBytes(value));
      finalValue = bytesToHex(new Uint8Array([...nonce, ...encrypted]));
    }

    this.store.set(key, finalValue);
  }

  public getConfigPath(): string {
    return this.store.path;
  }
}