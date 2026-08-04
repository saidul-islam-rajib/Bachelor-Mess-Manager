const HEAD_Y = 148;
const HEAD_R = 21;
const SHOULDER_Y = 169;
const SHOULDER_HALF = 24;
const TABLE_Y = 236;

const DINERS = [
  { x: 110, skin: '#f8cba4', shirt: '#4f46e5', hair: '#1e1b4b', float: 'motion-safe:animate-float-slow', delay: '0s' },
  { x: 160, skin: '#e0a878', shirt: '#1e293b', hair: '#0f172a', float: 'motion-safe:animate-float', delay: '0.4s' },
  { x: 210, skin: '#f3ba8b', shirt: '#818cf8', hair: '#312e81', float: 'motion-safe:animate-float-slow', delay: '0.9s' }
];

export default function FaqIllustration({ label }: { label: string }) {
  return (
    <svg
      viewBox="0 0 320 300"
      role="img"
      aria-label={label}
      className="h-auto w-full max-w-md"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="160" cy="150" r="130" fill="#eef2ff" />
      <circle cx="160" cy="150" r="130" fill="none" stroke="#e0e7ff" strokeWidth="2" />

      <g className="motion-safe:animate-float-slow">
        <circle cx="52" cy="62" r="12" fill="#fbbf24" />
        <text x="52" y="67" textAnchor="middle" fontSize="13" fontWeight="700" fill="#78350f">
          ৳
        </text>
      </g>
      <g className="motion-safe:animate-float" style={{ animationDelay: '1.1s' }}>
        <circle cx="268" cy="86" r="10" fill="#c7d2fe" />
        <text x="268" y="90" textAnchor="middle" fontSize="11" fontWeight="700" fill="#3730a3">
          ৳
        </text>
      </g>

      {DINERS.map((diner) => (
        <g key={diner.x} className={diner.float} style={{ animationDelay: diner.delay }}>
          <path
            d={`M${diner.x - SHOULDER_HALF} ${TABLE_Y}v-${TABLE_Y - SHOULDER_Y - 10}a${SHOULDER_HALF} ${SHOULDER_HALF} 0 0 1 ${SHOULDER_HALF * 2} 0v${TABLE_Y - SHOULDER_Y - 10}z`}
            fill={diner.shirt}
          />
          <circle cx={diner.x} cy={HEAD_Y} r={HEAD_R} fill={diner.skin} />
          <path
            d={`M${diner.x - HEAD_R} ${HEAD_Y - 4}a${HEAD_R} ${HEAD_R} 0 0 1 ${HEAD_R * 2} 0 ${HEAD_R + 6} ${HEAD_R + 6} 0 0 0-${HEAD_R * 2} 0z`}
            fill={diner.hair}
          />
          <circle cx={diner.x - 7} cy={HEAD_Y + 2} r="2.4" fill="#1e293b" />
          <circle cx={diner.x + 7} cy={HEAD_Y + 2} r="2.4" fill="#1e293b" />
          <path
            d={`M${diner.x - 6} ${HEAD_Y + 10}a8 8 0 0 0 12 0`}
            fill="none"
            stroke="#1e293b"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
      ))}

      <g className="motion-safe:animate-steam">
        <path
          d="M148 204c-5-7 5-10 0-17s5-10 0-15"
          fill="none"
          stroke="#e0e7ff"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M172 204c-5-6 5-9 0-15s5-9 0-13"
          fill="none"
          stroke="#f8fafc"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.85"
        />
      </g>

      <path d="M126 214h68a3 3 0 0 1 3 3v2a22 22 0 0 1-22 17h-30a22 22 0 0 1-22-17v-2a3 3 0 0 1 3-3z" fill="#94a3b8" />
      <path d="M126 214h68a3 3 0 0 1 3 3v2a22 22 0 0 1-9 8h-56a22 22 0 0 1-9-8v-2a3 3 0 0 1 3-3z" fill="#cbd5e1" />
      <rect x="118" y="206" width="84" height="10" rx="5" fill="#475569" />

      <rect x="52" y={TABLE_Y} width="216" height="15" rx="7" fill="#cbd5e1" />
      <rect x="52" y={TABLE_Y} width="216" height="7" rx="3.5" fill="#e2e8f0" />
      <rect x="76" y={TABLE_Y + 15} width="11" height="40" rx="5.5" fill="#cbd5e1" />
      <rect x="233" y={TABLE_Y + 15} width="11" height="40" rx="5.5" fill="#cbd5e1" />

      <g className="motion-safe:animate-float-slow" style={{ animationDelay: '1.4s' }}>
        <g transform="rotate(7 277 198)">
          <rect x="246" y="150" width="62" height="96" rx="10" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
          <rect x="257" y="163" width="34" height="6" rx="3" fill="#0f172a" />
          <rect x="257" y="177" width="40" height="4.5" rx="2.25" fill="#e2e8f0" />
          <rect x="257" y="188" width="32" height="4.5" rx="2.25" fill="#e2e8f0" />
          <rect x="257" y="199" width="38" height="4.5" rx="2.25" fill="#e2e8f0" />
          <circle cx="277" cy="223" r="13" fill="#dcfce7" />
          <path
            d="m271 223 4 4 7.5-8"
            fill="none"
            stroke="#16a34a"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>

      <g className="motion-safe:animate-float" style={{ animationDelay: '0.7s' }}>
        <g transform="rotate(-8 45 199)">
          <rect x="16" y="156" width="58" height="86" rx="10" fill="#0f172a" />
          <rect x="22" y="164" width="46" height="70" rx="6" fill="#ffffff" />
          <rect x="28" y="172" width="24" height="5" rx="2.5" fill="#c7d2fe" />
          <rect x="28" y="184" width="34" height="4" rx="2" fill="#e2e8f0" />
          <rect x="28" y="193" width="28" height="4" rx="2" fill="#e2e8f0" />
          <rect x="28" y="205" width="34" height="13" rx="6.5" fill="#4f46e5" />
          <rect x="28" y="224" width="18" height="4" rx="2" fill="#e2e8f0" />
        </g>
      </g>
    </svg>
  );
}
