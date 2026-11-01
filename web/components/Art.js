// Original illustrations (simple shapes, no outside artwork).
const Star = ({ x, y, s = 1, c = "#fff" }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} fill={c} d="M0-9L2.2-2.2 9 0 2.2 2.2 0 9-2.2 2.2-9 0-2.2-2.2Z" />
);

export function ArtLive() {
  return (
    <svg viewBox="0 0 440 340" role="img" aria-label="Controls that update live">
      <defs>
        <linearGradient id="al-g" x1="0" x2="1"><stop offset="0" stopColor="#a02ee0" /><stop offset="1" stopColor="#5a4bea" /></linearGradient>
      </defs>
      <path d="M60 170C40 90 130 30 220 38s170 40 170 120-40 150-150 150S80 250 60 170Z" fill="#d6ecf8" />
      <rect x="92" y="78" width="256" height="76" rx="20" fill="#fff" />
      <rect x="116" y="102" width="96" height="10" rx="5" fill="#cfc4f3" />
      <rect x="116" y="122" width="148" height="9" rx="4.5" fill="#e7e1f8" />
      <rect x="276" y="100" width="48" height="28" rx="14" fill="url(#al-g)" />
      <circle cx="310" cy="114" r="10" fill="#fff" />
      <rect x="132" y="174" width="256" height="76" rx="20" fill="#fff" />
      <rect x="156" y="198" width="80" height="10" rx="5" fill="#cfc4f3" />
      <rect x="156" y="218" width="150" height="9" rx="4.5" fill="#e7e1f8" />
      <path d="M318 224l14-14 12 10 18-24" fill="none" stroke="#2fb38a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="372" cy="92" r="16" fill="#ff8fb3" /><circle cx="372" cy="92" r="26" fill="none" stroke="#ff8fb3" strokeOpacity=".4" strokeWidth="3" />
      <Star x={80} y={70} s={1.2} /><Star x={372} y={290} s={1} c="#8a5cf0" /><Star x={56} y={250} s={.8} c="#8a5cf0" />
    </svg>
  );
}

export function ArtLayout() {
  return (
    <svg viewBox="0 0 440 340" role="img" aria-label="Saved layout that can be rebuilt">
      <path d="M50 180C40 100 120 40 210 46s180 50 170 130-60 140-160 134S60 250 50 180Z" fill="#e4dcff" />
      <g>
        <path d="M120 232l100-44 100 44-100 44z" fill="#bfeedd" stroke="#241a52" strokeWidth="3" strokeLinejoin="round" />
        <path d="M120 196l100-44 100 44-100 44z" fill="#ffc7b8" stroke="#241a52" strokeWidth="3" strokeLinejoin="round" />
        <path d="M120 160l100-44 100 44-100 44z" fill="#fff" stroke="#241a52" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="220" cy="160" r="9" fill="#8a5cf0" />
      </g>
      <path d="M330 90a46 46 0 1 0 8 62" fill="none" stroke="#6a3ae9" strokeWidth="6" strokeLinecap="round" />
      <path d="M342 62l-4 32-30-10z" fill="#6a3ae9" />
      <Star x={90} y={90} s={1.1} c="#8a5cf0" /><Star x={380} y={250} s={1.2} /><Star x={64} y={236} s={.8} />
    </svg>
  );
}
