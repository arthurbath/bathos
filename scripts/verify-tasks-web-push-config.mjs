import {
  createECDH,
  createHash,
  timingSafeEqual,
} from 'node:crypto';
import { pathToFileURL } from 'node:url';

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function required(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function decodeBase64Url(value, name) {
  if (!BASE64URL_PATTERN.test(value)) {
    throw new Error(`${name} must be unpadded URL-safe base64`);
  }
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value) {
    throw new Error(`${name} is not canonical URL-safe base64`);
  }
  return decoded;
}

function validateSubject(value) {
  if (value.startsWith('mailto:')) {
    if (!value.slice('mailto:'.length).includes('@')) {
      throw new Error('TASKS_WEB_PUSH_SUBJECT must contain a contact email address');
    }
    return;
  }

  let subject;
  try {
    subject = new URL(value);
  } catch {
    throw new Error('TASKS_WEB_PUSH_SUBJECT must be a mailto: or public HTTPS URI');
  }
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (subject.protocol !== 'https:' || !subject.hostname || localHosts.has(subject.hostname)) {
    throw new Error('TASKS_WEB_PUSH_SUBJECT must be a mailto: or public HTTPS URI');
  }
}

export function validateTaskReminderConfiguration(environment) {
  const dispatchSecret = required(environment, 'TASKS_REMINDER_DISPATCH_SECRET');
  if (Buffer.byteLength(dispatchSecret, 'utf8') < 32) {
    throw new Error('TASKS_REMINDER_DISPATCH_SECRET must contain at least 32 bytes');
  }

  const serverPublicKey = required(environment, 'TASKS_WEB_PUSH_VAPID_PUBLIC_KEY');
  const clientPublicKey = required(environment, 'VITE_TASKS_WEB_PUSH_PUBLIC_KEY');
  if (serverPublicKey !== clientPublicKey) {
    throw new Error('The server and client VAPID public keys do not match');
  }

  const publicKey = decodeBase64Url(serverPublicKey, 'TASKS_WEB_PUSH_VAPID_PUBLIC_KEY');
  const privateKey = decodeBase64Url(
    required(environment, 'TASKS_WEB_PUSH_VAPID_PRIVATE_KEY'),
    'TASKS_WEB_PUSH_VAPID_PRIVATE_KEY',
  );
  if (publicKey.length !== 65 || publicKey[0] !== 4) {
    throw new Error('TASKS_WEB_PUSH_VAPID_PUBLIC_KEY must be an uncompressed P-256 public key');
  }
  if (privateKey.length !== 32) {
    throw new Error('TASKS_WEB_PUSH_VAPID_PRIVATE_KEY must be a 32-byte P-256 private key');
  }

  const ecdh = createECDH('prime256v1');
  try {
    ecdh.setPrivateKey(privateKey);
  } catch {
    throw new Error('TASKS_WEB_PUSH_VAPID_PRIVATE_KEY is not a valid P-256 private key');
  }
  const derivedPublicKey = ecdh.getPublicKey(undefined, 'uncompressed');
  if (
    derivedPublicKey.length !== publicKey.length
    || !timingSafeEqual(derivedPublicKey, publicKey)
  ) {
    throw new Error('The VAPID public and private keys do not form a key pair');
  }

  validateSubject(required(environment, 'TASKS_WEB_PUSH_SUBJECT'));
  return {
    publicKeyFingerprint: createHash('sha256').update(publicKey).digest('hex').slice(0, 12),
  };
}

function run() {
  const result = validateTaskReminderConfiguration(process.env);
  console.log('Task reminder deployment configuration is internally consistent.');
  console.log(`VAPID public key fingerprint: ${result.publicKeyFingerprint}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Task reminder configuration is invalid');
    process.exitCode = 1;
  }
}
