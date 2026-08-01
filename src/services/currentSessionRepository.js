import { supabase } from "../lib/supabaseClient.js";

const CURRENT_SESSION_ID = "current";

function mapCurrentSessionRow(row) {
  return {
    status: row.status,
    sessionId: row.session_id,
    draftPlayerIds: row.draft_player_ids ?? [],
    draftPlayers: row.draft_players ?? [],
    state: row.state_json,
    version: Number(row.version),
    startedAt: row.started_at,
    lastActivityAt: row.last_activity_at,
  };
}

export async function fetchCurrentSession() {
  const { data, error } = await supabase
    .from("current_session")
    .select(
      `
        status,
        session_id,
        draft_player_ids,
        draft_players,
        state_json,
        version,
        started_at,
        last_activity_at
      `,
    )
    .eq("id", CURRENT_SESSION_ID)
    .single();

  if (error) {
    console.error(
      "Could not fetch the current session.",
      error,
    );

    throw new Error(
      `Could not fetch the current session: ${error.message}`,
    );
  }

  return mapCurrentSessionRow(data);
}

export async function updateCurrentSession(
  nextSession,
  expectedVersion,
) {
  const nextVersion = expectedVersion + 1;

  const { data, error } = await supabase
    .from("current_session")
    .update({
      status: nextSession.status,
      session_id: nextSession.sessionId,
      draft_player_ids:
        nextSession.draftPlayerIds ?? [],
      draft_players:
        nextSession.draftPlayers ?? [],
      state_json: nextSession.state ?? null,
      version: nextVersion,
      started_at: nextSession.startedAt ?? null,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", CURRENT_SESSION_ID)
    .eq("version", expectedVersion)
    .select(
      `
        status,
        session_id,
        draft_player_ids,
        draft_players,
        state_json,
        version,
        started_at,
        last_activity_at
      `,
    )
    .maybeSingle();

  if (error) {
    console.error(
      "Could not update the current session.",
      error,
    );

    throw new Error(
      `Could not update the current session: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      "The session changed on another device. Reload the latest session.",
    );
  }

  return mapCurrentSessionRow(data);
}

export function subscribeToCurrentSession(
  onSessionChange,
) {
  const channel = supabase
    .channel("current-session")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "current_session",
        filter: `id=eq.${CURRENT_SESSION_ID}`,
      },
      (payload) => {
        if (!payload.new) {
          return;
        }

        onSessionChange(
          mapCurrentSessionRow(payload.new),
        );
      },
    )
    .subscribe((status, error) => {
      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        console.error(
          "Current-session Realtime subscription failed.",
          status,
          error,
        );
      }
    });

  return function unsubscribeFromCurrentSession() {
    supabase.removeChannel(channel);
  };
}