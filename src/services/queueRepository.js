import { supabase } from "../lib/supabaseClient.js";

const MAIN_QUEUE_ID = "main";

export async function fetchQueueState() {
  const { data, error } = await supabase
    .from("queue_state")
    .select("state_json, version, updated_at")
    .eq("id", MAIN_QUEUE_ID)
    .maybeSingle();

  if (error) {
    console.error("Could not fetch the queue state.", error);

    throw new Error(
      `Could not fetch the queue state: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  return {
    state: data.state_json,
    version: data.version,
    updatedAt: data.updated_at,
  };
}

export async function createQueueState(initialState) {
  const { data, error } = await supabase
    .from("queue_state")
    .insert({
      id: MAIN_QUEUE_ID,
      state_json: initialState,
      version: 1,
    })
    .select("state_json, version, updated_at")
    .single();

  if (error) {
    console.error("Could not create the queue state.", error);

    throw new Error(
      `Could not create the queue state: ${error.message}`,
    );
  }

  return {
    state: data.state_json,
    version: data.version,
    updatedAt: data.updated_at,
  };
}

export async function updateQueueState(
  nextState,
  expectedVersion,
) {
  const nextVersion = expectedVersion + 1;

  const { data, error } = await supabase
    .from("queue_state")
    .update({
      state_json: nextState,
      version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", MAIN_QUEUE_ID)
    .eq("version", expectedVersion)
    .select("state_json, version, updated_at")
    .maybeSingle();

  if (error) {
    console.error("Could not update the queue state.", error);

    throw new Error(
      `Could not update the queue state: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      "The queue was changed on another device. Reload the latest state.",
    );
  }

  return {
    state: data.state_json,
    version: data.version,
    updatedAt: data.updated_at,
  };
}

export async function initializeQueueState(initialState) {
  const existingQueue = await fetchQueueState();

  if (existingQueue) {
    return existingQueue;
  }

  try {
    return await createQueueState(initialState);
  } catch (error) {
    /*
     * Another browser may have created the row
     * between our fetch and insert.
     */
    const newlyCreatedQueue = await fetchQueueState();

    if (newlyCreatedQueue) {
      return newlyCreatedQueue;
    }

    throw error;
  }
}

export function subscribeToQueueState(onQueueChange) {
  const channel = supabase
    .channel("main-queue-state")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "queue_state",
        filter: `id=eq.${MAIN_QUEUE_ID}`,
      },
      (payload) => {
        const updatedRow = payload.new;

        if (!updatedRow?.state_json) {
          return;
        }

        onQueueChange({
          state: updatedRow.state_json,
          version: Number(updatedRow.version),
          updatedAt: updatedRow.updated_at,
        });
      },
    )
    .subscribe((status, error) => {
      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        console.error(
          "Queue Realtime subscription failed.",
          status,
          error,
        );
      }
    });

  return function unsubscribeFromQueueState() {
    supabase.removeChannel(channel);
  };
}