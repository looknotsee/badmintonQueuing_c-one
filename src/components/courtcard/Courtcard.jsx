import TeamBox from "../teambox/Teambox";
import { formatSeconds } from "../utils/Formatseconds";
import "./courtCard.css";

function CourtCard({
  court,
  activeMatches,
  players,
  currentTime,
  draggedMatchId,
  dragOverCourtId,
  matchQueueLength,
  onDragOver,
  onDragLeave,
  onDrop,
  onStartMatch,
  onEndMatch,
  onCancelMatch,
}) {
  const activeMatch = activeMatches.find(
    (match) => match.id === court.currentMatchId,
  );

  const elapsedSeconds = activeMatch
    ? Math.max(0, Math.floor((currentTime - activeMatch.startedAt) / 1000))
    : 0;

  const isOvertime = activeMatch && elapsedSeconds > 30 * 60;

  const isDropTarget =
    !activeMatch &&
    court.status === "available" &&
    dragOverCourtId === court.id;

  return (
    <article
      className={`court-card ${activeMatch ? "court-active" : ""} ${
        isDropTarget ? "court-drop-target" : ""
      } ${isOvertime ? "court-overtime" : ""}`}
      data-court-id={court.id}
      onDragOver={(event) => onDragOver(event, court)}
      onDragLeave={() => onDragLeave(court)}
      onDrop={(event) => onDrop(event, court)}
    >
      <h2>{court.name}</h2>

      <div className="court-content">
        {activeMatch ? (
          <>
            <TeamBox playerIds={activeMatch.teamOne} players={players} />
            <div className="vs-divider">
              <span>vs</span>
            </div>
            <TeamBox playerIds={activeMatch.teamTwo} players={players} />
          </>
        ) : (
          <div className="empty-court">
            <strong>Available</strong>
            <span>
              {draggedMatchId
                ? "Drop here to start this match."
                : "The next prepared match can start here."}
            </span>
          </div>
        )}
      </div>

      <div className="court-footer">
        {activeMatch ? (
          <div className="court-action-row">
            <div className="court-timer">{formatSeconds(elapsedSeconds)}</div>

            <button
              type="button"
              className="danger-button"
              onClick={() => onEndMatch(court.id)}
            >
              End Match
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => onCancelMatch(court.id)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="court-start-button"
            onClick={() => onStartMatch(court.id)}
            disabled={matchQueueLength === 0}
          >
            Start Next Match
          </button>
        )}
      </div>
    </article>
  );
}

export default CourtCard;