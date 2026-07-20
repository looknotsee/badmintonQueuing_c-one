import "./registerModal.css";

function RegisterModal({
  isOpen,
  onClose,
  registrationForm,
  setRegistrationForm,
  registerPlayer,
  statusMessage,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-title"
      >
        <div className="management-heading">
          <div>
            <p className="management-kicker">Player entry</p>
            <h1 id="register-title">Register a player</h1>

            <p>
              New players enter the waiting pool with zero games and zero
              recorded playtime.
            </p>
          </div>

          <button
            type="button"
            className="match-editor-close"
            onClick={onClose}
            aria-label="Close registration"
          >
            ×
          </button>
        </div>

        <form
          className="registration-form"
          onSubmit={registerPlayer}
        >
          <div className="form-field">
            <label htmlFor="player-name">Player name</label>

            <input
              id="player-name"
              type="text"
              value={registrationForm.name}
              onChange={(event) =>
                setRegistrationForm((currentForm) => ({
                  ...currentForm,
                  name: event.target.value,
                }))
              }
              placeholder="Example: Cruz, A."
              autoComplete="off"
            />
          </div>

          <div className="form-field">
            <label htmlFor="player-skill">Skill level</label>

            <select
              id="player-skill"
              value={registrationForm.skillLevel}
              onChange={(event) =>
                setRegistrationForm((currentForm) => ({
                  ...currentForm,
                  skillLevel: event.target.value,
                }))
              }
            >
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Expert">Expert</option>
              <option value="Unknown">Unknown</option>
            </select>
          </div>

          <button
            type="submit"
            className="primary-management-button"
          >
            Register and Queue Player
          </button>
        </form>

        <div className="management-status" role="status">
          {statusMessage}
        </div>
      </section>
    </div>
  );
}

export default RegisterModal;