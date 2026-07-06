type ScrollToTopListener = () => void;

const listeners = new Set<ScrollToTopListener>();

export function requestScrollToTop() {
  listeners.forEach((listener) => listener());
}

export function subscribeToScrollToTop(listener: ScrollToTopListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
