import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {createDemoPhotoFixture} from '../../../scripts/development-photo-fixture.mjs';
test('demo upload fixture rejects production and unsafe databases, and preserves an existing image',async()=>{
  const environment={NODE_ENV:'development',IDENTITY_DEV_FIXTURES:'true',DATABASE_URL:'postgresql://conecta:conecta_local@127.0.0.1:5433/conecta_dev'};
  await assert.rejects(createDemoPhotoFixture({...environment,NODE_ENV:'production'}));
  await assert.rejects(createDemoPhotoFixture({...environment,DATABASE_URL:'postgresql://remote.example/conecta_dev'}));
  const path=await createDemoPhotoFixture(environment),before=await readFile(path);
  assert.equal((await sharp(before).metadata()).format,'png');
  assert.equal(await createDemoPhotoFixture(environment),path);assert.deepEqual(await readFile(path),before);
});
