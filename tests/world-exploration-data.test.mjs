import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const world = JSON.parse(fs.readFileSync('data/world-exploration.json', 'utf8'));
const series = JSON.parse(fs.readFileSync('data/series.json', 'utf8'));

const stripQuery = (value) => String(value || '').split('?')[0];
const normalizeName = (value) => String(value || '').replace(/\s+/g, '').trim();
const normalizeNumber = (value) => {
  const match = String(value || '').match(/(\d{1,4})\s*\/\s*(\d{1,4})/);
  return match ? `${Number(match[1])}/${Number(match[2])}` : '';
};

const catalogByImage = new Map();
for (const set of series) {
  for (const card of set.cards || []) {
    const image = stripQuery(card.image);
    if (!image) continue;
    if (!catalogByImage.has(image)) catalogByImage.set(image, []);
    catalogByImage.get(image).push({ set, card });
  }
}

test('world exploration exposes one complete 4x3 page for generations 1 through 9', () => {
  assert.equal(world.metadata?.version, 4);
  assert.equal(world.generations?.length, 9);
  assert.deepEqual(world.generations.map((item) => item.generation), [1,2,3,4,5,6,7,8,9]);

  const allSlotIds = [];
  for (const generation of world.generations) {
    assert.equal(generation.status, 'active', `${generation.generation}세대가 active가 아님`);
    assert.equal(generation.slots?.length, 12, `${generation.generation}세대가 12장이 아님`);

    const phaseIds = new Set((generation.phases || []).map((phase) => phase.id));
    for (const slot of generation.slots) {
      assert.ok(slot.id, `${generation.generation}세대 슬롯 id 누락`);
      assert.ok(phaseIds.has(slot.phase), `${slot.id}: 존재하지 않는 phase ${slot.phase}`);
      assert.ok(slot.title, `${slot.id}: title 누락`);
      assert.match(slot.card?.number || '', /^\d{3}\/\d{3}$/, `${slot.id}: 카드 번호 형식 오류`);
      assert.match(slot.card?.image || '', /^https:\/\/cards\.image\.pokemonkorea\.co\.kr\//, `${slot.id}: 공식 카드 이미지가 아님`);
      allSlotIds.push(slot.id);
    }
  }

  assert.equal(allSlotIds.length, 108);
  assert.equal(new Set(allSlotIds).size, 108, '월드탐험도감 slot id 중복');
});

test('every world exploration slot resolves to the reviewed Korean series catalog card', () => {
  for (const generation of world.generations) {
    for (const slot of generation.slots) {
      const image = stripQuery(slot.card?.image);
      const matches = catalogByImage.get(image) || [];
      assert.ok(matches.length, `${generation.generation}세대 ${slot.id}: series.json에서 이미지 미발견`);

      const expectedNumber = normalizeNumber(slot.card?.number);
      const exact = matches.find(({ card }) =>
        normalizeName(card.name) === normalizeName(slot.title) &&
        normalizeNumber(card.code) === expectedNumber
      );
      assert.ok(exact, `${generation.generation}세대 ${slot.id}: 카드명/번호가 series.json과 불일치`);
    }
  }
});
