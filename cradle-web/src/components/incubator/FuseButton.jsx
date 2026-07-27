import { useRef } from "react";
import { DockAction } from "./DockAction";
import { FuseCellMenu } from "./FuseCellMenu";

export function FuseButton({
  cells,
  selectedCellId,
  selectedCellIds,
  disabled,
  isRunning,
  isOpen,
  title,
  onToggle,
  onToggleCell,
  onCancel,
  onContinue,
  onClose,
}) {
  const buttonRef = useRef(null);

  return (
    <>
      <DockAction
        icon="⌘"
        label={isRunning ? "Fusing..." : "Fuse"}
        disabled={disabled}
        title={title}
        onClick={onToggle}
        buttonRef={buttonRef}
      />
      <FuseCellMenu
        anchorRef={buttonRef}
        isOpen={isOpen}
        selectedCellId={selectedCellId}
        cells={cells}
        selectedCellIds={selectedCellIds}
        onToggleCell={onToggleCell}
        onCancel={onCancel}
        onContinue={onContinue}
        onClose={onClose}
      />
    </>
  );
}
