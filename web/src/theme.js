// Theme preference: 'system' (default), 'light' or 'dark'. index.html applies
// the saved value before first paint, so there's no flash of the wrong theme.
import { useState } from 'react';

const KEY = 'tm-theme';

function read() {
  try {
    return localStorage.getItem(KEY) || 'system';
  } catch {
    return 'system';
  }
}

function apply(pref) {
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
}

export function useTheme() {
  const [pref, setPref] = useState(read);
  const set = (p) => {
    try {
      localStorage.setItem(KEY, p);
    } catch {
      /* private mode: still apply for this session */
    }
    apply(p);
    setPref(p);
  };
  return [pref, set];
}
