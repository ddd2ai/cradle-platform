import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IncubatorControlBar } from "./IncubatorControlBar";
import { IncubatorDish } from "./IncubatorDish";
import { IncubatorStats } from "./IncubatorStats";
import { projectCellToViewport } from "../../features/incubator/utils/projectCellToViewport";
import { hasFilePayload, useIncubatorFeed } from "../../hooks/useIncubatorFeed";
import { useUiPreferences } from "../../i18n/UiPreferencesProvider";

const DEFAULT_CAMERA = {
  yaw: 0,
  pitch: 0,
  distance: 900,
};

const DEFAULT_VIEWPORT_SIZE = {
  width: 900,
  height: 560,
};

const MIN_DISTANCE = 420;
const MAX_DISTANCE = 1600;
const YAW_STEP = 12;
const DISTANCE_STEP = 80;
const MIN_PITCH = -35;
const MAX_PITCH = 35;
const DRAG_THRESHOLD = 4;
const CELL_SPHERE_RADIUS = 280;
const CELL_INSPECTOR_WIDTH = 380;
const MIN_OBSERVATION_WIDTH = 320;

export function IncubatorWorkspace({
  cells,
  selectedCellId,
  isLoading,
  error,
  isVisualMotionPaused,
  isCultivating,
  summary,
  dockMessage,
  dockError,
  onSelectCell,
  onClearSelectedCell,
  onRunOneCycle,
  onRetry,
  onCreateCell,
}) {
  const { t } = useUiPreferences();
  const viewportRef = useRef(null);
  const dragStateRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startYaw: 0,
    startPitch: 0,
    moved: false,
  });
  const suppressClickRef = useRef(false);
  const feedDragDepthRef = useRef(0);
  const [camera, setCamera] = useState(DEFAULT_CAMERA);
  const [viewportSize, setViewportSize] = useState(DEFAULT_VIEWPORT_SIZE);
  const [isDragging, setIsDragging] = useState(false);
  const [isFeedDragActive, setIsFeedDragActive] = useState(false);
  const {
    acceptedOperation,
    artifactTypes,
    artifactType,
    dismissOperation,
    feedError,
    feedFiles,
    feedMessage,
    isFeeding,
    setArtifactType,
  } = useIncubatorFeed();
  const isInspectorOpen = Boolean(selectedCellId);
  const inspectorWidth = isInspectorOpen ? CELL_INSPECTOR_WIDTH : 0;
  const usableViewportWidth = Math.max(
    viewportSize.width - inspectorWidth,
    MIN_OBSERVATION_WIDTH,
  );
  const observationCenterX = usableViewportWidth / 2;
  const spatialCells = useMemo(() => createSphericalLayout(cells), [cells]);
  const projectedCells = useMemo(
    () => spatialCells.map((cell, index) => ({
      cell,
      projection: projectCellToViewport({
        position: cell.position3d,
        camera,
        viewportWidth: usableViewportWidth,
        viewportHeight: viewportSize.height,
        centerX: observationCenterX,
      }),
      size: getProjectedCellSize({
        count: spatialCells.length,
        index,
        selected: cell.id === selectedCellId,
      }),
      primary: index === 0,
    })),
    [
      camera,
      observationCenterX,
      selectedCellId,
      spatialCells,
      usableViewportWidth,
      viewportSize.height,
    ],
  );

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return undefined;
    }

    function handleWheel(event) {
      event.preventDefault();
      const wheelStep = Math.min(160, Math.max(40, Math.abs(event.deltaY)));
      const direction = event.deltaY > 0 ? 1 : -1;

      setCamera((current) => ({
        ...current,
        distance: clampDistance(current.distance + direction * wheelStep),
      }));
    }

    viewport.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const moveCameraForward = useCallback(() => {
    setCamera((current) => ({
      ...current,
      distance: clampDistance(current.distance - DISTANCE_STEP),
    }));
  }, []);

  const moveCameraBackward = useCallback(() => {
    setCamera((current) => ({
      ...current,
      distance: clampDistance(current.distance + DISTANCE_STEP),
    }));
  }, []);

  const orbitLeft = useCallback(() => {
    setCamera((current) => ({
      ...current,
      yaw: current.yaw - YAW_STEP,
    }));
  }, []);

  const orbitRight = useCallback(() => {
    setCamera((current) => ({
      ...current,
      yaw: current.yaw + YAW_STEP,
    }));
  }, []);

  const resetCamera = useCallback(() => {
    setCamera(DEFAULT_CAMERA);
  }, []);

  const focusCellById = useCallback((cellId) => {
    const target = spatialCells.find((cell) => cell.id === cellId);

    if (!target) {
      return;
    }

    setCamera(getCameraForCellFocus(target.position3d));
  }, [spatialCells]);

  const focusSelectedCell = useCallback(() => {
    if (selectedCellId) {
      focusCellById(selectedCellId);
    }
  }, [focusCellById, selectedCellId]);

  function handleViewportPointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    if (event.target?.closest?.(".floating-cell")) {
      return;
    }

    viewportRef.current?.focus({ preventScroll: true });

    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startYaw: camera.yaw,
      startPitch: camera.pitch,
      moved: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }

  function handleViewportPointerMove(event) {
    const dragState = dragStateRef.current;

    if (!dragState.active || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD) {
      dragState.moved = true;
      suppressClickRef.current = true;
    }

    setCamera((current) => ({
      ...current,
      yaw: dragState.startYaw + deltaX * 0.22,
      pitch: clampPitch(dragState.startPitch - deltaY * 0.16),
    }));
  }

  function handleViewportPointerUp(event) {
    const dragState = dragStateRef.current;

    if (dragState.pointerId === event.pointerId) {
      dragStateRef.current = {
        ...dragState,
        active: false,
        pointerId: null,
      };
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsDragging(false);
  }

  function handleSelectCell(cellId) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    onSelectCell(cellId);
  }

  function handleFocusCell(cellId) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    onSelectCell(cellId);
    focusCellById(cellId);
  }

  function handleViewportClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    onClearSelectedCell();
  }

  function handleViewportKeyDown(event) {
    if (isInteractiveControl(event.target)) {
      return;
    }

    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        moveCameraForward();
        break;
      case "ArrowDown":
        event.preventDefault();
        moveCameraBackward();
        break;
      case "ArrowLeft":
        event.preventDefault();
        orbitLeft();
        break;
      case "ArrowRight":
        event.preventDefault();
        orbitRight();
        break;
      case "Escape":
        event.preventDefault();
        if (selectedCellId) {
          onClearSelectedCell();
        } else {
          resetCamera();
        }
        break;
      default:
        break;
    }
  }

  function handleFeedDragEnter(event) {
    if (!hasFilePayload(event.dataTransfer)) return;
    event.preventDefault();
    feedDragDepthRef.current += 1;
    if (!isFeeding) setIsFeedDragActive(true);
  }

  function handleFeedDragOver(event) {
    if (!hasFilePayload(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = isFeeding ? "none" : "copy";
  }

  function handleFeedDragLeave(event) {
    if (!hasFilePayload(event.dataTransfer)) return;
    event.preventDefault();
    feedDragDepthRef.current = Math.max(0, feedDragDepthRef.current - 1);
    if (feedDragDepthRef.current === 0) setIsFeedDragActive(false);
  }

  function handleFeedDrop(event) {
    if (!hasFilePayload(event.dataTransfer)) return;
    event.preventDefault();
    feedDragDepthRef.current = 0;
    setIsFeedDragActive(false);
    if (!isFeeding) feedFiles(event.dataTransfer.files);
  }

  return (
    <section
      className={`incubator-workspace${isFeedDragActive ? " incubator-workspace--feed-ready" : ""}`}
      data-feed-scope="cradle-auto-route"
      aria-label={t("incubator.feedingArea")}
      onDragEnter={handleFeedDragEnter}
      onDragOver={handleFeedDragOver}
      onDragLeave={handleFeedDragLeave}
      onDrop={handleFeedDrop}
    >
      <div className="incubator-drop-overlay" aria-hidden={!isFeedDragActive}>
        <div className="incubator-drop-overlay__message">
          <span aria-hidden="true">↓</span>
          <strong>{t("incubator.feedCradle")}</strong>
          <small>{t("incubator.dropDescription")}</small>
        </div>
      </div>
      <div className="incubator-stage">
        <div
          ref={viewportRef}
          className="incubator-stage__visual incubator-viewport"
          data-dragging={isDragging}
          tabIndex={0}
          onKeyDown={handleViewportKeyDown}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handleViewportPointerMove}
          onPointerUp={handleViewportPointerUp}
          onPointerCancel={handleViewportPointerUp}
          onClick={handleViewportClick}
          aria-label={t("incubator.viewport")}
        >
          <div className="incubator-stage__stats">
            <IncubatorStats summary={summary} />
          </div>

          <IncubatorDish
            projectedCells={projectedCells}
            selectedCellId={selectedCellId}
            isLoading={isLoading}
            error={error}
            isMotionPaused={isVisualMotionPaused}
            onSelectCell={handleSelectCell}
            onFocusCell={handleFocusCell}
            onRetry={onRetry}
            onCreateCell={onCreateCell}
          />
        </div>

        <div className="incubator-hint">
          <span aria-hidden="true">ⓘ</span>
          <span>{t("incubator.tip")}</span>
        </div>

        <IncubatorControlBar
          cells={cells}
          isCultivating={isCultivating}
          message={dockMessage}
          error={dockError}
          selectedCellId={selectedCellId}
          isInspectorOpen={isInspectorOpen}
          onRunOneCycle={onRunOneCycle}
          camera={camera}
          onOrbitLeft={orbitLeft}
          onMoveForward={moveCameraForward}
          onMoveBackward={moveCameraBackward}
          onOrbitRight={orbitRight}
          onFocusSelectedCell={focusSelectedCell}
          onResetCamera={resetCamera}
          acceptedOperation={acceptedOperation}
          artifactTypes={artifactTypes}
          artifactType={artifactType}
          feedError={feedError}
          feedMessage={feedMessage}
          isFeeding={isFeeding}
          onFeedFiles={feedFiles}
          onArtifactTypeChange={setArtifactType}
          onDismissFeedOperation={dismissOperation}
        />
      </div>
    </section>
  );
}

function createSphericalLayout(cells) {
  if (!cells.length) {
    return [];
  }

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  return cells.map((cell, index) => {
    if (index === 0) {
      return {
        ...cell,
        position3d: { x: 0, y: 0, z: 0 },
      };
    }

    const normalizedIndex = index - 1;
    const count = Math.max(cells.length - 1, 1);
    const y = 1 - (normalizedIndex / Math.max(count - 1, 1)) * 2;
    const horizontalRadius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * normalizedIndex;

    return {
      ...cell,
      position3d: {
        x: Math.cos(theta) * horizontalRadius * CELL_SPHERE_RADIUS,
        y: y * CELL_SPHERE_RADIUS * 0.72,
        z: Math.sin(theta) * horizontalRadius * CELL_SPHERE_RADIUS,
      },
    };
  });
}

function getProjectedCellSize({ count, index, selected }) {
  if (index === 0) {
    return 154;
  }

  if (selected) {
    return 126;
  }

  if (count > 28) {
    return 58;
  }

  if (count > 18) {
    return 66;
  }

  if (count > 10) {
    return 76;
  }

  return 92;
}

function clampDistance(value) {
  return Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, value));
}

function clampPitch(value) {
  return Math.min(MAX_PITCH, Math.max(MIN_PITCH, value));
}

function getCameraForCellFocus(position) {
  const yaw = -Math.atan2(position.x, position.z || 1) * (180 / Math.PI);
  const horizontalDistance = Math.sqrt(position.x * position.x + position.z * position.z);
  const pitch = Math.atan2(position.y, horizontalDistance || 1) * (180 / Math.PI);

  return {
    yaw,
    pitch: clampPitch(-pitch),
    distance: 560,
  };
}

function isInteractiveControl(target) {
  if (target?.closest?.("button, a, input, textarea, select")) {
    return true;
  }

  return (globalThis.HTMLInputElement && target instanceof globalThis.HTMLInputElement) ||
    (globalThis.HTMLTextAreaElement && target instanceof globalThis.HTMLTextAreaElement) ||
    (globalThis.HTMLSelectElement && target instanceof globalThis.HTMLSelectElement) ||
    target?.isContentEditable === true;
}
