import { DockAction } from "./DockAction";

export function StabilizeButton({ disabled, isRunning, title, onClick }) {
  return (
    <DockAction
      icon="♢"
      label={isRunning ? "Stabilizing..." : "Stabilize"}
      disabled={disabled}
      title={title}
      onClick={onClick}
    />
  );
}
