import * as argon2 from 'argon2';

const options = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1, hashLength: 32 } as const;
let activeWork = 0;

function validInput(value: unknown, minimum: number): value is string {
  if (typeof value !== 'string' || value.length > 256) return false;
  const characters = [...value];
  return characters.length >= minimum && characters.length <= 128
    && characters.every(character => {
      const point = character.codePointAt(0)!;
      return point < 0xd800 || point > 0xdfff;
    });
}

async function boundedWork<T>(operation: () => Promise<T>): Promise<T> {
  if (activeWork >= 4) throw new Error('PASSWORD_WORK_BUSY');
  activeWork++;
  try { return await operation(); }
  finally { activeWork--; }
}

export async function hashPassword(password: unknown): Promise<string> {
  if (!validInput(password, 15)) throw new Error('INVALID_PASSWORD');
  return boundedWork(() => argon2.hash(password, options));
}

export async function hashDevelopmentFixturePassword(
  fixture: 'admin' | 'testuser', environment: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  if (environment.NODE_ENV !== 'development' || environment.IDENTITY_DEV_FIXTURES !== 'true') {
    throw new Error('DEVELOPMENT_FIXTURES_DISABLED');
  }
  if (fixture !== 'admin' && fixture !== 'testuser') throw new Error('INVALID_DEVELOPMENT_FIXTURE');
  return boundedWork(() => argon2.hash(fixture, options));
}

// Only locally supported costs may reach native verification; malformed DB values fail closed.
export function isSupportedPasswordHash(hash: unknown): hash is string {
  if (typeof hash !== 'string' || hash.length > 512) return false;
  const match = /^\$argon2id\$v=19\$([^$]+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(hash);
  if (!match) return false;
  const entries = match[1]!.split(',').map(parameter => parameter.split('='));
  if (entries.length !== 3 || new Set(entries.map(([key]) => key)).size !== 3
    || entries.some(([key, value, extra]) => !['m', 't', 'p'].includes(key!) || extra !== undefined || !/^[1-9]\d*$/.test(value!))) return false;
  const costs = Object.fromEntries(entries.map(([key, value]) => [key, Number(value)]));
  if (!(costs.m! >= 19456 && costs.m! <= 65536 && costs.t! >= 2 && costs.t! <= 6 && costs.p! >= 1 && costs.p! <= 4)) return false;
  const salt = Buffer.from(match[2]!, 'base64');
  const digest = Buffer.from(match[3]!, 'base64');
  const canonical = (bytes: Buffer) => bytes.toString('base64').replace(/=+$/, '');
  return salt.length >= 16 && salt.length <= 64 && digest.length === 32
    && canonical(salt) === match[2] && canonical(digest) === match[3];
}

export async function verifyPassword(password: unknown, hash: unknown): Promise<boolean> {
  if (!validInput(password, 1) || !isSupportedPasswordHash(hash)) return false;
  return boundedWork(() => argon2.verify(hash, password));
}
