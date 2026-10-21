'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

type Point = { x: number; y: number };
type Transform = Point & { scale: number };
type TrackedPointer = Point & { pointerType: string };
type SingleGesture = {
  kind: 'single';
  start: Point;
  origin: Transform;
  startedAt: number;
  moved: boolean;
};
type PinchGesture = {
  kind: 'pinch';
  distance: number;
  originScale: number;
  anchor: Point;
};
type Gesture = SingleGesture | PinchGesture | { kind: 'idle' };

type ImageZoomOptions = {
  mediaKey?: string;
  enabled?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.2;
const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Gestures belong to the image viewport; keep video and dialog controls outside it. */
export function useImageZoom({ mediaKey, enabled = true, onSwipeLeft, onSwipeRight }: ImageZoomOptions) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  // A separate stage lets an image and its watermark share the same transform.
  const transformRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef({ enabled, onSwipeLeft, onSwipeRight });
  optionsRef.current = { enabled, onSwipeLeft, onSwipeRight };
  const transform = useRef<Transform>({ ...IDENTITY });
  const pointers = useRef(new Map<number, TrackedPointer>());
  const gesture = useRef<Gesture>({ kind: 'idle' });
  const hadMultiplePointers = useRef(false);
  const zoomedDuringGesture = useRef(false);
  const lastTap = useRef<{ point: Point; at: number } | null>(null);
  const lastTouchAt = useRef(-Infinity);
  const lastMouseDragAt = useRef(-Infinity);
  const frame = useRef<number | null>(null);
  const wheelEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scalePublishedAt = useRef(0);
  const [scale, setScale] = useState(1);

  const paint = useCallback(() => {
    const target = transformRef.current ?? imageRef.current;
    const value = transform.current;
    if (target) target.style.transform = `translate3d(${value.x}px, ${value.y}px, 0) scale(${value.scale})`;
  }, []);

  const queuePaint = useCallback((publishImmediately = false) => {
    if (publishImmediately) {
      scalePublishedAt.current = performance.now();
      setScale(transform.current.scale);
    }
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      paint();
      // Gesture transforms stay outside React; controls still receive regular updates.
      if (performance.now() - scalePublishedAt.current >= 100) {
        scalePublishedAt.current = performance.now();
        setScale(transform.current.scale);
      }
    });
  }, [paint]);

  const bounded = useCallback((value: Transform): Transform => {
    const nextScale = clamp(value.scale, 1, MAX_SCALE);
    const viewport = viewportRef.current;
    const image = imageRef.current;
    if (nextScale <= 1.001 || !viewport || !image) return { ...IDENTITY };
    let width = image.offsetWidth;
    let height = image.offsetHeight;
    if (width <= 0 || height <= 0 || viewport.clientWidth <= 0 || viewport.clientHeight <= 0) return { ...IDENTITY };
    // A full-size object-contain element includes letterboxing in its element box.
    if (image.naturalWidth && image.naturalHeight && getComputedStyle(image).objectFit === 'contain') {
      const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      width = image.naturalWidth * ratio;
      height = image.naturalHeight * ratio;
    }
    const maxX = Math.max(0, (width * nextScale - viewport.clientWidth) / 2);
    const maxY = Math.max(0, (height * nextScale - viewport.clientHeight) / 2);
    return { scale: nextScale, x: clamp(value.x, -maxX, maxX), y: clamp(value.y, -maxY, maxY) };
  }, []);

  const update = useCallback((value: Transform, publishImmediately = false) => {
    transform.current = bounded(value);
    queuePaint(publishImmediately);
  }, [bounded, queuePaint]);

  const localPoint = useCallback((point: Point): Point => {
    const rect = viewportRef.current?.getBoundingClientRect();
    return rect ? { x: point.x - rect.left - rect.width / 2, y: point.y - rect.top - rect.height / 2 } : { x: 0, y: 0 };
  }, []);

  const reset = useCallback(() => {
    const viewport = viewportRef.current;
    // Clear first: releasePointerCapture can emit lostpointercapture synchronously.
    const pointerIds = [...pointers.current.keys()];
    pointers.current.clear();
    gesture.current = { kind: 'idle' };
    hadMultiplePointers.current = false;
    zoomedDuringGesture.current = false;
    lastTap.current = null;
    for (const id of pointerIds) {
      try { if (viewport?.hasPointerCapture(id)) viewport.releasePointerCapture(id); } catch { /* Already released. */ }
    }
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (wheelEndTimer.current !== null) clearTimeout(wheelEndTimer.current);
    wheelEndTimer.current = null;
    transform.current = { ...IDENTITY };
    paint();
    setScale(1);
  }, [paint]);

  const zoomAt = useCallback((nextScale: number, point: Point = { x: 0, y: 0 }, publishImmediately = true) => {
    if (!optionsRef.current.enabled) return;
    const current = transform.current;
    const targetScale = clamp(nextScale, 1, MAX_SCALE);
    const factor = targetScale / current.scale;
    update({ scale: targetScale, x: point.x - (point.x - current.x) * factor, y: point.y - (point.y - current.y) * factor }, publishImmediately);
    if (pointers.current.size) zoomedDuringGesture.current = true;
    lastTap.current = null;
  }, [update]);

  const beginSingle = useCallback((point: Point) => {
    gesture.current = { kind: 'single', start: { x: point.x, y: point.y }, origin: { ...transform.current }, startedAt: performance.now(), moved: false };
  }, []);

  const beginPinch = useCallback(() => {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b) return;
    const midpoint = localPoint({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const current = transform.current;
    gesture.current = {
      kind: 'pinch', distance: Math.max(1, distance(a, b)), originScale: current.scale,
      anchor: { x: (midpoint.x - current.x) / current.scale, y: (midpoint.y - current.y) / current.scale },
    };
    hadMultiplePointers.current = true;
    zoomedDuringGesture.current = true;
    lastTap.current = null;
  }, [localPoint]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!optionsRef.current.enabled || (event.pointerType !== 'touch' && event.button !== 0)) return;
    if (event.target instanceof Element && event.target.closest('button, a, input, textarea, select, video, [data-no-image-gesture]')) return;
    event.preventDefault();
    const point = { x: event.clientX, y: event.clientY, pointerType: event.pointerType };
    if (event.pointerType === 'touch') lastTouchAt.current = performance.now();
    if (pointers.current.size === 0) {
      hadMultiplePointers.current = false;
      zoomedDuringGesture.current = transform.current.scale > 1.001;
    }
    pointers.current.set(event.pointerId, point);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer may have ended. */ }
    if (pointers.current.size === 1) beginSingle(point);
    else beginPinch();
  }, [beginSingle, beginPinch]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!optionsRef.current.enabled || !pointers.current.has(event.pointerId)) return;
    event.preventDefault();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY, pointerType: event.pointerType });
    const active = gesture.current;
    if (active.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const midpoint = localPoint({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const nextScale = clamp(active.originScale * distance(a, b) / active.distance, 1, MAX_SCALE);
      update({ scale: nextScale, x: midpoint.x - active.anchor.x * nextScale, y: midpoint.y - active.anchor.y * nextScale });
    } else if (active.kind === 'single') {
      const dx = event.clientX - active.start.x;
      const dy = event.clientY - active.start.y;
      if (Math.hypot(dx, dy) > 8) {
        active.moved = true;
        lastTap.current = null;
        if (event.pointerType !== 'touch') lastMouseDragAt.current = performance.now();
      }
      if (active.origin.scale > 1.001) update({ ...active.origin, x: active.origin.x + dx, y: active.origin.y + dy });
    }
  }, [localPoint, update]);

  const finishPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!pointers.current.has(event.pointerId)) return;
    const active = gesture.current;
    const ending = pointers.current.get(event.pointerId)!;
    const point = { x: event.clientX, y: event.clientY };
    pointers.current.delete(event.pointerId);
    try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
    if (pointers.current.size >= 2) { beginPinch(); return; }
    if (pointers.current.size === 1) {
      beginSingle([...pointers.current.values()][0]);
      queuePaint(true);
      return;
    }
    gesture.current = { kind: 'idle' };
    queuePaint(true);
    if (cancelled || active.kind !== 'single' || hadMultiplePointers.current || !optionsRef.current.enabled) {
      lastTap.current = null;
      return;
    }
    const dx = point.x - active.start.x;
    const dy = point.y - active.start.y;
    const moved = active.moved || Math.hypot(dx, dy) > 8;
    if (!zoomedDuringGesture.current && transform.current.scale <= 1.001 && Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      lastTap.current = null;
      if (dx < 0) optionsRef.current.onSwipeLeft?.();
      else optionsRef.current.onSwipeRight?.();
      return;
    }
    if (ending.pointerType !== 'touch' || moved || performance.now() - active.startedAt > 350) {
      lastTap.current = null;
      return;
    }
    const now = performance.now();
    const previous = lastTap.current;
    if (previous && now - previous.at < 320 && distance(previous.point, point) < 32) {
      zoomAt(transform.current.scale > 1.001 ? 1 : DOUBLE_TAP_SCALE, localPoint(point));
    } else lastTap.current = { at: now, point };
  }, [beginPinch, beginSingle, localPoint, queuePaint, zoomAt]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => finishPointer(event, false), [finishPointer]);
  const onPointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => finishPointer(event, true), [finishPointer]);
  const onDoubleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!optionsRef.current.enabled || performance.now() - lastTouchAt.current < 750 || performance.now() - lastMouseDragAt.current < 400) return;
    event.preventDefault();
    zoomAt(transform.current.scale > 1.001 ? 1 : DOUBLE_TAP_SCALE, localPoint({ x: event.clientX, y: event.clientY }));
  }, [localPoint, zoomAt]);

  const onWheel = useCallback((event: WheelEvent) => {
    if (!optionsRef.current.enabled || !Number.isFinite(event.deltaY) || event.deltaY === 0 || pointers.current.size > 1) return;
    if (event.target instanceof Element && event.target.closest('button, a, input, textarea, select, video, [data-no-image-gesture]')) return;
    // A native non-passive listener prevents scrolling/zooming the page while
    // the wheel controls this image, including at its minimum/maximum scale.
    event.preventDefault();
    event.stopPropagation();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportRef.current?.clientHeight || 800 : 1;
    const delta = clamp(event.deltaY * unit, -120, 120);
    zoomAt(transform.current.scale * Math.exp(-delta * 0.002), localPoint({ x: event.clientX, y: event.clientY }), false);
    // Keep dragging continuous if the user rolls the wheel with the button held.
    if (gesture.current.kind === 'single') {
      const point = [...pointers.current.values()][0];
      if (point) gesture.current = { ...gesture.current, start: { x: point.x, y: point.y }, origin: { ...transform.current } };
    }
    if (wheelEndTimer.current !== null) clearTimeout(wheelEndTimer.current);
    wheelEndTimer.current = setTimeout(() => {
      wheelEndTimer.current = null;
      queuePaint(true);
    }, 120);
  }, [localPoint, queuePaint, zoomAt]);

  useEffect(() => {
    reset();
    const viewport = viewportRef.current;
    let width = viewport?.clientWidth ?? 0;
    let height = viewport?.clientHeight ?? 0;
    const observer = typeof ResizeObserver !== 'undefined' && viewport ? new ResizeObserver(() => {
      const nextWidth = viewport.clientWidth;
      const nextHeight = viewport.clientHeight;
      if (Math.abs(nextWidth - width) > 1 || Math.abs(nextHeight - height) > 1) {
        width = nextWidth;
        height = nextHeight;
        reset();
      }
    }) : null;
    if (viewport) observer?.observe(viewport);
    viewport?.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', reset);
    window.addEventListener('orientationchange', reset);
    return () => {
      observer?.disconnect();
      viewport?.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', reset);
      window.removeEventListener('orientationchange', reset);
      const pointerIds = [...pointers.current.keys()];
      pointers.current.clear();
      gesture.current = { kind: 'idle' };
      for (const id of pointerIds) {
        try { if (viewport?.hasPointerCapture(id)) viewport.releasePointerCapture(id); } catch { /* Already released. */ }
      }
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      if (wheelEndTimer.current !== null) clearTimeout(wheelEndTimer.current);
      wheelEndTimer.current = null;
    };
  }, [mediaKey, enabled, reset, onWheel]);

  const transformStyle = useMemo<CSSProperties>(() => ({
    transform: 'translate3d(0px, 0px, 0) scale(1)', transformOrigin: 'center center',
    transition: 'none', willChange: 'transform', userSelect: 'none',
  }), []);
  const viewportStyle: CSSProperties = {
    touchAction: enabled ? 'none' : undefined,
    overscrollBehavior: enabled ? 'contain' : undefined,
    userSelect: enabled ? 'none' : undefined,
    cursor: enabled ? (scale > 1.001 ? 'grab' : 'zoom-in') : undefined,
  };
  const zoomIn = useCallback(() => zoomAt(transform.current.scale + 0.5), [zoomAt]);
  const zoomOut = useCallback(() => zoomAt(transform.current.scale - 0.5), [zoomAt]);

  return {
    scale, viewportRef, imageRef, transformRef,
    viewportProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture: onPointerCancel, onDoubleClick, style: viewportStyle },
    transformStyle, onImageLoad: reset,
    zoomIn, zoomOut, reset,
  };
}
