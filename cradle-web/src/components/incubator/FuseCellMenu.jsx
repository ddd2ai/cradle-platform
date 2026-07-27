import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { mapCellToVisualState } from "../../domain/cellVisualMapper";

export function FuseCellMenu({
  anchorRef,
  isOpen,
  selectedCellId,
  cells,
  selectedCellIds,
  onToggleCell,
  onCancel,
  onContinue,
  onClose,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (
        !menuRef.current?.contains(event.target) &&
        !anchorRef.current?.contains(event.target)
      ) {
        onClose();
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    const frame = window.requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector("input:not(:disabled)")
        ?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  const otherCells = cells.filter((cell) => cell.id !== selectedCellId);
  const anchorRect = anchorRef.current?.getBoundingClientRect();
  const style = anchorRect
    ? {
        left: Math.min(
          Math.max(12, anchorRect.left + anchorRect.width / 2 - 180),
          Math.max(12, window.innerWidth - 372),
        ),
        bottom: Math.max(12, window.innerHeight - anchorRect.top + 12),
      }
    : {};

  return createPortal(
    <section
      ref={menuRef}
      className="fuse-cell-menu"
      style={style}
      role="dialog"
      aria-modal="false"
      aria-labelledby="fuse-cell-menu-title"
    >
      <div className="fuse-cell-menu__header">
        <div>
          <h3 id="fuse-cell-menu-title">Fuse with other Cells</h3>
          <p>
            Selected Cell <strong>{selectedCellId}</strong>
          </p>
        </div>
        <button
          type="button"
          className="fuse-cell-menu__close"
          onClick={onClose}
          aria-label="Close Fuse menu"
        >
          ×
        </button>
      </div>

      <div className="fuse-cell-menu__list">
        {otherCells.map((cell, index) => {
          const visual = mapCellToVisualState(cell, index);
          const checked = selectedCellIds.includes(cell.id);

          return (
            <label
              key={cell.id}
              className={`fuse-cell-option${checked ? " is-selected" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleCell(cell.id)}
              />
              <img src={visual.textureSrc} alt="" aria-hidden="true" />
              <span>
                <strong>{cell.id}</strong>
                <small>{formatStatus(cell.status)}</small>
              </span>
            </label>
          );
        })}
      </div>

      <div className="fuse-cell-menu__footer">
        <span>{selectedCellIds.length} selected</span>
        <div>
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onContinue}
            disabled={selectedCellIds.length === 0}
          >
            Fuse Selected
          </button>
        </div>
      </div>
    </section>,
    document.body,
  );
}

function formatStatus(status) {
  const value = String(status ?? "unknown");
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
