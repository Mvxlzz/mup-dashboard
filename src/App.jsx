import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

// Hilfsfunktion: sichere Zahl aus String/Number ziehen
function toNum(v, fallback = 0) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : fallback;
}

function computeSeries(params, constants, N_max_top) {
  const {
    m_Al_mup,
    EF_Al_prim,
    E_fw_init,
    E_single_shot,
    E_use,
    E_clean,
    T_FACTOR_PER_100KM,
  } = constants;

  // Werte sicher numerisch machen (Strings erlaubt im State)
  const E_manu_mup = toNum(params.E_manu_mup, 0);
  const KM_ONE_WAY = toNum(params.KM_ONE_WAY, 0);
  const p_ret = Math.min(1, Math.max(0, toNum(params.p_ret, 0)));
  const p_scr = Math.min(1, Math.max(0, toNum(params.p_scr, 0)));
  const E_EoL_mup = toNum(params.E_EoL_mup, 0);

  const T_FACTOR_PER_KM = T_FACTOR_PER_100KM / 100.0;
  const E_fw = T_FACTOR_PER_KM * KM_ONE_WAY;
  const E_rev = T_FACTOR_PER_KM * KM_ONE_WAY;

  const E_mat_mup = m_Al_mup * EF_Al_prim;
  const E_start = E_mat_mup + E_manu_mup + E_fw_init;
  const E_cycle = E_clean + E_fw + E_use + E_rev;

  const q = p_ret * (1 - p_scr);

  function U_eff_js(N, q) {
    if (q === 1) return N;
    return (1 - q ** N) / (1 - q);
  }

  const data = [];
  let firstCost = null;
  let lastCost = null;
  let breakEven = null;

  for (let N = 1; N <= N_max_top; N++) {
    const U = U_eff_js(N, q);
    const E_total_lifetime = E_start + U * E_cycle + E_EoL_mup;
    const amort = E_total_lifetime / U; // kg

    if (firstCost === null) firstCost = amort;
    lastCost = amort;

    data.push({
      cycle: N,
      MUP_g: amort * 1000, // g
      SUP_g: E_single_shot * 1000,
    });

    if (breakEven === null && amort <= E_single_shot) {
      breakEven = N;
    }
  }

  return {
    data,
    q,
    E_cycle_g: E_cycle * 1000,
    firstCost_g: firstCost * 1000,
    lastCost_g: lastCost * 1000,
    breakEven,
  };
}

export default function App() {
  // Gemeinsamer Horizont
  const [N_max_top, setNMaxTop] = useState(50);

  // Konstanten
  const constants = {
    m_Al_mup: 0.00324,
    EF_Al_prim: 14.77,
    E_fw_init: 0.00037,
    E_single_shot: 0.00437,
    E_use: 0.0,
    E_clean: 0.001,
    T_FACTOR_PER_100KM: 0.00037,
  };

  // Drei Szenarien — Werte jetzt als STRING für Inputs (wo sinnvoll), Slider bleiben Zahlen
  const [worst, setWorst] = useState({
    name: "Worst Case",
    E_manu_mup: "0.0010",
    KM_ONE_WAY: "500",
    p_ret: 0.85,   // Slider numeric
    p_scr: 0.06,   // Slider numeric
    E_EoL_mup: "0.0002",
    color: "#ef4444",
  });

  const [expected, setExpected] = useState({
    name: "Expected Case",
    E_manu_mup: "0.0008",
    KM_ONE_WAY: "300",
    p_ret: 0.95,
    p_scr: 0.02,
    E_EoL_mup: "0.0000",
    color: "#0ea5e9",
  });

  const [best, setBest] = useState({
    name: "Best Case",
    E_manu_mup: "0.0006",
    KM_ONE_WAY: "150",
    p_ret: 0.98,
    p_scr: 0.01,
    E_EoL_mup: "-0.0015",
    color: "#10b981",
  });

  // Ergebnisse
  const resWorst = useMemo(
    () => computeSeries(worst, constants, N_max_top),
    [worst, constants, N_max_top]
  );
  const resExpected = useMemo(
    () => computeSeries(expected, constants, N_max_top),
    [expected, constants, N_max_top]
  );
  const resBest = useMemo(
    () => computeSeries(best, constants, N_max_top),
    [best, constants, N_max_top]
  );

  // Chart-Daten zusammenführen
  const chartData = useMemo(() => {
    const map = new Map();
    const add = (arr, key) => {
      arr.forEach((r) => {
        const row = map.get(r.cycle) || { cycle: r.cycle, SUP: r.SUP_g };
        row[key] = r.MUP_g;
        map.set(r.cycle, row);
      });
    };
    add(resWorst.data, "MUP_Worst");
    add(resExpected.data, "MUP_Expected");
    add(resBest.data, "MUP_Best");
    return Array.from(map.values()).sort((a, b) => a.cycle - b.cycle);
  }, [resWorst.data, resExpected.data, resBest.data]);

  // Reusable Input-Komponenten
  const Num = ({ label, value, set, step = "0.0001", min, max, placeholder }) => (
    <div className="flex flex-col">
      <label className="font-medium text-slate-700">{label}</label>
      <input
        type="text"               // <-- Text statt number: erlaubt Zwischenzustände
        inputMode="decimal"       // mobile keyboard
        placeholder={placeholder}
        className="mt-1 rounded-lg border border-slate-300 bg-slate-50 p-2 text-slate-900"
        value={value}
        onChange={(e) => set(e.target.value)} // rohen String speichern
        onBlur={(e) => {
          // bei Verlassen optional normalisieren (Trim, Komma -> Punkt)
          const normalized = e.target.value.replace(",", ".").trim();
          set(normalized);
        }}
      />
      {/* Kleiner Hilfe-Text */}
      <div className="text-[11px] text-slate-400 mt-1">Press Enter or leave the field to apply.</div>
    </div>
  );

  const Slider = ({ label, value, set, min = 0, max = 1, step = 0.01, percent = false }) => (
    <div className="flex flex-col">
      <div className="flex items-center justify-between">
        <label className="font-medium text-slate-700">{label}</label>
        <span className="text-xs font-semibold text-slate-700 bg-slate-100 rounded px-2 py-0.5">
          {percent ? `${(value * 100).toFixed(0)}%` : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(parseFloat(e.target.value))}
        className="mt-2 w-full accent-emerald-600"
      />
    </div>
  );

  const BEBadge = ({ label, be, color }) => (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border`}
      style={{
        color: be ? color : "#334155",
        backgroundColor: be ? `${color}20` : "#f1f5f9",
        borderColor: be ? color : "#e2e8f0",
      }}
      title={be ? `Break-even at cycle N=${be}` : "No break-even within horizon"}
    >
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: be ? color : "#94a3b8" }}
      />
      {be ? `Break-even N=${be}` : "No break-even"}
    </div>
  );

  const ScenarioCard = ({ title, color, state, setState, result }) => (
    <section className="bg-white rounded-2xl shadow p-4 border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-900 text-lg" style={{ color }}>
          {title}
        </h3>
        <BEBadge label="Break-even" be={result?.breakEven} color={color} />
      </div>

      <div className="grid grid-cols-1 gap-4 text-sm">
        <Num
          label="Manufacturing MUP [kg CO₂e/capsule]"
          value={state.E_manu_mup}
          set={(v) => setState((s) => ({ ...s, E_manu_mup: v }))}
          placeholder="e.g. 0.0008"
        />
        <Num
          label="One-way Transport Distance [km]"
          value={state.KM_ONE_WAY}
          set={(v) => setState((s) => ({ ...s, KM_ONE_WAY: v }))}
          placeholder="e.g. 250"
        />
        <Slider
          label="Return Rate p_ret (0–1)"
          value={state.p_ret}
          set={(v) => setState((s) => ({ ...s, p_ret: v }))}
          percent
        />
        <Slider
          label="Scrap Rate p_scr (0–1)"
          value={state.p_scr}
          set={(v) => setState((s) => ({ ...s, p_scr: v }))}
          percent
        />
        <Num
          label="Net EoL Balance [kg CO₂e/capsule]"
          value={state.E_EoL_mup}
          set={(v) => setState((s) => ({ ...s, E_EoL_mup: v }))}
          placeholder="e.g. -0.0015"
        />
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm mt-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-slate-500 text-xs uppercase font-medium">q = p_ret × (1 − p_scr)</div>
          <div className="text-xl font-semibold text-slate-900">
            {(toNum(state.p_ret, 0) * (1 - toNum(state.p_scr, 0))).toLocaleString(undefined, {
              style: "percent",
              maximumFractionDigits: 1,
            })}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-slate-500 text-xs uppercase font-medium">Start (N=1)</div>
          <div className="text-xl font-semibold text-slate-900">
            {result ? result.firstCost_g.toFixed(2) : "-"} g
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-slate-500 text-xs uppercase font-medium">At N = {N_max_top}</div>
          <div className="text-xl font-semibold text-slate-900">
            {result ? result.lastCost_g.toFixed(2) : "-"} g
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <div className="min-h-screen p-6 flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">
          CO₂ per Cup: Single-Use (SUP) vs. Multi-Use (MUP) — 3 Scenarios
        </h1>

        {(resExpected.breakEven || resWorst.breakEven || resBest.breakEven) && (
          <span className="ml-auto bg-emerald-500/10 border border-emerald-500 text-emerald-700 text-sm font-semibold px-3 py-1 rounded-full shadow-sm">
            Break-even (if any) shown in chart
          </span>
        )}
      </header>

      {/* Inputs: drei Szenario-Karten + gemeinsamer Horizont */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ScenarioCard
          title={worst.name}
          color={worst.color}
          state={worst}
          setState={setWorst}
          result={resWorst}
        />
        <ScenarioCard
          title={expected.name}
          color={expected.color}
          state={expected}
          setState={setExpected}
          result={resExpected}
        />
        <ScenarioCard
          title={best.name}
          color={best.color}
          state={best}
          setState={setBest}
          result={resBest}
        />
      </div>

      <div className="bg-white rounded-2xl shadow p-4 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900 text-lg">CO₂ per Cup over Reuse Cycles (g)</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-700">Maximum Technical Cycles N_max</label>
            <input
              type="number"
              step="1"
              min="1"
              className="rounded-lg border border-slate-300 bg-slate-50 p-2 text-slate-900 w-24"
              value={N_max_top}
              onChange={(e) => setNMaxTop(parseInt(e.target.value || "1", 10))}
            />
          </div>
        </div>

        <div className="w-full h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis
                dataKey="cycle"
                label={{
                  value: "Max technical cycles (N_max)",
                  position: "insideBottomRight",
                  offset: -5,
                  style: { fill: "#475569", fontSize: 12 },
                }}
                stroke="#475569"
              />
              <YAxis
                label={{
                  value: "g CO₂e / cup",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "#475569", fontSize: 12 },
                }}
                stroke="#475569"
              />
              <Tooltip />
              <Legend />

              {/* Drei MUP-Linien */}
              <Line type="monotone" dataKey="MUP_Worst" stroke={worst.color} strokeWidth={2} dot={false} name={worst.name} />
              <Line type="monotone" dataKey="MUP_Expected" stroke={expected.color} strokeWidth={3} dot={false} name={expected.name} />
              <Line type="monotone" dataKey="MUP_Best" stroke={best.color} strokeWidth={2} dot={false} name={best.name} />

              {/* SUP-Referenz */}
              <Line type="monotone" dataKey="SUP" stroke="#6b7280" strokeDasharray="5 5" strokeWidth={2} dot={false} name="SUP reference" />

              {/* Break-even Referenzlinien je Szenario */}
              {resWorst.breakEven && (
                <ReferenceLine
                  x={resWorst.breakEven}
                  stroke={worst.color}
                  strokeDasharray="3 3"
                  label={{ value: `${worst.name} N=${resWorst.breakEven}`, fill: worst.color, position: "top", fontSize: 11 }}
                />
              )}
              {resExpected.breakEven && (
                <ReferenceLine
                  x={resExpected.breakEven}
                  stroke={expected.color}
                  strokeDasharray="3 3"
                  label={{ value: `${expected.name} N=${resExpected.breakEven}`, fill: expected.color, position: "top", fontSize: 11 }}
                />
              )}
              {resBest.breakEven && (
                <ReferenceLine
                  x={resBest.breakEven}
                  stroke={best.color}
                  strokeDasharray="3 3"
                  label={{ value: `${best.name} N=${resBest.breakEven}`, fill: best.color, position: "top", fontSize: 11 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-[11px] text-slate-500 mt-3">
          Fixed constants: mass 0.00324 kg · primary Al EF 14.77 kg CO₂e/kg · initial logistics 0.00037 kg CO₂e/capsule ·
          SUP reference 0.00437 kg CO₂e/cup · cleaning+refill 0.001 kg CO₂e/cycle.
        </p>
      </div>

      <footer className="text-[11px] text-slate-500 text-center leading-relaxed">
        Model based on Python LCA calculation. All values per cup.
        <br />
        <span className="text-[10px] text-slate-400">
          © Intellectual property of Maximilian Kühn, Cornelius Hauber, Henri Calaminus and Christopher-Lund Seureau.
        </span>
      </footer>
    </div>
  );
}
