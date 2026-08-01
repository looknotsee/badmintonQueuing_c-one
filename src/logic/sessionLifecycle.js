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
    draftPlayers: [],
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
    draftPlayers: [],
    state: null,
    startedAt: null,
  };
}

export function addDraftPlayerToSession(
  currentSession,
  playerOrId,
) {
  requireSetupSession(currentSession);

  const draftPlayer =
    typeof playerOrId === "object"
      ? playerOrId
      : null;

  const playerId =
    typeof playerOrId === "string"
      ? playerOrId
      : draftPlayer?.id;

  if (!playerId) {
    throw new Error(
      "A valid player is required.",
    );
  }

  const existingDraftPlayers =
    currentSession.draftPlayers ?? [];

  const playerAlreadyExists =
    currentSession.draftPlayerIds.includes(
      playerId,
    ) ||
    existingDraftPlayers.some(
      (player) => player.id === playerId,
    );

  if (playerAlreadyExists) {
    return currentSession;
  }

  return {
    ...currentSession,

    draftPlayerIds: [
      ...currentSession.draftPlayerIds,
      playerId,
    ],

    /*
     * String IDs remain supported temporarily so the
     * current landing page does not break before the
     * next migration step.
     */
    draftPlayers: draftPlayer
      ? [
          ...existingDraftPlayers,
          draftPlayer,
        ]
      : existingDraftPlayers,
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

    draftPlayers:
      (currentSession.draftPlayers ?? [])
        .filter(
          (draftPlayer) =>
            draftPlayer.id !== playerId,
        ),
  };
}

export function startCurrentSession(
  currentSession,
  directoryPlayersOrStartedAt = [],
  explicitStartedAt = Date.now(),
) {
  requireSetupSession(currentSession);

  /*
   * This compatibility layer keeps the current
   * landing-page call working until the next step.
   */
  const directoryPlayers =
    Array.isArray(directoryPlayersOrStartedAt)
      ? directoryPlayersOrStartedAt
      : [];

  const startedAt =
    typeof directoryPlayersOrStartedAt === "number"
      ? directoryPlayersOrStartedAt
      : explicitStartedAt;

  let draftPlayers = [
    ...(currentSession.draftPlayers ?? []),
  ];

  /*
   * Support rosters created before draft_players was
   * connected to React.
   */
  if (
    draftPlayers.length === 0 &&
    directoryPlayers.length > 0
  ) {
    const directoryPlayerMap = new Map(
      directoryPlayers.map((player) => [
        player.id,
        player,
      ]),
    );

    draftPlayers =
      currentSession.draftPlayerIds
        .map((playerId) => {
          const directoryPlayer =
            directoryPlayerMap.get(playerId);

          if (!directoryPlayer) {
            return null;
          }

          return {
            id: directoryPlayer.id,
            name: directoryPlayer.name,
            skillLevel:
              directoryPlayer.skillLevel ||
              "Unknown",
            isDirectoryPlayer: true,
          };
        })
        .filter(Boolean);
  }

  const uniqueDraftPlayers = [
    ...new Map(
      draftPlayers.map((player) => [
        player.id,
        player,
      ]),
    ).values(),
  ];

  if (uniqueDraftPlayers.length < 4) {
    throw new Error(
      "Add at least four valid players before starting the session.",
    );
  }

  return {
    ...currentSession,
    status: SESSION_STATUS.ACTIVE,

    state: createFreshSessionQueueState(
      uniqueDraftPlayers,
      startedAt,
    ),

    draftPlayerIds: [],
    draftPlayers: [],

    startedAt:
      new Date(startedAt).toISOString(),
  };
}

export function endCurrentSession(currentSession) {
  return {
    ...currentSession,
    status: SESSION_STATUS.IDLE,
    sessionId: null,
    draftPlayerIds: [],
    draftPlayers: [],
    state: null,
    startedAt: null,
  };
}