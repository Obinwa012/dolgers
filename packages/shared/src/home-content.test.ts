import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoHome } from './demo.ts';
import { homeContentSchema } from './schemas.ts';

test('legacy home content defaults to no additional hero slides', () => {
  const { heroSlides: _heroSlides, announcementSlides: _announcementSlides, ...legacyHome } = demoHome;
  const parsed = homeContentSchema.parse(legacyHome);

  assert.deepEqual(parsed.heroSlides, []);
  assert.deepEqual(parsed.announcementSlides, []);
});

test('home content accepts up to four additional announcements', () => {
  const parsed = homeContentSchema.safeParse({
    ...demoHome,
    announcementSlides: Array.from({ length: 4 }, (_, index) => `Announcement ${index + 1}`),
  });
  const tooMany = homeContentSchema.safeParse({
    ...demoHome,
    announcementSlides: Array.from({ length: 5 }, (_, index) => `Announcement ${index + 1}`),
  });

  assert.equal(parsed.success, true);
  assert.equal(tooMany.success, false);
});

test('home content accepts up to four additional hero slides', () => {
  const parsed = homeContentSchema.safeParse({
    ...demoHome,
    heroSlides: Array.from({ length: 4 }, (_, index) => ({
      ...demoHome.hero,
      title: `Campaign ${index + 1}`,
    })),
  });
  const tooMany = homeContentSchema.safeParse({
    ...demoHome,
    heroSlides: Array.from({ length: 5 }, (_, index) => ({
      ...demoHome.hero,
      title: `Campaign ${index + 1}`,
    })),
  });

  assert.equal(parsed.success, true);
  assert.equal(tooMany.success, false);
});
