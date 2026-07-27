import { DockAction } from "./DockAction";

export function DivideButton({ disabled, isRunning, title, onClick }) {
  return (
    <DockAction
      icon="⌯"
      label={isRunning ? "Dividing..." : "Divide"}
      disabled={disabled}
      title={title}
      onClick={onClick}
    />
  );
}
