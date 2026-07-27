import { useEffect, useRef } from "react";

export function DockMenu({
  id,
  icon,
  label,
  items,
  isOpen,
  onToggle,
  onClose,
}) {
  const menuRef = useRef(null);
  const wasOpenRef = useRef(isOpen);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      menuRef.current
        ?.querySelector("button:not(:disabled)")
        ?.focus({ preventScroll: true });
    }

    wasOpenRef.current = isOpen;
  }, [isOpen]);

  function handleKeyDown(event) {
    if (!isOpen && ["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      onToggle();
      return;
    }

    if (!isOpen) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    const buttons = Array.from(
      menuRef.current?.querySelectorAll("button:not(:disabled)") ?? [],
    );
    const currentIndex = buttons.indexOf(document.activeElement);
    let nextIndex = null;

    if (event.key === "ArrowDown") {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % buttons.length;
    } else if (event.key === "ArrowUp") {
      nextIndex = currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = buttons.length - 1;
    }

    if (nextIndex !== null && buttons.length > 0) {
      event.preventDefault();
      buttons[nextIndex].focus();
    }
  }

  return (
    <div className={`cradle-dock-menu${isOpen ? " is-open" : ""}`} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className="cradle-dock-item"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        onClick={onToggle}
      >
        <span className="cradle-dock-item__icon" aria-hidden="true">{icon}</span>
        <span>{label}</span>
        <span className="cradle-dock-item__chevron" aria-hidden="true">⌃</span>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          id={`${id}-menu`}
          className="cradle-dock-popover"
          role="menu"
          aria-label={label}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.title}
              onClick={() => {
                item.onSelect?.();
                onClose();
              }}
            >
              <span>{item.label}</span>
              {item.meta && <small>{item.meta}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
