const state = { route: location.pathname, user: null, connected: navigator.onLine, subscribers: new Set() };
export const store = {
  get: () => state,
  set(patch) {
    Object.assign(state, patch && typeof patch === 'object' ? patch : {});
    state.subscribers.forEach(fn => { try { fn(state); } catch (error) { console.error('Store subscriber failed', error); } });
  },
  subscribe(fn) { state.subscribers.add(fn); return () => state.subscribers.delete(fn); },
};
addEventListener('online', () => store.set({connected:true}));
addEventListener('offline', () => store.set({connected:false}));
