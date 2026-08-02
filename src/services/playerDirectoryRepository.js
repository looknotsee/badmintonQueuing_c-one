import { supabase } from "../lib/supabaseClient.js";

const PLAYER_DIRECTORY_COLUMNS = `
  id,
  name,
  skill_level,
  created_at,
  updated_at
`;

function mapPlayerDirectoryRow(row) {
  return {
    id: row.id,
    name: row.name,
    skillLevel: row.skill_level,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getDirectoryErrorMessage(error, fallbackMessage) {
  // PostgreSQL unique-constraint violation.
  if (error?.code === "23505") {
    return "A player with that name already exists.";
  }

  return `${fallbackMessage}: ${error.message}`;
}

export async function fetchPlayerDirectory() {
  const { data, error } = await supabase
    .from("player_directory")
    .select(PLAYER_DIRECTORY_COLUMNS)
    .order("name", { ascending: true });

  if (error) {
    console.error(
      "Could not fetch the player directory.",
      error,
    );

    throw new Error(
      getDirectoryErrorMessage(
        error,
        "Could not fetch the player directory",
      ),
    );
  }

  return (data ?? []).map(mapPlayerDirectoryRow);
}

export async function createDirectoryPlayer({
  name,
  skillLevel,
}) {
  const trimmedName = name.trim();

  const { data, error } = await supabase
    .from("player_directory")
    .insert({
      name: trimmedName,
      skill_level: skillLevel || "Guest",
    })
    .select(PLAYER_DIRECTORY_COLUMNS)
    .single();

  if (error) {
    console.error(
      "Could not create the directory player.",
      error,
    );

    throw new Error(
      getDirectoryErrorMessage(
        error,
        "Could not create the directory player",
      ),
    );
  }

  return mapPlayerDirectoryRow(data);
}

export async function createDirectoryPlayerWithId({
  id,
  name,
  skillLevel,
}) {
  const trimmedName = name.trim();

  if (!id) {
    throw new Error(
      "A player ID is required when promoting a session player.",
    );
  }

  const { data, error } = await supabase
    .from("player_directory")
    .insert({
      id,
      name: trimmedName,
      skill_level: skillLevel || "Guest",
    })
    .select(PLAYER_DIRECTORY_COLUMNS)
    .single();

  if (!error) {
    return mapPlayerDirectoryRow(data);
  }

  /*
   * Another connected queue screen may already have
   * promoted this same player after the match ended.
   */
  if (error.code === "23505") {
    const {
      data: existingPlayer,
      error: existingPlayerError,
    } = await supabase
      .from("player_directory")
      .select(PLAYER_DIRECTORY_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (existingPlayerError) {
      console.error(
        "Could not verify the promoted directory player.",
        existingPlayerError,
      );

      throw new Error(
        `Could not verify the promoted directory player: ${existingPlayerError.message}`,
      );
    }

    if (existingPlayer) {
      return mapPlayerDirectoryRow(existingPlayer);
    }
  }

  console.error(
    "Could not promote the session player to the directory.",
    error,
  );

  throw new Error(
    getDirectoryErrorMessage(
      error,
      "Could not promote the session player to the directory",
    ),
  );
}

export async function updateDirectoryPlayer(
  playerId,
  {
    name,
    skillLevel,
  },
) {
  const trimmedName = name.trim();

  const { data, error } = await supabase
    .from("player_directory")
    .update({
      name: trimmedName,
      skill_level: skillLevel || "Guest",
      updated_at: new Date().toISOString(),
    })
    .eq("id", playerId)
    .select(PLAYER_DIRECTORY_COLUMNS)
    .single();

  if (error) {
    console.error(
      "Could not update the directory player.",
      error,
    );

    throw new Error(
      getDirectoryErrorMessage(
        error,
        "Could not update the directory player",
      ),
    );
  }

  return mapPlayerDirectoryRow(data);
}

export async function deleteDirectoryPlayer(playerId) {
  const { error } = await supabase
    .from("player_directory")
    .delete()
    .eq("id", playerId);

  if (error) {
    console.error(
      "Could not delete the directory player.",
      error,
    );

    throw new Error(
      getDirectoryErrorMessage(
        error,
        "Could not delete the directory player",
      ),
    );
  }
}

export function subscribeToPlayerDirectory(
  onDirectoryChange,
) {
  const channel = supabase
    .channel("player-directory")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "player_directory",
      },
      (payload) => {
        const changedRow =
          payload.eventType === "DELETE"
            ? payload.old
            : payload.new;

        onDirectoryChange({
          eventType: payload.eventType,
          player: changedRow
            ? mapPlayerDirectoryRow(changedRow)
            : null,
        });
      },
    )
    .subscribe((status, error) => {
      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        console.error(
          "Player-directory Realtime subscription failed.",
          status,
          error,
        );
      }
    });

  return function unsubscribeFromPlayerDirectory() {
    supabase.removeChannel(channel);
  };
}