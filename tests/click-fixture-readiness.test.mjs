import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureReadiness } from '../src/lib/click-fixture-readiness.ts';

const now = Date.parse('2026-09-22T02:00:00Z');
const hour = 3_600_000;
function fixtures() {
  return [
    ['just-ended', -1, -.5], ['last-night', -5, -3], ['old-night', -100, -98],
    ['soon', 24, 26], ['plan-a', 120, 123], ['plan-b', 216, 218], ['full-night', 144, 146],
  ].map(([name, start, end]) => ({
    slug: `qa-click-${name}`,
    startsAt: new Date(now + start * hour).toISOString(),
    endsAt: new Date(now + end * hour).toISOString(),
  }));
}
test('fresh setup supports every labelled clock scenario', () => {
  assert.deepEqual(fixtureReadiness(fixtures(), now), []);
});
test('existing fixtures that aged out are not reported ready', () => {
  const issues = fixtureReadiness(fixtures(), now + 18 * 24 * hour);
  assert.equal(issues.length, 6);
  assert.ok(issues.some(issue => issue.includes('last-night')));
  assert.ok(issues.some(issue => issue.includes('plan-a')));
});
test('the just-ended scenario stops being ready at the prompt boundary', () => {
  assert.ok(fixtureReadiness(fixtures(), now + 1.5 * hour).some(issue => issue.includes('just-ended')));
});
test('missing and malformed fixtures need setup', () => {
  assert.equal(fixtureReadiness([], now).length, 7);
  const rows = fixtures();
  rows[0].endsAt = 'not a date';
  assert.match(fixtureReadiness(rows, now)[0], /invalid event dates/);
});
test('the open fixture closes at exactly 48 hours after its end', () => {
  const rows = fixtures();
  rows[1].endsAt = new Date(now - 48 * hour).toISOString();
  rows[1].startsAt = new Date(now - 50 * hour).toISOString();
  assert.ok(fixtureReadiness(rows, now).some(issue => issue.includes('last-night')));
});
