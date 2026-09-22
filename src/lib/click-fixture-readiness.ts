/** Read-only clock checks. Readiness describes setup, never a scenario pass. */
type FixtureClock = { slug: string; startsAt: string; endsAt: string };

export function fixtureReadiness(fixtures: FixtureClock[], now = Date.now()): string[] {
  const hours = 3_600_000;
  const expected = [
    "qa-click-just-ended", "qa-click-last-night", "qa-click-old-night",
    "qa-click-soon", "qa-click-plan-a", "qa-click-plan-b", "qa-click-full-night",
  ];
  const issues: string[] = [];
  for (const slug of expected) {
    const fixture = fixtures.find((item) => item.slug === slug);
    if (!fixture) { issues.push(`${slug}: missing.`); continue; }
    const start = Date.parse(fixture.startsAt);
    const end = Date.parse(fixture.endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      issues.push(`${slug}: invalid event dates.`);
      continue;
    }
    const endedHoursAgo = (now - end) / hours;
    const startsInHours = (start - now) / hours;
    const valid = slug === "qa-click-just-ended" ? endedHoursAgo >= 0 && endedHoursAgo < 2
      : slug === "qa-click-last-night" ? endedHoursAgo >= 2 && endedHoursAgo < 48
      : slug === "qa-click-old-night" ? endedHoursAgo >= 48
      : slug === "qa-click-soon" ? startsInHours > 0 && startsInHours < 48
      : startsInHours >= 48 && startsInHours <= 30 * 24;
    if (!valid) issues.push(`${slug}: outside its test window.`);
  }
  return issues;
}
