function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

export function projectCellToViewport({
  position,
  camera,
  viewportWidth,
  viewportHeight,
}) {
  const yaw = degreesToRadians(camera.yaw);
  const pitch = degreesToRadians(camera.pitch);

  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const yawX = position.x * cosYaw - position.z * sinYaw;
  const yawZ = position.x * sinYaw + position.z * cosYaw;

  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const rotatedY = position.y * cosPitch - yawZ * sinPitch;
  const rotatedZ = position.y * sinPitch + yawZ * cosPitch;

  const depth = camera.distance + rotatedZ;
  const safeDepth = Math.max(depth, 120);
  const perspective = camera.distance / safeDepth;
  const screenX = viewportWidth / 2 + yawX * perspective;
  const screenY = viewportHeight / 2 + rotatedY * perspective;
  const scale = Math.max(0.42, Math.min(1.65, perspective));
  const normalizedDepth = (rotatedZ + 300) / 600;
  const opacity = Math.max(0.38, Math.min(1, 1 - normalizedDepth * 0.35));

  return {
    screenX,
    screenY,
    scale,
    opacity,
    depth: rotatedZ,
    zIndex: Math.round(1000 - rotatedZ),
  };
}
