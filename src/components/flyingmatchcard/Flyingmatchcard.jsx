import { useEffect, useState } from "react";
import TeamBox from "../teambox/Teambox";
import "./flyingMatchCard.css";

function FlyingMatchCard({
  flyingMatch,
  players,
  onArrived,
}) {
  const [isSettled, setIsSettled] =
    useState(false);

  const {
    startRect,
    endRect,
    teamOne,
    teamTwo,
    matchId,
    courtName,
  } = flyingMatch;

  useEffect(() => {
    setIsSettled(false);

    let secondFrame;

    const firstFrame =
      requestAnimationFrame(() => {
        secondFrame =
          requestAnimationFrame(() => {
            setIsSettled(true);
          });
      });

    return () => {
      cancelAnimationFrame(firstFrame);

      if (secondFrame) {
        cancelAnimationFrame(secondFrame);
      }
    };
  }, [matchId]);

  /*
   * The element itself already has the FINAL court
   * dimensions and layout.
   *
   * We visually transform it backward so that it
   * initially occupies the queue card's rectangle.
   */
  const startTranslateX =
    startRect.left - endRect.left;

  const startTranslateY =
    startRect.top - endRect.top;

  const startScaleX =
    startRect.width / endRect.width;

  const startScaleY =
    startRect.height / endRect.height;

  const transform = isSettled
    ? "translate3d(0, 0, 0) scale(1, 1)"
    : `
      translate3d(
        ${startTranslateX}px,
        ${startTranslateY}px,
        0
      )
      scale(
        ${startScaleX},
        ${startScaleY}
      )
    `;

  function handleTransitionEnd(event) {
    if (
      isSettled &&
      event.propertyName === "transform"
    ) {
      onArrived();
    }
  }

  return (
    <article
      className="flying-match-card"
      style={{
        left: endRect.left,
        top: endRect.top,
        width: endRect.width,
        height: endRect.height,
        transform,
      }}
      onTransitionEnd={handleTransitionEnd}
      aria-hidden="true"
    >
      <h2>{courtName}</h2>

      <div className="flying-match-content">
        <TeamBox
          playerIds={teamOne}
          players={players}
        />

        <div className="vs-divider">
          <span>vs</span>
        </div>

        <TeamBox
          playerIds={teamTwo}
          players={players}
        />
      </div>

      <div className="flying-match-footer">
        <span>0:00</span>

        <div className="flying-match-button">
          End Match
        </div>

        <div className="flying-match-button secondary">
          Cancel
        </div>
      </div>
    </article>
  );
}

export default FlyingMatchCard;