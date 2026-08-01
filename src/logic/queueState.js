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
  draftPlayers,
  startedAt = Date.now(),
) {
  const uniqueDraftPlayers = [
    ...new Map(
      (draftPlayers ?? [])
        .filter(
          (player) =>
            player?.id &&
            player?.name?.trim(),
        )
        .map((player) => [
          player.id,
          player,
        ]),
    ).values(),
  ];

  const sessionPlayers =
    uniqueDraftPlayers.map(
      (draftPlayer, index) => ({
        id: draftPlayer.id,
        name: draftPlayer.name.trim(),
        skillLevel:
          draftPlayer.skillLevel || "Unknown",

        /*
         * False means the profile is temporary and
         * should enter the directory only after the
         * player completes their first game.
         */
        isDirectoryPlayer:
          draftPlayer.isDirectoryPlayer === true,

        gamesPlayed: 0,
        totalTimePlayed: 0,
        status: "available",
        waitingSince: startedAt + index,
      }),
    );

  const sessionPlayerIds =
    sessionPlayers.map(
      (player) => player.id,
    );

  const freshCourts =
    sampleCourts.map((court) => ({
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