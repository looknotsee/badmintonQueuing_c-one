import { useEffect, useState } from "react";
import TeamBox from "../teambox/Teambox";
import "./flyingMatchCard.css";

/**
 * Renders a fixed-position clone of a queued match that visually
 * slides from its position in the queue grid to the court it was
 * started on, then fades out once it "arrives".
 *
 * `flyingMatch` shape:
 * {
 *   matchId, teamOne, teamTwo,
 *   startRect: DOMRect (queue card position),
 *   endRect: DOMRect (court card position),
 * }
 */
function FlyingMatchCard({ flyingMatch, players, onArrived }) {
  const [hasArrived, setHasArrived] = useState(false);

  const { startRect, endRect, teamOne, teamTwo, matchId } = flyingMatch;

  useEffect(() => {
    setHasArrived(false);

    // Paint once at the starting position first, then move to the
    // court on the next frame so the transition actually animates.
    const firstFrame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setHasArrived(true));
    });

    return () => cancelAnimationFrame(firstFrame);
  }, [matchId]);

  const startCenterX = startRect.left + startRect.width / 2;
  const startCenterY = startRect.top + startRect.height / 2;
  const endCenterX = endRect.left + endRect.width / 2;
  const endCenterY = endRect.top + endRect.height / 2;

  const deltaX = endCenterX - startCenterX;
  const deltaY = endCenterY - startCenterY;

  const transform = hasArrived
    ? `translate(${deltaX}px, ${deltaY}px) scale(0.82)`
    : "translate(0px, 0px) scale(1)";

  function handleTransitionEnd(event) {
    // The opacity transition is the last one to finish (it has a
    // delay so it kicks in near the end of the move); only clear
    // the ghost once that fade-out actually completes.
    if (event.propertyName === "opacity") {
      onArrived();
    }
  }

  return (
    <div
      className={`flying-match-card ${hasArrived ? "flying-match-card-arriving" : ""}`}
      style={{
        left: startRect.left,
        top: startRect.top,
        width: startRect.width,
        transform,
      }}
      onTransitionEnd={handleTransitionEnd}
      aria-hidden="true"
    >
      <TeamBox playerIds={teamOne} players={players} />
      <div className="vs-divider">
        <span>vs</span>
      </div>
      <TeamBox playerIds={teamTwo} players={players} />
    </div>
  );
}

export default FlyingMatchCard;