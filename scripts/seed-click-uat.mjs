// RETIRED (build prompt 1, 2026-10-16). Kept so the values it wrote stay on record.
//
// This script made staff accounts "clickable" by filling the columns /onboarding
// writes and seeding pending clicks from the @click.local personas to them. Both
// halves are now wrong by spec, and the database refuses the second:
//
//   1. It wrote birth date 1990-01-01, suburb "Surry Hills", the bio
//      "Testing the click flow. Placeholder profile - swap this out in
//      /profile/edit." and a /home/avatars/av-N.jpg face onto each ADMIN_EMAILS
//      profile. That "UAT fingerprint" never makes anyone a member now: member
//      status is profiles.member_onboarded_at, written only by finishing the
//      onboarding flow (01 §1.4), and the build-prompt-1 backfill excludes
//      accounts carrying it. The face is a stock image, so it fails the photo
//      check (photo_status, 01 §2).
//   2. It inserted clicks from TEST personas to REAL admin accounts. Test
//      accounts only ever click test accounts (22A §4.5), and migration 077's
//      clicks trigger refuses any click across that line.
//
// To walk the click flow as staff now: finish onboarding on your own account
// like any member, or test with two test accounts - admins can act as a test
// account through view-as (03 §1), and /test-click's Test pairs controls and
// the /dev/coord/* hooks drive a pair end to end (03 §10).

console.error(
  "seed-click-uat.mjs is retired - see the note at the top of the file for what replaces it.",
);
process.exit(1);
