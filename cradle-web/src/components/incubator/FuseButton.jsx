import { DockAction } from "./DockAction";

export function FuseButton({ onClick }) {
  return (
    <DockAction
      icon="⌘"
      label="Fuse"
      title="Fuse is coming soon"
      onClick={onClick}
    />
  );
}
