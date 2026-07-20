import { fillPreparedMatchQueue } from "./matchmaking";

export function moveQueuedMatchState(currentState, matchId, direction) {
  const currentIndex = currentState.matchQueue.findIndex(
    (match) => match.id === matchId,
  );

  const destinationIndex = currentIndex + direction;

  if (
    currentIndex === -1 ||
    destinationIndex < 0 ||
    destinationIndex >= currentState.matchQueue.length
  ) {
    return currentState;
  }

  const reorderedQueue = [...currentState.matchQueue];
  const [movedMatch] = reorderedQueue.splice(currentIndex, 1);

  reorderedQueue.splice(destinationIndex, 0, movedMatch);

  return {
    ...currentState,
    matchQueue: reorderedQueue,
    statusMessage: "The prepared match order was updated.",
  };
}

export function reorderQueuedMatchState(
  currentState,
  matchId,
  destinationIndex,
) {
  const currentIndex = currentState.matchQueue.findIndex(
    (match) => match.id === matchId,
  );

  if (currentIndex === -1) {
    return currentState;
  }

  const reorderedQueue = [...currentState.matchQueue];
  const [movedMatch] = reorderedQueue.splice(currentIndex, 1);

  let adjustedDestination =
    currentIndex < destinationIndex
      ? destinationIndex - 1
      : destinationIndex;

  adjustedDestination = Math.max(
    0,
    Math.min(adjustedDestination, reorderedQueue.length),
  );

  reorderedQueue.splice(adjustedDestination, 0, movedMatch);

  return {
    ...currentState,
    matchQueue: reorderedQueue,
    statusMessage: "The prepared match order was updated by drag and drop.",
  };
}

export function prepareMoreMatchesState(currentState) {
  const updatedState = fillPreparedMatchQueue(currentState);

  const noMatchWasAdded =
    updatedState.matchQueue.length === currentState.matchQueue.length;

  if (noMatchWasAdded) {
    return {
      ...updatedState,
      statusMessage:
        "No additional match could be prepared. " +
        "At least four unassigned waiting players are required.",
    };
  }

  return {
    ...updatedState,
    statusMessage: "The prepared match queue was refilled.",
  };
}