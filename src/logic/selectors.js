import { ImInsertTemplate } from "react-icons/im";
import { getMatchPlayerIds } from "./matchmaking";

export function getInGamePlayerCount(players) {
    return players.filter((player) => player.status === "inGame",).length;
}

export function getPreparedPlayerCount(matchQueue) {
    return matchQueue.reduce((total, match) => total + getMatchPlayerIds(match).length, 0,);
}

export function getPlayerLocation(
    playerId,
    courts,
    activeMatches,
    matchQueue,
    waitingPlayerIds
) {
    const activeMatch = activeMatches.find((match) => 
        getMatchPlayerIds(match).includes(playerId),
    );

    if (activeMatch) {
        const court = courts.find((item) => item.id === activeMatch.courtId);
        return court?.name ?? "Active court";
    }

    const queuedMatchIndex = matchQueue.findIndex((match) =>
        getMatchPlayerIds(match).includes(playerId,)
    );

    if (queuedMatchIndex >= 0) {
        return queuedMatchIndex === 0
            ? "Next match"
            : `Queue ${queuedMatchIndex + 1}`;
    }

    if (waitingPlayerIds.includes(playerId)) {
        return "Waiting pool";
    }

    return "Unassigned";
}   