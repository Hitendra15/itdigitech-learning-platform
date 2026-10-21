// Small dependency-free SVG charts.
const shortDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");

export function BarChart({ data, height = 160, format = (v) => v, tone = "primary", label = "Chart" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / data.length;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <figure className="chart" aria-label={`${label}. Total ${format(total)}`}>
      <svg viewBox={`0 0 100 ${height / 4}`} preserveAspectRatio="none" role="img" style={{ height }}>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2="100" y1={(height / 4) * g} y2={(height / 4) * g} className="chart-grid" />)}
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 4 - 2);
          return (
            <rect key={d.date ?? i} x={i * w + w * 0.18} width={w * 0.64} y={height / 4 - h} height={Math.max(h, d.value ? 0.6 : 0.25)}
                  rx="0.8" className={`bar-${tone} ${d.value ? "" : "bar-zero"}`}>
              <title>{`${d.label ?? shortDate(d.date)}: ${format(d.value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="chart-axis"><span>{data[0]?.label ?? shortDate(data[0]?.date)}</span><span>{data[data.length - 1]?.label ?? shortDate(data[data.length - 1]?.date)}</span></figcaption>
    </figure>
  );
}

export function HBars({ rows, format = (v) => v }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="hbars-top"><span>{r.label}</span><strong>{format(r.value)}</strong></div>
          <div className="bar"><span style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
