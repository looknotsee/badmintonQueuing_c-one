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