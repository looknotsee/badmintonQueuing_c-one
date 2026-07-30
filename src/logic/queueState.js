import { sampleCourts, samplePlayers } from "../data/sampleData";
import { fillPreparedMatchQueue } from "./matchmaking";

export const STORAGE_KEY = "badminton-central-loop-v1";

export function createInitialState() {
  const currentTime = Date.now();

  const playersWithWaitingTimes = samplePlayers.map((player, index) => ({
    ...player,
    status: "available",

    waitingSince: currentTime - (samplePlayers.length - index) * 1000,
  }));

  const initialState = {
    players: playersWithWaitingTimes,
    courts: sampleCourts,
    waitingPlayerIds: playersWithWaitingTimes.map((player) => player.id),
    matchQueue: [],
    activeMatches: [],
    completedMatches: [],
    statusMessage: "The first four matches have been prepared.",
  };

  return fillPreparedMatchQueue(initialState);
}

export function createFreshSessionQueueState(
  directoryPlayers,
  draftPlayerIds,
  startedAt = Date.now(),
) {
  const directoryPlayerMap = new Map(
    directoryPlayers.map((player) => [
      player.id,
      player,
    ]),
  );

  /*
   * Remove duplicate roster IDs while preserving
   * the order in which players were added.
   */
  const uniqueDraftPlayerIds = [
    ...new Set(draftPlayerIds),
  ];

  const sessionPlayers = uniqueDraftPlayerIds
    .map((playerId, index) => {
      const directoryPlayer =
        directoryPlayerMap.get(playerId);

      /*
       * Ignore stale roster IDs whose directory
       * player no longer exists.
       */
      if (!directoryPlayer) {
        return null;
      }

      return {
        id: directoryPlayer.id,
        name: directoryPlayer.name,
        skillLevel:
          directoryPlayer.skillLevel || "Unknown",

        gamesPlayed: 0,
        totalTimePlayed: 0,
        status: "available",

        /*
         * Preserve roster order for players whose
         * game and playtime totals are still tied.
         */
        waitingSince: startedAt + index,
      };
    })
    .filter(Boolean);

  const sessionPlayerIds = sessionPlayers.map(
    (player) => player.id,
  );

  const freshCourts = sampleCourts.map((court) => ({
    ...court,
    status: "available",
    currentMatchId: null,
  }));

  const freshSessionState = {
    players: sessionPlayers,
    courts: freshCourts,
    waitingPlayerIds: sessionPlayerIds,
    matchQueue: [],
    activeMatches: [],
    completedMatches: [],
    statusMessage:
      "The session started and the first matches were prepared.",
  };

  return fillPreparedMatchQueue(
    freshSessionState,
  );
}

export function loadInitialState() {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);

    if (savedState) {
        const parsedState = JSON.parse(savedState);

        return fillPreparedMatchQueue(parsedState);
    }
  } catch (error) {
    console.error("Could not load the saved badminton state.", error);
  }

  return createInitialState();
}