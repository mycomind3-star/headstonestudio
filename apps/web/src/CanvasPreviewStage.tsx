import { type KeyboardEvent, type PointerEvent, useMemo, useRef } from "react";
import { type DesignDocument } from "@headstone/schema";
import { getCanvasElementDescriptors } from "./canvasModel";

interface CanvasPreviewStageProps {
  document: DesignDocument;
  previewSvg: string;
  selectedElementId: string | null;
  onSelectElement: (elementId: string) => void;
  onClearSelection: () => void;
  onMoveElement: (elementId: string, nextX: number, nextY: number) => void;
}

interface DragSession {
  elementId: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  scaleX: number;
  scaleY: number;
  pointerId: number;
}

const nudgeSteps: Record<DesignDocument["units"], { base: number; large: number }> = {
  in: { base: 0.125, large: 0.5 },
  mm: { base: 2.5, large: 10 },
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

export function CanvasPreviewStage({
  document,
  previewSvg,
  selectedElementId,
  onSelectElement,
  onClearSelection,
  onMoveElement,
}: CanvasPreviewStageProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const canvasElements = useMemo(() => getCanvasElementDescriptors(document), [document]);
  const selectedElement = canvasElements.find((element) => element.id === selectedElementId) ?? null;

  function updateElementPosition(elementId: string, nextX: number, nextY: number) {
    onMoveElement(elementId, nextX, nextY);
  }

  function clearDragSession() {
    dragSessionRef.current = null;
  }

  function handleCanvasPointerDown(event: PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | SVGElement | null;
    if (target instanceof SVGElement && target.getAttribute("data-canvas-hitbox") === "true") {
      return;
    }

    onClearSelection();
  }

  function beginDrag(
    event: PointerEvent<SVGRectElement>,
    element: (typeof canvasElements)[number],
  ) {
    event.stopPropagation();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect || canvasRect.width === 0 || canvasRect.height === 0) {
      onSelectElement(element.id);
      return;
    }

    onSelectElement(element.id);
    canvasRef.current?.focus({ preventScroll: true });
    dragSessionRef.current = {
      elementId: element.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: element.x,
      startY: element.y,
      scaleX: canvasRect.width / document.face.width,
      scaleY: canvasRect.height / document.face.height,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCanvasPointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragSession = dragSessionRef.current;
    if (!dragSession || dragSession.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const deltaX = (event.clientX - dragSession.startClientX) / dragSession.scaleX;
    const deltaY = (event.clientY - dragSession.startClientY) / dragSession.scaleY;
    updateElementPosition(dragSession.elementId, dragSession.startX + deltaX, dragSession.startY + deltaY);
  }

  function handleCanvasPointerUp(event: PointerEvent<HTMLDivElement>) {
    const dragSession = dragSessionRef.current;
    if (!dragSession || dragSession.pointerId !== event.pointerId) {
      return;
    }

    clearDragSession();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!selectedElement) {
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    const steps = nudgeSteps[document.units];
    const step = event.shiftKey ? steps.large : steps.base;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      updateElementPosition(selectedElement.id, selectedElement.x - step, selectedElement.y);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      updateElementPosition(selectedElement.id, selectedElement.x + step, selectedElement.y);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      updateElementPosition(selectedElement.id, selectedElement.x, selectedElement.y - step);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      updateElementPosition(selectedElement.id, selectedElement.x, selectedElement.y + step);
    }
  }

  return (
    <div
      ref={canvasRef}
      className="preview-canvas"
      tabIndex={0}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerCancel={handleCanvasPointerUp}
      onKeyDown={handleKeyDown}
      aria-label="Interactive memorial preview"
    >
      <div className="preview-svg" dangerouslySetInnerHTML={{ __html: previewSvg }} />
      <svg
        className="preview-interaction-overlay"
        viewBox={`0 0 ${document.face.width} ${document.face.height}`}
        aria-hidden="true"
        focusable="false"
        preserveAspectRatio="none"
      >
        {canvasElements.map((element) => {
          const isSelected = element.id === selectedElementId;
          const selectionStrokeClass = element.safeAreaWarning ? "canvas-selection-outline-warning" : "";
          return (
            <g key={element.id} transform={`rotate(${element.rotation_deg} ${element.x} ${element.y})`}>
              <rect
                data-canvas-hitbox="true"
                className="canvas-hitbox"
                x={element.bounds.x}
                y={element.bounds.y}
                width={element.bounds.width}
                height={element.bounds.height}
                rx="0.08"
                ry="0.08"
                onPointerDown={(event) => beginDrag(event, element)}
              />
              {isSelected ? (
                <>
                  <rect
                    className={`canvas-selection-outline ${selectionStrokeClass}`}
                    x={element.bounds.x}
                    y={element.bounds.y}
                    width={element.bounds.width}
                    height={element.bounds.height}
                    rx="0.08"
                    ry="0.08"
                    pointerEvents="none"
                  />
                  {[
                    { x: element.bounds.x, y: element.bounds.y },
                    { x: element.bounds.right, y: element.bounds.y },
                    { x: element.bounds.x, y: element.bounds.bottom },
                    { x: element.bounds.right, y: element.bounds.bottom },
                  ].map((handle, index) => (
                    <circle
                      key={`${element.id}-handle-${index}`}
                      className="canvas-selection-handle"
                      cx={handle.x}
                      cy={handle.y}
                      r="0.09"
                      pointerEvents="none"
                    />
                  ))}
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
