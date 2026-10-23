// Run: node --test scripts/check-face-filter.cjs
// No models, image uploads, paid services, or browser are needed for these
// membership/sorting regressions. Real photo accuracy needs a labelled album.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const loaded = new Map()

function loadSource(file) {
  if (loaded.has(file)) return loaded.get(file).exports
  const module = { exports: {} }
  loaded.set(file, module)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const localRequire = name => name.startsWith('.')
    ? loadSource(path.resolve(path.dirname(file), `${name}.ts`))
    : require(name)
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports)
  return module.exports
}

const faces = loadSource(path.join(root, 'lib/face-recognition.ts'))
const groups = loadSource(path.join(root, 'lib/face-identity-groups.ts'))
const sorting = loadSource(path.join(root, 'lib/album-photo-sort.ts'))
const { readExifCaptureTime } = loadSource(path.join(root, 'lib/use-photo-capture-times.ts'))

function face(id, value, imageId = id, x = 0.1) {
  return {
    faceId: `${id}_face_0`, imageId, imageName: `${imageId}.jpg`,
    descriptor: [value, ...Array(127).fill(0)], avatarDataUrl: '',
    box: { x, y: 0.1, width: 0.2, height: 0.2 },
    score: 0.99, quality: 0.95, canSeedCluster: true, embeddingModel: 'face-api-128',
  }
}

function cluster(id, members) {
  return {
    id, label: id, avatarDataUrl: '', faces: members,
    imageIds: [...new Set(members.map(member => member.imageId))],
    centroid: members[0].descriptor, referenceFaceIds: [members[0].faceId],
  }
}

test('confirmed merge returns every member photo even when poses exceed the query threshold', () => {
  const original = faces.clusterDetectedFaces([face('front', 0), face('front2', 0.1), face('profile', 0.75)])
  assert.equal(original.length, 2)
  const confirmation = groups.mergeConfirmedFaceGroups([], original)
  assert.ok(confirmation)
  const merged = groups.applyConfirmedFaceGroups(original, confirmation)
  assert.equal(merged.length, 1)
  assert.deepEqual([...faces.matchFaceCluster(merged[0], 0.32)].sort(), ['front', 'front2', 'profile'])
  assert.deepEqual([...faces.matchReferenceFace(merged, face('profile', 0.75), 0.32)].sort(), ['front', 'front2', 'profile'])
})

test('different face positions in the same photo cannot be confirmed as one identity', () => {
  assert.equal(groups.mergeConfirmedFaceGroups([], [
    cluster('left', [face('left', 0, 'photo', 0.1)]),
    cluster('right', [face('right', 0.4, 'photo', 0.65)]),
  ]), null)
})

test('ambiguous reference does not fall back to returning both lookalikes', () => {
  const candidates = [cluster('one', [face('one', 0)]), cluster('two', [face('two', 0.5)])]
  assert.equal(faces.matchReferenceFace(candidates, face('query', 0.25)).size, 0)
  assert.deepEqual([...faces.matchReferenceFace(candidates, face('query', 0.1))], ['one'])
})

test('descriptor spaces cannot be mixed', () => {
  const incompatible = { ...face('one', 0), embeddingModel: 'different-model' }
  assert.equal(faces.matchReferenceFace([cluster('other', [incompatible])], face('query', 0)).size, 0)
})

test('filename sorting is numeric, uses displayed names, and never mutates source order', () => {
  const items = [{ name: 'Ảnh 10.jpg' }, { name: 'Ảnh 2.jpg' }, { name: 'Ảnh 1.jpg' }]
  assert.deepEqual(sorting.sortAlbumPhotos(items, 'name-asc').map(item => item.name), ['Ảnh 1.jpg', 'Ảnh 2.jpg', 'Ảnh 10.jpg'])
  assert.deepEqual(sorting.sortAlbumPhotos(items, 'name-asc', item => item.name === 'Ảnh 10.jpg' ? 'A.jpg' : item.name).map(item => item.name), ['Ảnh 10.jpg', 'Ảnh 1.jpg', 'Ảnh 2.jpg'])
  assert.equal(items[0].name, 'Ảnh 10.jpg')
})

test('capture order accepts EXIF/ISO, rejects invalid dates, and keeps unknown dates last', () => {
  const items = [
    { name: 'new.jpg', capturedTime: '2026:10:22 12:00:00' },
    { name: 'old.jpg', capturedTime: '2026-10-21T12:00:00Z' },
    { name: 'unknown.jpg', modifiedTime: '2000-01-01T00:00:00Z' },
  ]
  assert.deepEqual(sorting.sortAlbumPhotos(items, 'captured-desc').map(item => item.name), ['new.jpg', 'old.jpg', 'unknown.jpg'])
  assert.deepEqual(sorting.sortAlbumPhotos(items, 'captured-asc').map(item => item.name), ['old.jpg', 'new.jpg', 'unknown.jpg'])
  assert.equal(sorting.getPhotoCaptureTimestamp('2026:02:30 01:00:00'), null)
})

function jpegWithExif(little) {
  const tiff = Buffer.alloc(90)
  tiff.write(little ? 'II' : 'MM')
  const u16 = (value, offset) => little ? tiff.writeUInt16LE(value, offset) : tiff.writeUInt16BE(value, offset)
  const u32 = (value, offset) => little ? tiff.writeUInt32LE(value, offset) : tiff.writeUInt32BE(value, offset)
  u16(42, 2); u32(8, 4); u16(1, 8)
  u16(0x8769, 10); u16(4, 12); u32(1, 14); u32(26, 18)
  u16(1, 26); u16(0x9003, 28); u16(2, 30); u32(20, 32); u32(44, 36)
  tiff.write('2026:10:21 15:34:56\0', 44)
  return Buffer.concat([Buffer.from([255, 216, 255, 225, 0, 98]), Buffer.from('Exif\0\0'), tiff, Buffer.from([255, 217])])
}

test('EXIF fallback handles both byte orders and truncated headers', () => {
  for (const little of [true, false]) assert.equal(readExifCaptureTime(jpegWithExif(little)), '2026:10:21 15:34:56')
  assert.equal(readExifCaptureTime(jpegWithExif(true).subarray(0, 30)), null)
  assert.equal(readExifCaptureTime(new Uint8Array(5)), null)
})
