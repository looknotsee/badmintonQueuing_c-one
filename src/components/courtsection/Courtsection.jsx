import CourtCard from "../courtCard/CourtCard";
import "./courtSection.css";

function CourtSection({
  courts,
  activeMatches,
  players,
  currentTime,
  draggedMatchId,
  dragOverCourtId,
  matchQueueLength,
  onCourtDragOver,
  onCourtDragLeave,
  onCourtDrop,
  onStartMatch,
  onEndMatch,
  onCancelMatch,
}) {
  return (
    <section className="courts-section" aria-labelledby="courts-title">
      <h1 id="courts-title" className="visually-hidden">
        Courts
      </h1>

      <div className="court-grid">
        {courts.map((court) => (
          <CourtCard
            key={court.id}
            court={court}
            activeMatches={activeMatches}
            players={players}
            currentTime={currentTime}
            draggedMatchId={draggedMatchId}
            dragOverCourtId={dragOverCourtId}
            matchQueueLength={matchQueueLength}
            onDragOver={onCourtDragOver}
            onDragLeave={onCourtDragLeave}
            onDrop={onCourtDrop}
            onStartMatch={onStartMatch}
            onEndMatch={onEndMatch}
            onCancelMatch={onCancelMatch}
          />
        ))}
      </div>
    </section>
  );
}

export default CourtSection;