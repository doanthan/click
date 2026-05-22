import { currentUser } from "@clerk/nextjs/server";
import type { Session } from "next-auth";
import { auth as nextAuth } from "@/auth";
import { getPostgresPool } from "./postgres";

export type BscRole = "user" | "group_leader" | "moderator" | "admin" | "super_admin";

export type BscViewer = {
  clerkUserId: string;
  email: string;
  name: string;
  imageUrl: string | null;
};

export type BscProfile = {
  id: string;
  clerkUserId: string;
  email: string;
  role: BscRole;
  displayName: string | null;
  photoUrl: string | null;
  bio: string | null;
  suburb: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
  church: string | null;
  denomination: string | null;
  faithBackground: string | null;
  prayerFocus: string | null;
  willingToHost: boolean;
  willingToLead: boolean;
  meetingPreference: "in_person" | "online" | "both";
  privacy: "public" | "private";
  ageVerified: boolean;
  trustedLeader: boolean;
  memberSince: string;
};

export type BscGroup = {
  id: string;
  slug: string;
  name: string;
  description: string;
  groupType: string;
  visibility: "public" | "private";
  meetingType: "in_person" | "online" | "both";
  suburb: string | null;
  city: string | null;
  postcode: string | null;
  schedule: string | null;
  dayOfWeek: string | null;
  ageGroup: string | null;
  denomination: string | null;
  tags: string[];
  leaderName: string;
  memberCount: number;
  pendingRequests: number;
  viewerMembership: "leader" | "member" | "pending" | null;
};

export type BscPrayerPost = {
  id: string;
  kind: "prayer" | "praise";
  title: string;
  content: string;
  authorName: string;
  groupName: string | null;
  prayedCount: number;
  commentCount: number;
  createdAt: string;
};

export type BscTestimony = {
  id: string;
  title: string;
  story: string;
  authorName: string;
  status: "pending" | "approved" | "rejected";
  likeCount: number;
  commentCount: number;
  createdAt: string;
};

export type BscEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  locationName: string | null;
  onlineLink: string | null;
  groupName: string | null;
  visibility: "public" | "group";
  goingCount: number;
  viewerRsvp: "going" | "not_going" | null;
};

export type BscNotification = {
  id: string;
  title: string;
  body: string;
  actionUrl: string | null;
  read: boolean;
  createdAt: string;
};

export type BscAdminStats = {
  users: number;
  groups: number;
  prayerPosts: number;
  testimonies: number;
  events: number;
  reports: number;
};

const sampleGroups: BscGroup[] = [
  {
    id: "sample-inner-west",
    slug: "inner-west-thursday-study",
    name: "Inner West Thursday Study",
    description:
      "A relaxed weekly Bible study for adults who want Scripture, prayer, and consistent community.",
    groupType: "bible_study",
    visibility: "public",
    meetingType: "in_person",
    suburb: "Marrickville",
    city: "Sydney",
    postcode: "2204",
    schedule: "Thursday evenings",
    dayOfWeek: "Thursday",
    ageGroup: "25-40",
    denomination: "Interdenominational",
    tags: ["Romans", "Prayer", "New believers"],
    leaderName: "Grace Tan",
    memberCount: 12,
    pendingRequests: 0,
    viewerMembership: null,
  },
  {
    id: "sample-online",
    slug: "online-psalms-prayer-circle",
    name: "Online Psalms Prayer Circle",
    description:
      "A gentle online group reading the Psalms and praying through everyday burdens together.",
    groupType: "prayer",
    visibility: "public",
    meetingType: "online",
    suburb: null,
    city: "Online",
    postcode: null,
    schedule: "Monday nights",
    dayOfWeek: "Monday",
    ageGroup: "All ages",
    denomination: "Interdenominational",
    tags: ["Psalms", "Prayer", "Online"],
    leaderName: "Samuel Brooks",
    memberCount: 19,
    pendingRequests: 0,
    viewerMembership: null,
  },
  {
    id: "sample-family",
    slug: "northern-beaches-family-study",
    name: "Northern Beaches Family Study",
    description:
      "A family-friendly group with shared dinner, Bible reading, and space for children.",
    groupType: "family",
    visibility: "public",
    meetingType: "in_person",
    suburb: "Brookvale",
    city: "Sydney",
    postcode: "2100",
    schedule: "Sunday afternoons",
    dayOfWeek: "Sunday",
    ageGroup: "Families",
    denomination: "Baptist",
    tags: ["Families", "Dinner", "Gospel of Mark"],
    leaderName: "Naomi Clarke",
    memberCount: 16,
    pendingRequests: 0,
    viewerMembership: null,
  },
];

const samplePrayers: BscPrayerPost[] = [
  {
    id: "sample-prayer-1",
    kind: "prayer",
    title: "Wisdom for a new job",
    content: "Please pray for humility, courage, and steady faith as I begin a new role.",
    authorName: "First name only",
    groupName: null,
    prayedCount: 18,
    commentCount: 3,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "sample-praise-1",
    kind: "praise",
    title: "Answered prayer after surgery",
    content: "My mother is recovering well. Thank you to everyone who prayed.",
    authorName: "Anonymous",
    groupName: null,
    prayedCount: 31,
    commentCount: 6,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

const sampleTestimonies: BscTestimony[] = [
  {
    id: "sample-testimony-1",
    title: "Finding faith again through a small group",
    story:
      "After years away from church, one steady Bible study helped me ask honest questions and pray again.",
    authorName: "Rachel",
    status: "approved",
    likeCount: 22,
    commentCount: 4,
    createdAt: new Date(Date.now() - 9 * 86400000).toISOString(),
  },
];

const sampleEvents: BscEvent[] = [
  {
    id: "sample-event-1",
    title: "Community Prayer Night",
    description: "A public prayer night for local churches and Bible study groups.",
    startsAt: new Date(Date.now() + 4 * 86400000).toISOString(),
    locationName: "Parramatta",
    onlineLink: null,
    groupName: null,
    visibility: "public",
    goingCount: 42,
    viewerRsvp: null,
  },
];

function slugFromTitle(title: string) {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || `item-${Date.now().toString(36)}`
  );
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
}

function adminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "admin@click.local")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function canModerate(role: BscRole | null | undefined) {
  return role === "moderator" || role === "admin" || role === "super_admin";
}

export function canManageUsers(role: BscRole | null | undefined) {
  return role === "admin" || role === "super_admin";
}

export async function getBscViewer(): Promise<BscViewer | null> {
  try {
    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress;
    if (clerkUser?.id && email) {
      return {
        clerkUserId: clerkUser.id,
        email: email.toLowerCase(),
        name: clerkUser.fullName || clerkUser.firstName || email,
        imageUrl: clerkUser.imageUrl || null,
      };
    }
  } catch {
    // Clerk is optional in local preview until keys are configured.
  }

  let session: Session | null = null;
  try {
    session = await nextAuth();
  } catch {}
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;

  return {
    clerkUserId: `nextauth:${email}`,
    email,
    name: session?.user?.name || email,
    imageUrl: session?.user?.image || null,
  };
}

function databaseUnavailableError() {
  const error = new Error("Postgres is not configured for Bible Study Connect.");
  error.name = "DatabaseUnavailableError";
  return error;
}

function isDatabaseConnectivityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: string }).code;
  return (
    error.name === "AggregateError" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "EHOSTUNREACH" ||
    code === "ETIMEDOUT" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN"
  );
}

function authRequiredError() {
  const error = new Error("Sign in to continue.");
  error.name = "AuthRequiredError";
  return error;
}

function profileGateError() {
  const error = new Error("Complete your profile before using this community feature.");
  error.name = "ProfileIncompleteError";
  return error;
}

function ageGateError() {
  const error = new Error("Confirm you are old enough before using community features.");
  error.name = "AgeVerificationError";
  return error;
}

function rowToProfile(row: {
  id: string;
  clerk_user_id: string;
  email: string;
  role: string;
  display_name: string | null;
  photo_url: string | null;
  bio: string | null;
  suburb: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
  church: string | null;
  denomination: string | null;
  faith_background: string | null;
  prayer_focus: string | null;
  willing_to_host: boolean;
  willing_to_lead: boolean;
  meeting_preference: "in_person" | "online" | "both";
  privacy: "public" | "private";
  age_verified_at: Date | null;
  trusted_leader_at: Date | null;
  created_at: Date;
}): BscProfile {
  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    email: row.email,
    role: row.role as BscRole,
    displayName: row.display_name,
    photoUrl: row.photo_url,
    bio: row.bio,
    suburb: row.suburb,
    city: row.city,
    postcode: row.postcode,
    country: row.country,
    church: row.church,
    denomination: row.denomination,
    faithBackground: row.faith_background,
    prayerFocus: row.prayer_focus,
    willingToHost: row.willing_to_host,
    willingToLead: row.willing_to_lead,
    meetingPreference: row.meeting_preference,
    privacy: row.privacy,
    ageVerified: !!row.age_verified_at,
    trustedLeader: !!row.trusted_leader_at,
    memberSince: row.created_at.toISOString(),
  };
}

export async function ensureBscProfile(): Promise<BscProfile> {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const viewer = await getBscViewer();
  if (!viewer) throw authRequiredError();

  const role: BscRole = adminEmails().has(viewer.email) ? "super_admin" : "user";
  const result = await pool.query<Parameters<typeof rowToProfile>[0]>(
    `
      insert into bsc_profiles (clerk_user_id, email, role, display_name, photo_url)
      values ($1, $2, $3, $4, $5)
      on conflict (clerk_user_id) do update
      set
        email = excluded.email,
        photo_url = coalesce(bsc_profiles.photo_url, excluded.photo_url),
        display_name = coalesce(bsc_profiles.display_name, excluded.display_name),
        updated_at = now()
      returning
        id::text, clerk_user_id, email::text, role, display_name, photo_url, bio,
        suburb, city, postcode, country, church, denomination, faith_background,
        prayer_focus, willing_to_host, willing_to_lead, meeting_preference,
        privacy, age_verified_at, trusted_leader_at, created_at
    `,
    [viewer.clerkUserId, viewer.email, role, viewer.name, viewer.imageUrl],
  );

  return rowToProfile(result.rows[0]);
}

export function assertCommunityReady(profile: BscProfile) {
  if (!profile.displayName?.trim()) throw profileGateError();
  if (!profile.ageVerified) throw ageGateError();
}

export async function getOptionalBscProfile() {
  const pool = getPostgresPool();
  if (!pool) return null;
  const viewer = await getBscViewer();
  if (!viewer) return null;

  try {
    return await ensureBscProfile();
  } catch {
    return null;
  }
}

export async function listBscGroups(filters: {
  query?: string;
  location?: string;
  meetingType?: string;
  day?: string;
  denomination?: string;
} = {}): Promise<BscGroup[]> {
  const pool = getPostgresPool();
  const viewer = await getOptionalBscProfile();
  if (!pool) return sampleGroups;

  const query = `%${filters.query?.trim() || ""}%`;
  const location = `%${filters.location?.trim() || ""}%`;
  const meetingType = filters.meetingType || "";
  const day = filters.day || "";
  const denomination = `%${filters.denomination?.trim() || ""}%`;

  try {
    const result = await pool.query<{
    id: string;
    slug: string;
    name: string;
    description: string;
    group_type: string;
    visibility: "public" | "private";
    meeting_type: "in_person" | "online" | "both";
    suburb: string | null;
    city: string | null;
    postcode: string | null;
    schedule: string | null;
    day_of_week: string | null;
    age_group: string | null;
    denomination: string | null;
    tags: string[];
    leader_name: string | null;
    member_count: string;
    pending_requests: string;
    viewer_membership: "leader" | "member" | null;
    viewer_pending: string;
    }>(
      `
      select
        group_row.id::text,
        group_row.slug,
        group_row.name,
        group_row.description,
        group_row.group_type,
        group_row.visibility,
        group_row.meeting_type,
        group_row.suburb,
        group_row.city,
        group_row.postcode,
        group_row.schedule,
        group_row.day_of_week,
        group_row.age_group,
        group_row.denomination,
        group_row.tags,
        leader.display_name as leader_name,
        count(distinct member.profile_id) as member_count,
        count(distinct request.id) filter (where request.status = 'pending') as pending_requests,
        viewer_member.role as viewer_membership,
        count(distinct viewer_request.id) filter (where viewer_request.status = 'pending') as viewer_pending
      from bsc_groups group_row
      left join bsc_profiles leader on leader.id = group_row.leader_profile_id
      left join bsc_group_members member on member.group_id = group_row.id
      left join bsc_group_join_requests request on request.group_id = group_row.id
      left join bsc_group_members viewer_member
        on viewer_member.group_id = group_row.id and viewer_member.profile_id = $1::uuid
      left join bsc_group_join_requests viewer_request
        on viewer_request.group_id = group_row.id and viewer_request.profile_id = $1::uuid
      where group_row.deleted_at is null
        and group_row.visibility = 'public'
        and ($2 = '%%' or group_row.name ilike $2 or group_row.description ilike $2 or $2 ilike any(group_row.tags))
        and ($3 = '%%' or group_row.suburb ilike $3 or group_row.city ilike $3 or group_row.postcode ilike $3)
        and ($4 = '' or group_row.meeting_type = $4 or group_row.meeting_type = 'both')
        and ($5 = '' or group_row.day_of_week = $5)
        and ($6 = '%%' or group_row.denomination ilike $6)
      group by group_row.id, leader.id, viewer_member.role
      order by group_row.created_at desc
      limit 80
    `,
    [viewer?.id ?? "00000000-0000-0000-0000-000000000000", query, location, meetingType, day, denomination],
    );

    return result.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      groupType: row.group_type,
      visibility: row.visibility,
      meetingType: row.meeting_type,
      suburb: row.suburb,
      city: row.city,
      postcode: row.postcode,
      schedule: row.schedule,
      dayOfWeek: row.day_of_week,
      ageGroup: row.age_group,
      denomination: row.denomination,
      tags: row.tags ?? [],
      leaderName: row.leader_name ?? "Group leader",
      memberCount: Number(row.member_count),
      pendingRequests: Number(row.pending_requests),
      viewerMembership: row.viewer_membership ?? (Number(row.viewer_pending) > 0 ? "pending" : null),
    }));
  } catch (error) {
    if (isDatabaseConnectivityError(error)) return sampleGroups;
    throw error;
  }
}

export async function getBscGroup(slug: string) {
  return (await listBscGroups({})).find((group) => group.slug === slug) ?? null;
}

export async function listBscPrayerPosts(): Promise<BscPrayerPost[]> {
  const pool = getPostgresPool();
  if (!pool) return samplePrayers;

  try {
    const result = await pool.query<{
    id: string;
    kind: "prayer" | "praise";
    title: string;
    content: string;
    author_name: string | null;
    group_name: string | null;
    prayed_count: string;
    comment_count: string;
    created_at: Date;
    }>(`
    select
      prayer.id::text,
      prayer.kind,
      prayer.title,
      prayer.content,
      case when author.privacy = 'private' then 'Private member' else coalesce(author.display_name, 'Member') end as author_name,
      group_row.name as group_name,
      count(distinct prayed.profile_id) as prayed_count,
      count(distinct comment.id) as comment_count,
      prayer.created_at
    from bsc_prayer_posts prayer
    left join bsc_profiles author on author.id = prayer.author_profile_id
    left join bsc_groups group_row on group_row.id = prayer.group_id
    left join bsc_prayer_prayed prayed on prayed.prayer_id = prayer.id
    left join bsc_comments comment on comment.parent_type = 'prayer' and comment.parent_id = prayer.id and comment.deleted_at is null
    where prayer.deleted_at is null and prayer.visibility = 'public'
    group by prayer.id, author.id, group_row.id
    order by prayer.created_at desc
    limit 60
    `);

    return result.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      content: row.content,
      authorName: row.author_name ?? "Member",
      groupName: row.group_name,
      prayedCount: Number(row.prayed_count),
      commentCount: Number(row.comment_count),
      createdAt: row.created_at.toISOString(),
    }));
  } catch (error) {
    if (isDatabaseConnectivityError(error)) return samplePrayers;
    throw error;
  }
}

export async function listBscTestimonies({ includePending = false } = {}): Promise<BscTestimony[]> {
  const pool = getPostgresPool();
  if (!pool) return sampleTestimonies;

  try {
    const result = await pool.query<{
    id: string;
    title: string;
    story: string;
    display_mode: string;
    status: "pending" | "approved" | "rejected";
    author_name: string | null;
    like_count: string;
    comment_count: string;
    created_at: Date;
    }>(
      `
      select
        testimony.id::text,
        testimony.title,
        testimony.story,
        testimony.display_mode,
        testimony.status,
        author.display_name as author_name,
        count(distinct likes.profile_id) as like_count,
        count(distinct comment.id) as comment_count,
        testimony.created_at
      from bsc_testimonies testimony
      left join bsc_profiles author on author.id = testimony.author_profile_id
      left join bsc_testimony_likes likes on likes.testimony_id = testimony.id
      left join bsc_comments comment on comment.parent_type = 'testimony' and comment.parent_id = testimony.id and comment.deleted_at is null
      where testimony.deleted_at is null
        and ($1::boolean or testimony.status = 'approved')
      group by testimony.id, author.id
      order by testimony.created_at desc
      limit 60
    `,
    [includePending],
    );

    return result.rows.map((row) => {
      const firstName = row.author_name?.split(" ")[0] ?? "Member";
      return {
        id: row.id,
        title: row.title,
        story: row.story,
        authorName:
          row.display_mode === "anonymous"
            ? "Anonymous"
            : row.display_mode === "first_name"
              ? firstName
              : row.author_name ?? "Member",
        status: row.status,
        likeCount: Number(row.like_count),
        commentCount: Number(row.comment_count),
        createdAt: row.created_at.toISOString(),
      };
    });
  } catch (error) {
    if (isDatabaseConnectivityError(error)) return sampleTestimonies;
    throw error;
  }
}

export async function listBscEvents(): Promise<BscEvent[]> {
  const pool = getPostgresPool();
  const viewer = await getOptionalBscProfile();
  if (!pool) return sampleEvents;

  try {
    const result = await pool.query<{
    id: string;
    title: string;
    description: string;
    starts_at: Date;
    location_name: string | null;
    online_link: string | null;
    group_name: string | null;
    visibility: "public" | "group";
    going_count: string;
    viewer_rsvp: "going" | "not_going" | null;
    }>(
      `
      select
        event.id::text,
        event.title,
        event.description,
        event.starts_at,
        event.location_name,
        event.online_link,
        group_row.name as group_name,
        event.visibility,
        count(distinct rsvp.profile_id) filter (where rsvp.status = 'going') as going_count,
        viewer_rsvp.status as viewer_rsvp
      from bsc_events event
      left join bsc_groups group_row on group_row.id = event.group_id
      left join bsc_event_rsvps rsvp on rsvp.event_id = event.id
      left join bsc_event_rsvps viewer_rsvp
        on viewer_rsvp.event_id = event.id and viewer_rsvp.profile_id = $1::uuid
      where event.deleted_at is null
        and event.starts_at >= now() - interval '1 day'
        and (
          event.visibility = 'public'
          or exists (
            select 1 from bsc_group_members member
            where member.group_id = event.group_id and member.profile_id = $1::uuid
          )
        )
      group by event.id, group_row.id, viewer_rsvp.status
      order by event.starts_at asc
      limit 80
    `,
    [viewer?.id ?? "00000000-0000-0000-0000-000000000000"],
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      startsAt: row.starts_at.toISOString(),
      locationName: row.location_name,
      onlineLink: row.online_link,
      groupName: row.group_name,
      visibility: row.visibility,
      goingCount: Number(row.going_count),
      viewerRsvp: row.viewer_rsvp,
    }));
  } catch (error) {
    if (isDatabaseConnectivityError(error)) return sampleEvents;
    throw error;
  }
}

export async function getBscDashboard() {
  const profile = await ensureBscProfile();
  const [groups, prayers, testimonies, events, notifications] = await Promise.all([
    listBscGroups({}),
    listBscPrayerPosts(),
    listBscTestimonies(),
    listBscEvents(),
    getBscNotifications(),
  ]);

  return {
    profile,
    groups: groups.filter((group) => group.viewerMembership === "member" || group.viewerMembership === "leader"),
    prayers: prayers.slice(0, 4),
    testimonies: testimonies.slice(0, 3),
    events: events.slice(0, 4),
    notifications,
  };
}

export async function getBscNotifications(): Promise<BscNotification[]> {
  const pool = getPostgresPool();
  if (!pool) return [];
  const profile = await ensureBscProfile();
  const result = await pool.query<{
    id: string;
    title: string;
    body: string;
    action_url: string | null;
    read_at: Date | null;
    created_at: Date;
  }>(
    `
      select id::text, title, body, action_url, read_at, created_at
      from bsc_notifications
      where profile_id = $1::uuid
        and expires_at > now()
      order by created_at desc
      limit 50
    `,
    [profile.id],
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    actionUrl: row.action_url,
    read: !!row.read_at,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function updateBscProfile(input: Partial<{
  displayName: string;
  bio: string;
  suburb: string;
  city: string;
  postcode: string;
  country: string;
  church: string;
  denomination: string;
  faithBackground: string;
  prayerFocus: string;
  willingToHost: boolean;
  willingToLead: boolean;
  meetingPreference: "in_person" | "online" | "both";
  privacy: "public" | "private";
  ageVerified: boolean;
}>) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const profile = await ensureBscProfile();
  const result = await pool.query<Parameters<typeof rowToProfile>[0]>(
    `
      update bsc_profiles
      set
        display_name = coalesce($2, display_name),
        bio = coalesce($3, bio),
        suburb = coalesce($4, suburb),
        city = coalesce($5, city),
        postcode = coalesce($6, postcode),
        country = coalesce($7, country),
        church = coalesce($8, church),
        denomination = coalesce($9, denomination),
        faith_background = coalesce($10, faith_background),
        prayer_focus = coalesce($11, prayer_focus),
        willing_to_host = coalesce($12, willing_to_host),
        willing_to_lead = coalesce($13, willing_to_lead),
        meeting_preference = coalesce($14, meeting_preference),
        privacy = coalesce($15, privacy),
        age_verified_at = case when $16::boolean then coalesce(age_verified_at, now()) else age_verified_at end,
        updated_at = now()
      where id = $1::uuid
      returning
        id::text, clerk_user_id, email::text, role, display_name, photo_url, bio,
        suburb, city, postcode, country, church, denomination, faith_background,
        prayer_focus, willing_to_host, willing_to_lead, meeting_preference,
        privacy, age_verified_at, trusted_leader_at, created_at
    `,
    [
      profile.id,
      input.displayName ?? null,
      input.bio ?? null,
      input.suburb ?? null,
      input.city ?? null,
      input.postcode ?? null,
      input.country ?? null,
      input.church ?? null,
      input.denomination ?? null,
      input.faithBackground ?? null,
      input.prayerFocus ?? null,
      typeof input.willingToHost === "boolean" ? input.willingToHost : null,
      typeof input.willingToLead === "boolean" ? input.willingToLead : null,
      input.meetingPreference ?? null,
      input.privacy ?? null,
      !!input.ageVerified,
    ],
  );
  return rowToProfile(result.rows[0]);
}

export async function createBscGroup(input: {
  name: string;
  description: string;
  meetingType: "in_person" | "online" | "both";
  visibility: "public" | "private";
  suburb: string;
  city: string;
  postcode: string;
  schedule: string;
  dayOfWeek: string;
  ageGroup: string;
  denomination: string;
  tags: string[];
}) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const profile = await ensureBscProfile();
  assertCommunityReady(profile);
  const slug = `${slugFromTitle(input.name)}-${Date.now().toString(36)}`;
  const inviteCode = Math.random().toString(36).slice(2, 10).toUpperCase();
  const result = await pool.query<{ id: string; slug: string }>(
    `
      insert into bsc_groups (
        leader_profile_id, name, slug, description, visibility, meeting_type,
        suburb, city, postcode, schedule, day_of_week, age_group, denomination,
        tags, invite_code
      )
      values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::text[], $15)
      returning id::text, slug
    `,
    [
      profile.id,
      input.name,
      slug,
      input.description,
      input.visibility,
      input.meetingType,
      input.suburb,
      input.city,
      input.postcode,
      input.schedule,
      input.dayOfWeek,
      input.ageGroup,
      input.denomination,
      input.tags,
      inviteCode,
    ],
  );
  await pool.query(
    `insert into bsc_group_members (group_id, profile_id, role) values ($1::uuid, $2::uuid, 'leader')`,
    [result.rows[0].id, profile.id],
  );
  return result.rows[0];
}

export async function requestJoinBscGroup(groupId: string, inviteCode?: string) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const profile = await ensureBscProfile();
  assertCommunityReady(profile);

  const groupResult = await pool.query<{ id: string; visibility: string; invite_code: string | null }>(
    `select id::text, visibility, invite_code from bsc_groups where id = $1::uuid and deleted_at is null`,
    [groupId],
  );
  const group = groupResult.rows[0];
  if (!group) throw new Error("Group not found.");

  if (group.visibility === "private" && group.invite_code !== inviteCode) {
    const error = new Error("A valid invite code is required.");
    error.name = "InviteCodeRequiredError";
    throw error;
  }

  if (group.visibility === "private") {
    await pool.query(
      `
        insert into bsc_group_members (group_id, profile_id)
        values ($1::uuid, $2::uuid)
        on conflict do nothing
      `,
      [group.id, profile.id],
    );
    return { status: "joined" };
  }

  await pool.query(
    `
      insert into bsc_group_join_requests (group_id, profile_id)
      values ($1::uuid, $2::uuid)
      on conflict (group_id, profile_id) do update set status = 'pending', created_at = now()
    `,
    [group.id, profile.id],
  );
  return { status: "pending" };
}

export async function createBscPrayer(input: {
  kind: "prayer" | "praise";
  title: string;
  content: string;
  groupId?: string;
}) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const profile = await ensureBscProfile();
  assertCommunityReady(profile);
  const visibility = input.groupId ? "group" : "public";
  const result = await pool.query<{ id: string }>(
    `
      insert into bsc_prayer_posts (author_profile_id, group_id, kind, title, content, visibility)
      values ($1::uuid, $2::uuid, $3, $4, $5, $6)
      returning id::text
    `,
    [profile.id, input.groupId ?? null, input.kind, input.title, input.content, visibility],
  );
  return result.rows[0];
}

export async function prayForBscPrayer(prayerId: string) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const profile = await ensureBscProfile();
  assertCommunityReady(profile);
  await pool.query(
    `
      insert into bsc_prayer_prayed (prayer_id, profile_id)
      values ($1::uuid, $2::uuid)
      on conflict do nothing
    `,
    [prayerId, profile.id],
  );
  return { prayed: true };
}

export async function createBscTestimony(input: {
  title: string;
  story: string;
  displayMode: "anonymous" | "first_name" | "full_name";
}) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const profile = await ensureBscProfile();
  assertCommunityReady(profile);
  const result = await pool.query<{ id: string }>(
    `
      insert into bsc_testimonies (author_profile_id, title, story, display_mode, status)
      values ($1::uuid, $2, $3, $4, 'pending')
      returning id::text
    `,
    [profile.id, input.title, input.story, input.displayMode],
  );
  return result.rows[0];
}

export async function createBscEvent(input: {
  title: string;
  description: string;
  startsAt: string;
  locationName?: string;
  onlineLink?: string;
  groupId?: string;
}) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const profile = await ensureBscProfile();
  assertCommunityReady(profile);
  const result = await pool.query<{ id: string }>(
    `
      insert into bsc_events (
        group_id, creator_profile_id, title, description, starts_at,
        location_name, online_link, visibility
      )
      values ($1::uuid, $2::uuid, $3, $4, $5::timestamptz, $6, $7, case when $1::uuid is null then 'public' else 'group' end)
      returning id::text
    `,
    [
      input.groupId ?? null,
      profile.id,
      input.title,
      input.description,
      input.startsAt,
      input.locationName ?? null,
      input.onlineLink ?? null,
    ],
  );
  return result.rows[0];
}

export async function rsvpBscEvent(eventId: string, status: "going" | "not_going") {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const profile = await ensureBscProfile();
  assertCommunityReady(profile);
  await pool.query(
    `
      insert into bsc_event_rsvps (event_id, profile_id, status)
      values ($1::uuid, $2::uuid, $3)
      on conflict (event_id, profile_id) do update
      set status = excluded.status, updated_at = now()
    `,
    [eventId, profile.id, status],
  );
  return { status };
}

export async function joinBscWaitlist(input: {
  suburb: string;
  city: string;
  postcode: string;
  radiusKm: number;
  availability: string[];
  willingToHost: boolean;
  willingToLead: boolean;
}) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const profile = await ensureBscProfile();
  assertCommunityReady(profile);
  const result = await pool.query<{ id: string }>(
    `
      insert into bsc_waitlist_entries (
        profile_id, suburb, city, postcode, radius_km, availability, willing_to_host, willing_to_lead
      )
      values ($1::uuid, $2, $3, $4, $5, $6::text[], $7, $8)
      returning id::text
    `,
    [
      profile.id,
      input.suburb,
      input.city,
      input.postcode,
      input.radiusKm,
      input.availability,
      input.willingToHost,
      input.willingToLead,
    ],
  );

  await pool.query(
    `
      with candidates as (
        select id
        from bsc_waitlist_entries
        where status = 'waiting'
          and lower(city) = lower($1)
          and lower(suburb) = lower($2)
        order by created_at asc
        limit 12
      ),
      created_match as (
        insert into bsc_waitlist_matches (suburb, city, postcode)
        select $2, $1, $3
        where (select count(*) from candidates) >= 3
        returning id
      )
      insert into bsc_waitlist_match_entries (match_id, waitlist_entry_id)
      select created_match.id, candidates.id
      from created_match, candidates
      on conflict do nothing
    `,
    [input.city, input.suburb, input.postcode],
  );

  return result.rows[0];
}

export async function moderateBscTestimony(testimonyId: string, status: "approved" | "rejected") {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const profile = await ensureBscProfile();
  if (!canModerate(profile.role)) {
    const error = new Error("Moderator access is required.");
    error.name = "ForbiddenError";
    throw error;
  }
  await pool.query(
    `update bsc_testimonies set status = $2, updated_at = now() where id = $1::uuid`,
    [testimonyId, status],
  );
  await pool.query(
    `
      insert into bsc_audit_logs (actor_profile_id, action, target_type, target_id, metadata)
      values ($1::uuid, $2, 'testimony', $3::uuid, $4::jsonb)
    `,
    [profile.id, `testimony_${status}`, testimonyId, JSON.stringify({ status })],
  );
  return { status };
}

export async function markBscNotificationsRead(ids: string[] | "all") {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const profile = await ensureBscProfile();
  if (ids === "all") {
    await pool.query(
      `update bsc_notifications set read_at = now() where profile_id = $1::uuid and read_at is null`,
      [profile.id],
    );
    return { marked: "all" };
  }
  await pool.query(
    `
      update bsc_notifications
      set read_at = now()
      where profile_id = $1::uuid and id = any($2::uuid[])
    `,
    [profile.id, ids],
  );
  return { marked: ids.length };
}

export async function clearBscNotifications() {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const profile = await ensureBscProfile();
  await pool.query(`delete from bsc_notifications where profile_id = $1::uuid`, [profile.id]);
  return { cleared: true };
}

export async function createBscUploadToken(input: {
  objectKey: string;
  acl: "public" | "private";
  maxBytes?: number;
}) {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const profile = await ensureBscProfile();
  const maxBytes = Math.min(Math.max(input.maxBytes ?? 10485760, 1), 10485760);
  const result = await pool.query<{ id: string; expires_at: Date }>(
    `
      insert into bsc_upload_tokens (profile_id, object_key, acl, max_bytes)
      values ($1::uuid, $2, $3, $4)
      returning id::text, expires_at
    `,
    [profile.id, input.objectKey, input.acl, maxBytes],
  );
  return {
    tokenId: result.rows[0].id,
    maxBytes,
    expiresAt: result.rows[0].expires_at.toISOString(),
  };
}

export async function deleteBscAccount() {
  const pool = getPostgresPool();
  if (!pool) throw databaseUnavailableError();
  const profile = await ensureBscProfile();
  await pool.query(
    `
      update bsc_profiles
      set deleted_at = now(), display_name = null, bio = null, photo_url = null, updated_at = now()
      where id = $1::uuid
    `,
    [profile.id],
  );
  return { deleted: true };
}

export async function getBscAdminStats(): Promise<BscAdminStats> {
  const pool = getPostgresPool();
  if (!pool) {
    return {
      users: 0,
      groups: sampleGroups.length,
      prayerPosts: samplePrayers.length,
      testimonies: sampleTestimonies.length,
      events: sampleEvents.length,
      reports: 0,
    };
  }
  const profile = await ensureBscProfile();
  if (!canModerate(profile.role)) {
    const error = new Error("Moderator access is required.");
    error.name = "ForbiddenError";
    throw error;
  }
  const [users, groups, prayers, testimonies, events, reports] = await Promise.all([
    pool.query<{ count: string }>(`select count(*) from bsc_profiles where deleted_at is null`),
    pool.query<{ count: string }>(`select count(*) from bsc_groups where deleted_at is null`),
    pool.query<{ count: string }>(`select count(*) from bsc_prayer_posts where deleted_at is null`),
    pool.query<{ count: string }>(`select count(*) from bsc_testimonies where deleted_at is null`),
    pool.query<{ count: string }>(`select count(*) from bsc_events where deleted_at is null`),
    pool.query<{ count: string }>(`select count(*) from bsc_reports where status in ('open', 'reviewing')`),
  ]);
  return {
    users: Number(users.rows[0]?.count ?? 0),
    groups: Number(groups.rows[0]?.count ?? 0),
    prayerPosts: Number(prayers.rows[0]?.count ?? 0),
    testimonies: Number(testimonies.rows[0]?.count ?? 0),
    events: Number(events.rows[0]?.count ?? 0),
    reports: Number(reports.rows[0]?.count ?? 0),
  };
}

export { appUrl };
