import {
  createFreshSessionQueueState,
} from "./queueState.js";

export const SESSION_STATUS = Object.freeze({
  IDLE: "idle",
  SETUP: "setup",
  ACTIVE: "active",
});

function requireSetupSession(currentSession) {
  if (currentSession.status !== SESSION_STATUS.SETUP) {
    throw new Error(
      "The session must be in setup before changing its roster.",
    );
  }
}

export function beginSessionSetup(currentSession) {
  if (currentSession.status === SESSION_STATUS.ACTIVE) {
    throw new Error(
      "An active session is already running.",
    );
  }

  /*
   * Do not erase an existing setup roster if the
   * button is pressed more than once.
   */
  if (currentSession.status === SESSION_STATUS.SETUP) {
    return currentSession;
  }

  return {
    ...currentSession,
    status: SESSION_STATUS.SETUP,
    sessionId: crypto.randomUUID(),
    draftPlayerIds: [],
    state: null,
    startedAt: null,
  };
}

export function cancelSessionSetup(currentSession) {
  if (currentSession.status !== SESSION_STATUS.SETUP) {
    throw new Error(
      "Only a session currently in setup can be cancelled.",
    );
  }

  return {
    ...currentSession,
    status: SESSION_STATUS.IDLE,
    sessionId: null,
    draftPlayerIds: [],
    state: null,
    startedAt: null,
  };
}

export function addDraftPlayerToSession(
  currentSession,
  playerId,
) {
  requireSetupSession(currentSession);

  if (!playerId) {
    throw new Error(
      "A valid player is required.",
    );
  }

  if (currentSession.draftPlayerIds.includes(playerId)) {
    return currentSession;
  }

  return {
    ...currentSession,
    draftPlayerIds: [
      ...currentSession.draftPlayerIds,
      playerId,
    ],
  };
}

export function removeDraftPlayerFromSession(
  currentSession,
  playerId,
) {
  requireSetupSession(currentSession);

  return {
    ...currentSession,
    draftPlayerIds:
      currentSession.draftPlayerIds.filter(
        (draftPlayerId) =>
          draftPlayerId !== playerId,
      ),
  };
}

export function startCurrentSession(
  currentSession,
  directoryPlayers,
  startedAt = Date.now(),
) {
  requireSetupSession(currentSession);

  const existingDirectoryPlayerIds = new Set(
    directoryPlayers.map((player) => player.id),
  );

  /*
   * Remove duplicate and stale directory IDs before
   * creating the active queue.
   */
  const validDraftPlayerIds = [
    ...new Set(currentSession.draftPlayerIds),
  ].filter((playerId) =>
    existingDirectoryPlayerIds.has(playerId),
  );

  if (validDraftPlayerIds.length < 4) {
    throw new Error(
      "Add at least four valid players before starting the session.",
    );
  }

  return {
    ...currentSession,
    status: SESSION_STATUS.ACTIVE,

    state: createFreshSessionQueueState(
      directoryPlayers,
      validDraftPlayerIds,
      startedAt,
    ),

    /*
     * Once active, the roster is already represented
     * inside state.players.
     */
    draftPlayerIds: [],

    startedAt: new Date(startedAt).toISOString(),
  };
}

export function endCurrentSession(currentSession) {
  return {
    ...currentSession,
    status: SESSION_STATUS.IDLE,
    sessionId: null,
    draftPlayerIds: [],
    state: null,
    startedAt: null,
  };
}