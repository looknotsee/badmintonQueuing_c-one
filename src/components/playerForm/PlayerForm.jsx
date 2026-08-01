import { useState, useEffect } from "react";
import "./playerform.css";
import {
  FaUserPlus,
  FaSearch,
  FaPlus,
} from "react-icons/fa";

export default function PlayerForm({
  onAddPlayer,
  existingPlayers = [],
  isDisabled = false
}) {
  const [name, setName] = useState("");
  const [skill, setSkill] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] =
    useState(null);
  const [showSuggestions, setShowSuggestions] =
    useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] =
  useState(0);
  const [error, setError] = useState("");

  const skillLevels = [
    "Unknown",
    "Beginner",
    "Intermediate",
    "Expert",
    "Guest",
  ];

  const normalizedName =
    name.trim().toLowerCase();

  const returningMatches =
    normalizedName && !selectedPlayerId
      ? existingPlayers.filter((player) =>
          player.name
            .toLowerCase()
            .includes(normalizedName),
        )
      : [];

  const visibleReturningMatches =
    returningMatches.slice(0, 5);

  function handleClear() {
    setName("");
    setSkill("");
    setSelectedPlayerId(null);
    setShowSuggestions(false);
    setError("");
    setActiveSuggestionIndex(0);
  }

  useEffect(() => {
  if (isDisabled) {
    handleClear();
  }
  }, [isDisabled]);

  function handleNameChange(event) {
    const nextName = event.target.value;

    /*
     * Editing a selected returning player's name
     * changes the entry back into a new typed player.
     */
    if (selectedPlayerId) {
      setSkill("");
    }

    setName(nextName);
    setSelectedPlayerId(null);
    setShowSuggestions(true);
    setError("");
    setActiveSuggestionIndex(0);
  }

  function handleSelectReturningPlayer(player) {
    setName(player.name);
    setSelectedPlayerId(player.id);
    setSkill(
      player.skillLevel || "Unknown",
    );
    setShowSuggestions(false);
    setError("");
    setActiveSuggestionIndex(0);
  }

  function handleNameKeyDown(event) {
  if (
    event.key === "ArrowDown" &&
    visibleReturningMatches.length > 0
  ) {
    event.preventDefault();
    setShowSuggestions(true);

    setActiveSuggestionIndex(
      (currentIndex) =>
        (currentIndex + 1) %
        visibleReturningMatches.length,
    );

    return;
  }

  if (
    event.key === "ArrowUp" &&
    visibleReturningMatches.length > 0
  ) {
    event.preventDefault();
    setShowSuggestions(true);

    setActiveSuggestionIndex(
      (currentIndex) =>
        (
          currentIndex -
          1 +
          visibleReturningMatches.length
        ) % visibleReturningMatches.length,
    );

    return;
  }

  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();

  /*
   * A returning player has already been selected:
   * the second Enter adds them to the pool.
   */
  if (selectedPlayerId) {
    handleAdd();
    return;
  }

  /*
   * First Enter selects the highlighted directory
   * suggestion instead of immediately adding it.
   */
  if (
    showSuggestions &&
    visibleReturningMatches.length > 0
  ) {
    const highlightedPlayer =
      visibleReturningMatches[
        activeSuggestionIndex
      ];

    if (highlightedPlayer) {
      handleSelectReturningPlayer(
        highlightedPlayer,
      );
    }

    return;
  }

  /*
   * There are no returning-player matches, so this
   * is treated as a new player.
   */
  handleAdd();
}

function handleFormKeyDown(event) {
  if (
    event.key !== "Enter" ||
    event.target.classList.contains(
      "search-input",
    )
  ) {
    return;
  }

  event.preventDefault();

  if (!isDisabled) {
    handleAdd();
  }
}

  async function handleAdd() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Player name is required.");
      return;
    }

    try {
      const playerWasAdded =
        await onAddPlayer?.({
          playerId: selectedPlayerId,
          name: trimmedName,
          skillLevel: skill || "Unknown",
        });

      if (!playerWasAdded) {
        return;
      }

      handleClear();
    } catch (addError) {
      setError(
        addError.message ||
          "Could not add the player.",
      );
    }
  }

  return (
    <div className="playerform-container">
      <div className="playerform-content">
        <div className="playerformHeader">
          <p>
            <FaUserPlus />
            Add player to queue
          </p>
        </div>

        <div 
          className="playerform-fields"
          onKeyDownCapture={handleFormKeyDown}
        >
          <p className="note">PLAYER NAME</p>

          <div className="search-wrapper">
            <div className="search">
              <input
                className="search-input"
                type="text"
                placeholder="Type a new or returning player's name..."
                value={name}
                autoComplete="off"
                disabled={isDisabled}
                onChange={handleNameChange}
                onFocus={() => {
                  setShowSuggestions(true)
                  setActiveSuggestionIndex(0)
                }}
                onBlur={() =>
                  setShowSuggestions(false)
                }
                onKeyDown={handleNameKeyDown}
              />

              <FaSearch className="search-icon" />
            </div>

            {showSuggestions &&
              returningMatches.length > 0 && (
                <ul className="search-results">
                  {visibleReturningMatches.map(
                    (player, playerIndex) => (
                      <li key={player.id}>
                        <button
                          type="button"
                          className={`search-result-item ${
                            playerIndex === activeSuggestionIndex
                              ? "search-result-item--active"
                              : ""
                          }`}
                          onMouseEnter={() =>
                            setActiveSuggestionIndex(playerIndex)
                          }
                          onMouseDown={(event) =>
                            event.preventDefault()
                          }
                          onClick={() =>
                            handleSelectReturningPlayer(
                              player,
                            )
                          }
                        >
                          <span>{player.name}</span>

                          <span className="search-result-skill">
                            {player.skillLevel}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
          </div>

          {selectedPlayerId && (
            <p className="returning-player-note">
              Returning player selected. Their saved
              skill level will be used.
            </p>
          )}

          <p className="note">SKILL LEVEL</p>

          <div className="skill-row">
            {skillLevels.map((level) => (
              <button
                key={level}
                type="button"
                disabled={
                  isDisabled ||
                  Boolean(selectedPlayerId)
                }
                aria-pressed={skill === level}
                className={`skill-btn skill-btn--${level} ${
                  skill === level
                    ? "skill-btn--active"
                    : ""
                }`}
                onClick={() =>
                  setSkill(level)
                }
              >
                {level}
              </button>
            ))}
          </div>

          {error && (
            <p className="form-error">
              {error}
            </p>
          )}

          <div className="action-row">
            <button
              className="add-btn"
              type="button"
              disabled={isDisabled}
              onClick={handleAdd}
            >
              <FaPlus />
              Add to Pool
            </button>

            <button
              className="clear-btn"
              type="button"
              onClick={handleClear}
              disabled={isDisabled}
            >
              Clear Name
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}