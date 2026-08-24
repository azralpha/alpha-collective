import { GripVertical, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import "./DraggableSupportBubble.css";

type Position = { left: number; top: number };
type DragStart = { offsetX: number; offsetY: number; originX: number; originY: number };
type TawkApi = { hideWidget?: () => void; maximize?: () => void; showWidget?: () => void; toggle?: () => void };

const STORAGE_KEY = "alpha-collective-support-bubble-position";
const EDGE_GAP = 14;
const MOBILE_NAV_CLEARANCE = 78;

function loadPosition(): Position | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const position = JSON.parse(raw) as Partial<Position>;
    return typeof position.left === "number" && typeof position.top === "number" ? { left: position.left, top: position.top } : null;
  } catch {
    return null;
  }
}

export default function DraggableSupportBubble() {
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const dragStartRef = useRef<DragStart | null>(null);
  const suppressClickRef = useRef(false);
  const [position, setPosition] = useState<Position | null>(loadPosition);
  const [isDragging, setIsDragging] = useState(false);

  const constrainPosition = useCallback((left: number, top: number) => {
    const bubble = bubbleRef.current;
    const width = bubble?.offsetWidth ?? 148;
    const height = bubble?.offsetHeight ?? 52;
    return {
      left: Math.min(Math.max(EDGE_GAP, left), Math.max(EDGE_GAP, window.innerWidth - width - EDGE_GAP)),
      top: Math.min(Math.max(EDGE_GAP, top), Math.max(EDGE_GAP, window.innerHeight - height - MOBILE_NAV_CLEARANCE)),
    };
  }, []);

  const moveTo = useCallback((clientX: number, clientY: number) => {
    const dragStart = dragStartRef.current;
    if (!dragStart) return;
    if (Math.abs(clientX - dragStart.originX) > 4 || Math.abs(clientY - dragStart.originY) > 4) suppressClickRef.current = true;
    setPosition(constrainPosition(clientX - dragStart.offsetX, clientY - dragStart.offsetY));
  }, [constrainPosition]);

  const finishDrag = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
    setPosition(current => {
      if (!current) return current;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      } catch {
        // The support button remains movable even when storage is unavailable.
      }
      return current;
    });
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (event: MouseEvent) => moveTo(event.clientX, event.clientY);
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      event.preventDefault();
      moveTo(touch.clientX, touch.clientY);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", finishDrag);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", finishDrag);
    window.addEventListener("touchcancel", finishDrag);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", finishDrag);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", finishDrag);
      window.removeEventListener("touchcancel", finishDrag);
    };
  }, [finishDrag, isDragging, moveTo]);

  useEffect(() => {
    const reposition = () => setPosition(current => current ? constrainPosition(current.left, current.top) : current);
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [constrainPosition]);

  useEffect(() => {
    let attempts = 0;
    const hideNativeLauncher = () => {
      const api = (window as Window & { Tawk_API?: TawkApi }).Tawk_API;
      if (api?.hideWidget) api.hideWidget();
      attempts += 1;
      if (attempts >= 20) window.clearInterval(timer);
    };
    const timer = window.setInterval(hideNativeLauncher, 400);
    hideNativeLauncher();
    return () => window.clearInterval(timer);
  }, []);

  const startDrag = (clientX: number, clientY: number) => {
    const rect = bubbleRef.current?.getBoundingClientRect();
    if (!rect) return;
    suppressClickRef.current = false;
    dragStartRef.current = { offsetX: clientX - rect.left, offsetY: clientY - rect.top, originX: clientX, originY: clientY };
    setPosition({ left: rect.left, top: rect.top });
    setIsDragging(true);
  };

  const openChat = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const api = (window as Window & { Tawk_API?: TawkApi }).Tawk_API;
    if (api?.maximize) {
      api.maximize();
      return;
    }
    if (api?.toggle) {
      api.toggle();
      return;
    }
    toast.info("Customer support chat is still loading. Please try again in a moment.");
  };

  return (
    <button
      ref={bubbleRef}
      type="button"
      className={`draggable-support-bubble ${isDragging ? "is-dragging" : ""}`}
      style={position ? { left: position.left, top: position.top, right: "auto", bottom: "auto" } : undefined}
      onMouseDown={event => { if (event.button === 0) startDrag(event.clientX, event.clientY); }}
      onTouchStart={event => { const touch = event.touches[0]; if (touch) startDrag(touch.clientX, touch.clientY); }}
      onClick={openChat}
      aria-label="Open customer support chat. Drag to move it away from checkout controls."
      title="Customer support — drag to move"
    >
      <GripVertical aria-hidden="true" size={16} />
      <MessageCircle aria-hidden="true" size={18} />
      <span>Support</span>
    </button>
  );
}
