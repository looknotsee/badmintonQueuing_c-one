import QueueCard from "../queuecard/Queuecard";
import "./queueSection.css"

const MAX_PREPARED_MATCHES = 4;

function QueueSection({
  matchQueue,
  players,
  statusMessage,
  totalPlayers,
  waitingPlayerCount,
  preparedPlayerCount,
  inGamePlayerCount,
  completedMatchCount,
  draggedMatchId,
  dragOverQueueIndex,
  flyingMatchId,
  onQueueDragStart,
  onQueueDragEnd,
  onQueueCardDragOver,
  onQueueCardDrop,
  onMoveMatch,
  onOpenEditor,
}) {
  return (
    <section className="queue-section" aria-labelledby="queue-title">
      <div className="queue-heading">
        <div>
          <h2 id="queue-title">Match Queue</h2>
          <p>{statusMessage}</p>
        </div>

        <div className="queue-summary">
          <span>
            Total <strong>{totalPlayers}</strong>
          </span>
          <span>
            Waiting pool <strong>{waitingPlayerCount}</strong>
          </span>
          <span>
            Prepared <strong>{preparedPlayerCount}</strong>
          </span>
          <span>
            In game <strong>{inGamePlayerCount}</strong>
          </span>
          <span>
            Completed <strong>{completedMatchCount}</strong>
          </span>
        </div>
      </div>

      {matchQueue.length === 0 ? (
        <div className="empty-queue">
          No match is prepared. At least four waiting players are required.
        </div>
      ) : (
        <div className="queue-grid">
          {matchQueue.slice(0, MAX_PREPARED_MATCHES).map((match, index) => (
            <QueueCard
              key={match.id}
              match={match}
              index={index}
              players={players}
              matchQueueLength={matchQueue.length}
              draggedMatchId={draggedMatchId}
              dragOverQueueIndex={dragOverQueueIndex}
              isLaunching={match.id === flyingMatchId}
              onDragStart={onQueueDragStart}
              onDragEnd={onQueueDragEnd}
              onDragOver={onQueueCardDragOver}
              onDrop={onQueueCardDrop}
              onMoveMatch={onMoveMatch}
              onOpenEditor={onOpenEditor}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default QueueSection;