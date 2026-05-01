import type { SupabaseClient } from "@supabase/supabase-js";
import type { BreakEntry, HourBankMovement, TimeEntry } from "@/domain/time/types";

export type UserProfile = {
  id: string;
  displayName: string | null;
  lastLoginAt?: string;
  lastSeenAt?: string;
};

export type TimeTrackingSnapshot = {
  entries: TimeEntry[];
  breaks: BreakEntry[];
  movements: HourBankMovement[];
};

export async function upsertUserProfile(
  supabase: SupabaseClient,
  profile: UserProfile,
) {
  const { error } = await supabase.from("profiles").upsert({
    id: profile.id,
    display_name: profile.displayName,
    last_login_at: profile.lastLoginAt,
    last_seen_at: profile.lastSeenAt,
  });

  if (error) throw error;
}

export async function loadUserTimeTrackingSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<TimeTrackingSnapshot> {
  const [entriesResult, breaksResult, movementsResult] = await Promise.all([
    supabase
      .from("time_entries")
      .select("id,user_id,occurred_at,type,note,is_modified,modified_at")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: true }),
    supabase
      .from("break_entries")
      .select(
        "id,user_id,work_date,category,starts_at,ends_at,deducts_from_work,note,is_modified,modified_at",
      )
      .eq("user_id", userId)
      .order("starts_at", { ascending: true }),
    supabase
      .from("hour_bank_movements")
      .select("id,movement_date,source,minutes_delta,description")
      .eq("user_id", userId)
      .order("movement_date", { ascending: false }),
  ]);

  if (entriesResult.error) throw entriesResult.error;
  if (breaksResult.error) throw breaksResult.error;
  if (movementsResult.error) throw movementsResult.error;

  return {
    entries:
      entriesResult.data?.map((entry) => ({
        id: entry.id,
        userId: entry.user_id,
        occurredAt: entry.occurred_at,
        type: entry.type as TimeEntry["type"],
        note: entry.note ?? undefined,
        isModified: entry.is_modified,
        modifiedAt: entry.modified_at ?? undefined,
      })) ?? [],
    breaks:
      breaksResult.data?.map((entry) => ({
        id: entry.id,
        userId: entry.user_id,
        date: entry.work_date,
        category: entry.category as BreakEntry["category"],
        startsAt: entry.starts_at,
        endsAt: entry.ends_at ?? undefined,
        deductsFromWork: entry.deducts_from_work,
        note: entry.note ?? undefined,
        isModified: entry.is_modified,
        modifiedAt: entry.modified_at ?? undefined,
      })) ?? [],
    movements:
      movementsResult.data?.map((movement) => ({
        id: movement.id,
        date: movement.movement_date,
        source: movement.source as HourBankMovement["source"],
        minutesDelta: movement.minutes_delta,
        description: movement.description,
      })) ?? [],
  };
}

export async function createTimeEntry(
  supabase: SupabaseClient,
  entry: Omit<TimeEntry, "id">,
) {
  const { error } = await supabase.from("time_entries").insert({
    user_id: entry.userId,
    occurred_at: entry.occurredAt,
    type: entry.type,
    note: entry.note ?? null,
  });

  if (error) throw error;
}

export async function updateTimeEntry(
  supabase: SupabaseClient,
  entry: Pick<TimeEntry, "id" | "userId" | "occurredAt" | "type" | "note">,
) {
  const { error } = await supabase
    .from("time_entries")
    .update({
      occurred_at: entry.occurredAt,
      type: entry.type,
      note: entry.note ?? null,
      is_modified: true,
      modified_at: new Date().toISOString(),
    })
    .eq("id", entry.id)
    .eq("user_id", entry.userId);

  if (error) throw error;
}

export async function createBreakEntry(
  supabase: SupabaseClient,
  entry: Omit<BreakEntry, "id">,
) {
  const { error } = await supabase.from("break_entries").insert({
    user_id: entry.userId,
    work_date: entry.date,
    category: entry.category,
    starts_at: entry.startsAt,
    ends_at: entry.endsAt ?? null,
    deducts_from_work: entry.deductsFromWork,
    note: entry.note ?? null,
  });

  if (error) throw error;
}

export async function updateBreakEntry(
  supabase: SupabaseClient,
  entry: Pick<
    BreakEntry,
    | "id"
    | "userId"
    | "date"
    | "category"
    | "startsAt"
    | "endsAt"
    | "deductsFromWork"
    | "note"
  >,
) {
  const { error } = await supabase
    .from("break_entries")
    .update({
      work_date: entry.date,
      category: entry.category,
      starts_at: entry.startsAt,
      ends_at: entry.endsAt ?? null,
      deducts_from_work: entry.deductsFromWork,
      note: entry.note ?? null,
      is_modified: true,
      modified_at: new Date().toISOString(),
    })
    .eq("id", entry.id)
    .eq("user_id", entry.userId);

  if (error) throw error;
}
