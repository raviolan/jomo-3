type HomeScrollListener = () => void;

const listeners = new Set<HomeScrollListener>();

export function requestHomeScrollToTop() {
  listeners.forEach((listener) => listener());
}

export function subscribeToHomeScrollToTop(listener: HomeScrollListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
