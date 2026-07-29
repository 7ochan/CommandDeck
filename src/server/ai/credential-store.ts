import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

function getCredentialsFilePath(): string {
  const homeDir = os.homedir();
  const dir = path.join(homeDir, '.commanddeck');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'credentials.enc');
}

function getEncryptionKey(): Buffer {
  const seed = `${os.hostname()}-${os.homedir()}-CommandDeck-Key-Salt-2026`;
  return crypto.scryptSync(seed, 'commanddeck-salt-v1', 32);
}

function encryptString(text: string): string {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptString(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) return '';
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encryptedText = Buffer.from(parts[2], 'hex');
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encryptedText),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export class CredentialStore {
  private static instance: CredentialStore;
  private credentials = new Map<string, string>();
  private loaded = false;

  private constructor() {
    this.load();
  }

  static getInstance(): CredentialStore {
    if (!CredentialStore.instance) {
      CredentialStore.instance = new CredentialStore();
    }
    return CredentialStore.instance;
  }

  load(): void {
    try {
      const filePath = getCredentialsFilePath();
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const decrypted = decryptString(raw);
        if (decrypted) {
          const parsed = JSON.parse(decrypted) as Record<string, string>;
          if (parsed && typeof parsed === 'object') {
            for (const [provider, key] of Object.entries(parsed)) {
              if (typeof key === 'string' && key.trim()) {
                this.credentials.set(provider, key.trim());
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[CredentialStore] Error loading credentials:', err);
    }
    this.loaded = true;
  }

  save(): void {
    try {
      const filePath = getCredentialsFilePath();
      const obj: Record<string, string> = {};
      for (const [provider, key] of this.credentials.entries()) {
        obj[provider] = key;
      }
      const json = JSON.stringify(obj);
      const encrypted = encryptString(json);
      fs.writeFileSync(filePath, encrypted, { encoding: 'utf8', mode: 0o600 });
    } catch (err) {
      console.error('[CredentialStore] Error saving credentials:', err);
    }
  }

  get(provider: string): string | undefined {
    if (!this.loaded) this.load();
    return this.credentials.get(provider);
  }

  set(provider: string, key: string): void {
    if (!this.loaded) this.load();
    const trimmed = key.trim();
    if (!trimmed) {
      return;
    }
    this.credentials.set(provider, trimmed);
    this.save();
  }

  delete(provider: string): void {
    if (!this.loaded) this.load();
    this.credentials.delete(provider);
    this.save();
  }

  has(provider: string): boolean {
    if (provider === 'ollama') return true;
    if (!this.loaded) this.load();
    const val = this.credentials.get(provider);
    return Boolean(val && val.trim().length > 0);
  }

  getAllHasMap(): Record<string, boolean> {
    return {
      gemini: this.has('gemini'),
      openai: this.has('openai'),
      anthropic: this.has('anthropic'),
      ollama: true,
    };
  }
}

export const credentialStore = CredentialStore.getInstance();
