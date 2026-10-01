import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const world = JSON.parse(fs.readFileSync('data/world-exploration.json', 'utf8'));
const series = JSON.parse(fs.readFileSync('data/series.json', 'utf8'));
const pokedex = JSON.parse(fs.readFileSync('data/pokedex.json', 'utf8'));
const people = JSON.parse(fs.readFileSync('data/people.json', 'utf8'));

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

const pokemonByNumber = new Map(
  (pokedex.records || []).map((pokemon) => [Number(pokemon.number), pokemon]),
);
const peopleById = new Map(
  (people.people || []).map((person) => [person.id, person]),
);

test('world exploration v6 preserves legacy place slots and lays every reference into story chapters', () => {
  assert.equal(world.metadata?.version, 6);
  assert.equal(world.metadata?.presentation, 'story-chapter-sequence');
  assert.equal(world.metadata?.ownershipModel, 'place-slots-v1-compatible');
  assert.equal(world.metadata?.referenceOwnership, 'source-dex-linked');
  assert.equal(world.generations?.length, 9);
  assert.deepEqual(world.generations.map((item) => item.generation), [1,2,3,4,5,6,7,8,9]);

  const allSlotIds = [];
  for (const generation of world.generations) {
    assert.equal(generation.status, 'active', `${generation.generation}세대가 active가 아님`);
    assert.equal(generation.slots?.length, 12, `${generation.generation}세대 장소 슬롯이 12장이 아님`);
    assert.equal(generation.pokemonRefs?.length, 6, `${generation.generation}세대 대표 포켓몬이 6종이 아님`);
    assert.equal(generation.peopleRefs?.length, 4, `${generation.generation}세대 주요 인물이 4명이 아님`);
    assert.equal(generation.stories?.length, 3, `${generation.generation}세대 스토리가 3개가 아님`);
    assert.equal(generation.chapters?.length, 3, `${generation.generation}세대 챕터가 3개가 아님`);

    const phaseIds = new Set((generation.phases || []).map((phase) => phase.id));
    for (const slot of generation.slots) {
      assert.ok(slot.id, `${generation.generation}세대 슬롯 id 누락`);
      assert.ok(phaseIds.has(slot.phase), `${slot.id}: 존재하지 않는 phase ${slot.phase}`);
      assert.ok(slot.title, `${slot.id}: title 누락`);
      assert.match(slot.card?.number || '', /^\d{3}\/\d{3}$/, `${slot.id}: 카드 번호 형식 오류`);
      assert.match(slot.card?.image || '', /^https:\/\/cards\.image\.pokemonkorea\.co\.kr\//, `${slot.id}: 공식 카드 이미지가 아님`);
      allSlotIds.push(slot.id);
    }

    for (const number of generation.pokemonRefs) {
      const pokemon = pokemonByNumber.get(Number(number));
      assert.ok(pokemon, `${generation.generation}세대 pokemonRef ${number} 누락`);
      assert.equal(Number(pokemon.generation), generation.generation, `${number}: 세대 불일치`);
    }

    for (const personId of generation.peopleRefs) {
      const person = peopleById.get(personId);
      assert.ok(person, `${generation.generation}세대 peopleRef ${personId} 누락`);
      assert.equal(Number(person.generation), generation.generation, `${personId}: 세대 불일치`);
    }

    for (const story of generation.stories) {
      assert.ok(story.id && story.title && story.description, `${generation.generation}세대 스토리 데이터 누락`);
    }

    const chapterItems = generation.chapters.flatMap((chapter) => chapter.items || []);
    const chapterPlaces = chapterItems.filter((item) => item.type === 'place').map((item) => item.ref);
    const chapterPokemon = chapterItems.filter((item) => item.type === 'pokemon').map((item) => Number(item.ref));
    const chapterPeople = chapterItems.filter((item) => item.type === 'person').map((item) => item.ref);

    assert.equal(chapterPlaces.length, 12, `${generation.generation}세대 챕터 장소 수`);
    assert.deepEqual(new Set(chapterPlaces), new Set(generation.slots.map((slot) => slot.id)), `${generation.generation}세대 장소 배치 누락/중복`);
    assert.deepEqual(new Set(chapterPokemon), new Set(generation.pokemonRefs), `${generation.generation}세대 포켓몬 배치 누락/중복`);
    assert.deepEqual(new Set(chapterPeople), new Set(generation.peopleRefs), `${generation.generation}세대 인물 배치 누락/중복`);
    assert.equal(chapterPokemon.length, generation.pokemonRefs.length, `${generation.generation}세대 포켓몬 중복 배치`);
    assert.equal(chapterPeople.length, generation.peopleRefs.length, `${generation.generation}세대 인물 중복 배치`);

    for (const chapter of generation.chapters) {
      assert.ok(chapter.id && chapter.title && chapter.description, `${generation.generation}세대 챕터 정보 누락`);
      assert.equal((chapter.items || []).filter((item) => item.type === 'place').length, 4, `${generation.generation}세대 ${chapter.id}: 장소 4장이 아님`);
      assert.equal((chapter.items || []).filter((item) => item.type === 'pokemon').length, 2, `${generation.generation}세대 ${chapter.id}: 포켓몬 2종이 아님`);
      assert.ok(chapter.items.every((item) => ['place','pokemon','person'].includes(item.type)), `${generation.generation}세대 ${chapter.id}: 지원하지 않는 타입`);
    }
  }

  assert.equal(allSlotIds.length, 108);
  assert.equal(new Set(allSlotIds).size, 108, '월드탐험도감 기존 slot id 중복');
});

test('world references contain identities only and do not duplicate source dex ownership', () => {
  for (const generation of world.generations) {
    assert.ok(generation.pokemonRefs.every(Number.isInteger));
    assert.ok(generation.peopleRefs.every((value) => typeof value === 'string'));
    assert.equal(Object.prototype.hasOwnProperty.call(generation, 'pokemonOwned'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(generation, 'peopleOwned'), false);
  }
});

test('every generation 2-9 place slot resolves to the reviewed Korean series catalog card', () => {
  for (const generation of world.generations.filter((item) => item.generation >= 2)) {
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


test('world client reads linked ownership without writing duplicate Pokemon or people state', () => {
  const client = fs.readFileSync('world.js', 'utf8');
  assert.match(client, /registry[.]ownershipFor\("national", source\)/);
  assert.match(client, /registry[.]ownershipFor\("people", source\)/);
  assert.match(client, /referenceSource[?][.]overrides/);
  assert.match(client, /referenceSource[?][.]peopleOverrides/);
  assert.doesNotMatch(client, /pokemonOwned\s*:/);
  assert.doesNotMatch(client, /peopleOwned\s*:/);
});


test('world client renders story chapters instead of separate Pokemon, people and place sections', () => {
  const client = fs.readFileSync('world.js', 'utf8');
  assert.match(client, /function renderStoryChapter\(/);
  assert.match(client, /function renderStoryJourney\(/);
  assert.match(client, /storyItem\(generation, item\)/);
  assert.match(client, /makeSlot\(slot, index, \{ story: true \}\)/);
  assert.doesNotMatch(client, /function renderReferenceGroup\(/);
  assert.doesNotMatch(client, /function renderStoryGroup\(/);
  assert.doesNotMatch(client, /function renderBinderPage\(/);
});
