// Small inline line-icon set (24×24, stroke = currentColor).
const P = (d) => <path d={d} />;
const C = (cx, cy, r) => <circle cx={cx} cy={cy} r={r} />;

const ICONS = {
  home: [P('M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z')],
  compass: [C(12, 12, 9), P('m15.5 8.5-2 5-5 2 2-5z')],
  search: [C(11, 11, 7), P('m20 20-3.5-3.5')],
  radar: [C(12, 12, 9), C(12, 12, 5), P('M12 12 18.5 5.5')],
  activity: [P('M3 12h4l3-8 4 16 3-8h4')],
  list: [P('M9 6h12M9 12h12M9 18h12'), P('M4 6h.01M4 12h.01M4 18h.01')],
  users: [C(9, 8, 4), P('M2 21a7 7 0 0 1 14 0'), P('M16 4.1a4 4 0 0 1 0 7.8'), P('M22 21a7 7 0 0 0-4.5-6.5')],
  user: [C(12, 8, 4), P('M4 21a8 8 0 0 1 16 0')],
  bookmark: [P('M6 3h12v18l-6-4-6 4z')],
  bell: [P('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9'), P('M10.3 21a1.94 1.94 0 0 0 3.4 0')],
  plus: [P('M12 5v14M5 12h14')],
  check: [P('M5 12.5 10 17l9-10')],
  x: [P('M6 6l12 12M18 6 6 18')],
  star: [P('M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z')],
  sparkle: [P('M12 3c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7z'), P('M19 3v4M17 5h4')],
  film: [<rect key="r" x="3" y="3" width="18" height="18" rx="2" />, P('M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4M3 12h18')],
  tv: [<rect key="r" x="2" y="7" width="20" height="14" rx="2" />, P('m8 3 4 4 4-4')],
  book: [P('M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z'), P('M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5')],
  music: [P('M9 18V5l12-2v13'), C(6, 18, 3), C(18, 16, 3)],
  more: [C(5, 12, 1), C(12, 12, 1), C(19, 12, 1)],
  sun: [C(12, 12, 4), P('M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4')],
  moon: [P('M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z')],
  monitor: [<rect key="r" x="2" y="4" width="20" height="13" rx="2" />, P('M8 21h8M12 17v4')],
  chevron: [P('m9 6 6 6-6 6')],
  back: [P('m15 6-6 6 6 6')],
  arrow: [P('M5 12h14M13 6l6 6-6 6')],
  up: [P('M12 19V5M5 12l7-7 7 7')],
  down: [P('M12 5v14M19 12l-7 7-7-7')],
  logout: [P('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'), P('M16 17l5-5-5-5M21 12H9')],
  refresh: [P('M21 12a9 9 0 1 1-3-6.7L21 8'), P('M21 3v5h-5')],
  note: [P('M5 3h11l4 4v14H5z'), P('M9 12h7M9 16h5')],
  heart: [P('M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z')],
  clock: [C(12, 12, 9), P('M12 7v5l3 2')],
};

export const MEDIUM_ICON = { movie: 'film', tv: 'tv', book: 'book', music: 'music' };

export default function Icon({ name, size = 20, className = '', label }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      {(ICONS[name] || []).map((el, i) => ({ ...el, key: el.key ?? i }))}
    </svg>
  );
}
