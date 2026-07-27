import { DockAction } from "./DockAction";

export function DivideButton({ onClick }) {
  return (
    <DockAction
      icon="⌯"
      label="Divide"
      title="Divide is coming soon"
      onClick={onClick}
    />
  );
}
