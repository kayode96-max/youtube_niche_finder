// Bespoke, dependency-free SVG charts. Deliberately lightweight (the spec asks
// for lightweight charts, no heavy library). Two primitives: a multi-series
// line chart and a bar chart, both responsive via viewBox.

const PALETTE = ['#FFB300', '#5AA9E6', '#3DDC84'];

function niceMax(v) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

// series: [{ name, color?, points: [{x?, y}] }]  (x optional → index used)
export function LineChart({ series = [], height = 180, yFormat = (v) => v, xLabels = [] }) {
  const W = 640; const H = height;
  const padL = 44; const padR = 12; const padT = 12; const padB = 24;
  const allY = series.flatMap((s) => s.points.map((p) => p.y)).filter((y) => y != null && Number.isFinite(y));
  const maxY = niceMax(Math.max(1, ...allY));
  const maxLen = Math.max(1, ...series.map((s) => s.points.length));
  const plotW = W - padL - padR; const plotH = H - padT - padB;

  const xAt = (i) => padL + (maxLen <= 1 ? plotW / 2 : (i / (maxLen - 1)) * plotW);
  const yAt = (v) => padT + plotH - (v / maxY) * plotH;

  const yticks = 4;
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
        {Array.from({ length: yticks + 1 }, (_, i) => {
          const val = (maxY / yticks) * i;
          const y = yAt(val);
          return (
            <g key={i}>
              <line className="gridline" x1={padL} y1={y} x2={W - padR} y2={y} />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#565C67" fontFamily="IBM Plex Mono, monospace">{yFormat(val)}</text>
            </g>
          );
        })}
        {series.map((s, si) => {
          const color = s.color || PALETTE[si % PALETTE.length];
          const pts = s.points
            .map((p, i) => (p.y == null ? null : `${xAt(i)},${yAt(p.y)}`))
            .filter(Boolean)
            .join(' ');
          return (
            <g key={si}>
              <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p, i) => (p.y == null ? null : (
                <circle key={i} cx={xAt(i)} cy={yAt(p.y)} r="2.5" fill={color} />
              )))}
            </g>
          );
        })}
        {xLabels.length > 0 && xLabels.map((lb, i) => (
          <text key={i} x={xAt(i * ((maxLen - 1) / Math.max(1, xLabels.length - 1)))} y={H - 6} textAnchor="middle" fontSize="9" fill="#565C67" fontFamily="IBM Plex Mono, monospace">{lb}</text>
        ))}
      </svg>
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s, si) => (
            <span className="lg" key={si}><span className="swatch" style={{ background: s.color || PALETTE[si % PALETTE.length] }} />{s.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// bars: [{ label?, value, color? }]
export function BarChart({ bars = [], height = 160, yFormat = (v) => v }) {
  const W = 640; const H = height;
  const padL = 44; const padR = 12; const padT = 12; const padB = 22;
  const maxY = niceMax(Math.max(1, ...bars.map((b) => b.value || 0)));
  const plotW = W - padL - padR; const plotH = H - padT - padB;
  const n = Math.max(1, bars.length);
  const gap = 4;
  const bw = Math.max(2, plotW / n - gap);
  const yAt = (v) => padT + plotH - (v / maxY) * plotH;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
        {Array.from({ length: 5 }, (_, i) => {
          const val = (maxY / 4) * i; const y = yAt(val);
          return (
            <g key={i}>
              <line className="gridline" x1={padL} y1={y} x2={W - padR} y2={y} />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#565C67" fontFamily="IBM Plex Mono, monospace">{yFormat(val)}</text>
            </g>
          );
        })}
        {bars.map((b, i) => {
          const x = padL + i * (bw + gap);
          const y = yAt(b.value || 0);
          const h = padT + plotH - y;
          return <rect key={i} x={x} y={y} width={bw} height={Math.max(0, h)} fill={b.color || '#FFB300'} rx="2" />;
        })}
      </svg>
    </div>
  );
}
