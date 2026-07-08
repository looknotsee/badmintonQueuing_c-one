import TeamBox from "../teambox/Teambox";
import "./queueCard.css";

function QueueCard({
  match,
  index,
  players,
  matchQueueLength,
  draggedMatchId,
  dragOverQueueIndex,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onMoveMatch,
  onOpenEditor,
}) {
  return (
    <article
      className={`queue-card ${index === 0 ? "next-match-card" : ""} ${
        draggedMatchId === match.id ? "queue-card-dragging" : ""
      } ${
        dragOverQueueIndex === index &&
        draggedMatchId &&
        draggedMatchId !== match.id
          ? "queue-card-drag-over"
          : ""
      }`}
      draggable
      onDragStart={(event) => onDragStart(event, match.id)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver(event, index)}
      onDrop={(event) => onDrop(event, index)}
    >
      <header className="queue-card-header">
        <strong>
          <span className="drag-handle" aria-hidden="true">
            ⠿
          </span>{" "}
          {index === 0 ? "Next Match" : `Queue ${index + 1}`}
        </strong>

        <span>{match.id.split("-").slice(0, 2).join("-")}</span>
      </header>

      <TeamBox playerIds={match.teamOne} players={players} />
      <div className="vs-divider">
        <span>vs</span>
      </div>
      <TeamBox playerIds={match.teamTwo} players={players} />

      <div className="queue-controls">
        <div className="queue-control-buttons">
          <button
            type="button"
            className="move-up-button"
            onClick={() => onMoveMatch(match.id, -1)}
            disabled={index === 0}
          >
            Move Up
          </button>

          <button
            type="button"
            className="move-down-button"
            onClick={() => onMoveMatch(match.id, 1)}
            disabled={index === matchQueueLength - 1}
          >
            Move Down
          </button>
        </div>

        <button
          type="button"
          className="rebuild-button"
          onClick={() => onOpenEditor(match.id)}
        >
          Rebuild
        </button>
      </div>
    </article>
  );
}

export default QueueCard;