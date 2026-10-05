import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {encodeProfilePhoto} from '../dist/modules/identity/photos.js';

function chunk(kind,data){
  const type=Buffer.from(kind),body=Buffer.concat([type,data]);let crc=0xffffffff;
  for(const byte of body){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  const size=Buffer.alloc(4),checksum=Buffer.alloc(4);size.writeUInt32BE(data.length);checksum.writeUInt32BE((crc^0xffffffff)>>>0);
  return Buffer.concat([size,body,checksum]);
}
function pngChunks(png){const chunks=[];for(let offset=8;offset+12<=png.length;){const size=png.readUInt32BE(offset);chunks.push({kind:png.subarray(offset+4,offset+8).toString(),data:png.subarray(offset+8,offset+8+size)});offset+=size+12;}return chunks;}

test('photos decode actual JPEG/PNG/WebP, orient and resize without source metadata or enlargement',async()=>{
  for(const format of ['jpeg','png','webp']){
    const input=await sharp({create:{width:800,height:400,channels:3,background:'#D7AED1'}}).toFormat(format).withMetadata({orientation:6}).toBuffer();
    const output=await encodeProfilePhoto(input);const metadata=await sharp(output).metadata();
    assert.equal(metadata.format,'webp');assert.equal(metadata.width,256);assert.equal(metadata.height,512);
    for(const field of ['exif','icc','xmp','iptc','orientation'])assert.equal(metadata[field],undefined);
  }
  const small=await sharp({create:{width:32,height:20,channels:3,background:'#ABC'}}).png().toBuffer();
  assert.equal((await sharp(await encodeProfilePhoto(small)).metadata()).width,32);
});
test('photos reject SVG/disguised formats, broken data, oversize bytes/pixels and multiple frames',async()=>{
  for(const input of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),Buffer.from('not an image'),Buffer.alloc(5*1024*1024+1)])
    await assert.rejects(encodeProfilePhoto(input),{message:'INVALID_REQUEST'});
  const large=await sharp({create:{width:4001,height:4000,channels:3,background:'#AAA'}}).png().toBuffer();
  await assert.rejects(encodeProfilePhoto(large),{message:'INVALID_REQUEST'});
  const frames=await sharp({create:{width:10,height:20,channels:3,background:'#AAA',pageHeight:10}}).gif().toBuffer();
  await assert.rejects(encodeProfilePhoto(frames),{message:'INVALID_REQUEST'});
  const pixels=Buffer.concat([Buffer.alloc(300,0),Buffer.alloc(300,255)]);
  const animated=await sharp(pixels,{raw:{width:10,height:20,channels:3,pageHeight:10}}).webp({loop:0,delay:[100,100]}).toBuffer();
  assert.equal((await sharp(animated).metadata()).pages,2);
  await assert.rejects(encodeProfilePhoto(animated),{message:'INVALID_REQUEST'});
});

test('photos reject a valid APNG container and accept the exact pixel and byte boundaries',async()=>{
  const png=await sharp({create:{width:10,height:10,channels:3,background:'#000'}}).png().toBuffer();
  const parts=pngChunks(png),ihdr=parts.find(part=>part.kind==='IHDR').data,idat=parts.filter(part=>part.kind==='IDAT').map(part=>chunk(part.kind,part.data));
  const animation=Buffer.alloc(8);animation.writeUInt32BE(1);const control=Buffer.alloc(26);control.writeUInt32BE(10,4);control.writeUInt32BE(10,8);control.writeUInt16BE(1,20);control.writeUInt16BE(10,22);
  const apng=Buffer.concat([png.subarray(0,8),chunk('IHDR',ihdr),chunk('acTL',animation),chunk('fcTL',control),...idat,chunk('IEND',Buffer.alloc(0))]);
  await assert.rejects(encodeProfilePhoto(apng),{message:'INVALID_REQUEST'});
  const limitPixels=await sharp({create:{width:4000,height:4000,channels:3,background:'#AAA'}}).png().toBuffer();
  assert.equal((await sharp(await encodeProfilePhoto(limitPixels)).metadata()).width,512);
  const padded=Buffer.concat([png.subarray(0,png.length-12),chunk('teSt',Buffer.alloc(5*1024*1024-png.length-12)),png.subarray(-12)]);
  assert.equal(padded.length,5*1024*1024);assert.equal((await sharp(await encodeProfilePhoto(padded)).metadata()).width,10);
});
