import { DockAction } from "./DockAction";

export function StabilizeButton({ onClick }) {
  return (
    <DockAction
      icon="♢"
      label="Stabilize"
      title="Stabilize is coming soon"
      onClick={onClick}
    />
  );
}
