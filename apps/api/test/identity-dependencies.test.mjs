import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import * as argon2 from 'argon2';
import nodemailer from 'nodemailer';
import sharp from 'sharp';

test('Argon2id native binding verifies passwords with the selected cost', async (context) => {
  const options = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
  const started = performance.now();
  const hash = await argon2.hash('Dependency smoke test password', options);
  const [, algorithm, version, parameters] = hash.split('$');
  assert.equal(algorithm, 'argon2id');
  assert.equal(version, 'v=19');
  assert.deepEqual(parameters.split(',').sort(), ['m=19456', 'p=1', 't=2']);
  assert.equal(await argon2.verify(hash, 'Dependency smoke test password'), true);
  assert.equal(await argon2.verify(hash, 'Different password'), false);
  context.diagnostic(`Hash plus two verifications: ${Math.round(performance.now() - started)} ms`);
});

test('SMTP library creates a message without connecting or delivering email', async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const result = await transport.sendMail({
    from: 'studio@conecta.example.test',
    to: 'recipient@conecta.example.test',
    subject: 'Identity dependency check',
    text: 'Local message construction only.',
  });
  assert.ok(Buffer.isBuffer(result.message));
  assert.match(result.message.toString(), /Local message construction only\./);
  transport.close();
});

test('Image binding decodes and re-encodes pixels without preserving metadata', async () => {
  const input = await sharp({
    create: { width: 16, height: 16, channels: 3, background: '#ffb7a5' },
  }).withExif({ IFD0: { Artist: 'Metadata must be removed' } }).jpeg().toBuffer();
  assert.ok((await sharp(input).metadata()).exif);
  const output = await sharp(input, { limitInputPixels: 16_000_000 })
    .rotate().resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
    .webp().toBuffer();
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 16);
  assert.equal(metadata.height, 16);
  assert.equal(metadata.exif, undefined);
});
