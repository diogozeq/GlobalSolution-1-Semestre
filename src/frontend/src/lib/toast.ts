export type ToastKind = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(toasts);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export function toast(message: string, kind: ToastKind = "info"): void {
  const item: ToastItem = { id: nextId++, message, kind };
  toasts = [...toasts, item];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== item.id);
    emit();
  }, 3800);
}
