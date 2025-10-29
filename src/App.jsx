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

export default function App() {
  // === Editable inputs ===
  const [E_manu_mup, setEManuMup] = useState(0.0008);
  const [KM_ONE_WAY, setKmOneWay] = useState(300);
  const [p_ret, setPRet] = useState(0.95);  // slider (0..1)
  const [p_scr, setPScr] = useState(0.02);  // slider (0..1)
  const [E_EoL_mup, setEEoL] = useState(-0.0015);
  const [N_max_top, setNMaxTop] = useState(50);

  // === Fixed constants ===
  const constants = {
    m_Al_mup: 0.00324,
    EF_Al_prim: 14.77,
    E_fw_init: 0.00037,
    E_single_shot: 0.00437,
    E_use: 0.0,
    E_clean: 0.001,
    T_FACTOR_PER_100KM: 0.00037,
  };

  // === Core calculations ===
  const calc = useMemo(() => {
    const {
      m_Al_mup,
      EF_Al_prim,
      E_fw_init,
      E_single_shot,
      E_use,
      E_clean,
      T_FACTOR_PER_100KM,
    } = constants;

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

    const chartData = [];
    let breakEven = null;
    let firstCost = null;
    let lastCost = null;

    for (let N = 1; N <= N_max_top; N++) {
      const U = U_eff_js(N, q);
      const E_total_lifetime = E_start + U * E_cycle + E_EoL_mup;
      const amort = E_total_lifetime / U;

      if (firstCost === null) firstCost = amort;
      lastCost = amort;

      chartData.push({
        cycle: N,
        MUP: amort * 1000,
        SUP: E_single_shot * 1000,
        MinCycle: E_cycle * 1000,
      });

      if (breakEven === null && amort <= E_single_shot) {
        breakEven = N;
      }
    }

    return {
      q,
      E_cycle,
      firstCost,
      lastCost,
      breakEven,
      chartData,
      g_single_shot: E_single_shot * 1000,
      g_cycle: E_cycle * 1000,
    };
  }, [E_manu_mup, KM_ONE_WAY, p_ret, p_scr, E_EoL_mup, N_max_top, constants]);

  return (
    <div className="min-h-screen p-6 flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">
          CO₂ per Cup: Single-Use (SUP) vs. Multi-Use (MUP)
        </h1>

        {calc.breakEven && (
          <span className="ml-auto bg-emerald-500/10 border border-emerald-500 text-emerald-700 text-sm font-semibold px-3 py-1 rounded-full shadow-sm animate-pulse">
            Break-Even at Cycle N={calc.breakEven}
          </span>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <section className="lg:col-span-1 bg-white rounded-2xl shadow p-4 border border-slate-200">
          <h2 className="font-semibold text-slate-900 mb-4 text-lg">Model Inputs</h2>

          <div className="space-y-5 text-sm">
            {/* Manufacturing */}
            <div className="flex flex-col">
              <label className="font-medium text-slate-700">
                Manufacturing MUP [kg CO₂e / capsule]
              </label>
              <input
                type="number"
                step="0.0001"
                min="0"
                className="mt-1 rounded-lg border border-slate-300 bg-slate-50 p-2 text-slate-900"
                value={E_manu_mup}
                onChange={(e) => setEManuMup(parseFloat(e.target.value))}
              />
            </div>

            {/* Distance */}
            <div className="flex flex-col">
              <label className="font-medium text-slate-700">
                One-way Transport Distance [km]
              </label>
              <input
                type="number"
                step="1"
                min="0"
                className="mt-1 rounded-lg border border-slate-300 bg-slate-50 p-2 text-slate-900"
                value={KM_ONE_WAY}
                onChange={(e) => setKmOneWay(parseFloat(e.target.value))}
              />
            </div>

            {/* Return Rate slider */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between">
                <label className="font-medium text-slate-700">
                  Return Rate p_ret (0–1)
                </label>
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 rounded px-2 py-0.5">
                  {(p_ret * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={p_ret}
                onChange={(e) => setPRet(parseFloat(e.target.value))}
                className="mt-2 w-full accent-emerald-600"
              />
            </div>

            {/* Scrap Rate slider */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between">
                <label className="font-medium text-slate-700">
                  Scrap Rate p_scr (0–1)
                </label>
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 rounded px-2 py-0.5">
                  {(p_scr * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={p_scr}
                onChange={(e) => setPScr(parseFloat(e.target.value))}
                className="mt-2 w-full accent-rose-600"
              />
            </div>

            {/* EoL */}
            <div className="flex flex-col">
              <label className="font-medium text-slate-700">
                Net EoL Balance MUP [kg CO₂e / capsule]
              </label>
              <input
                type="number"
                step="0.0001"
                className="mt-1 rounded-lg border border-slate-300 bg-slate-50 p-2 text-slate-900"
                value={E_EoL_mup}
                onChange={(e) => setEEoL(parseFloat(e.target.value))}
              />
              <p className="text-xs text-slate-500">May be negative (recycling credit).</p>
            </div>

            {/* Horizon */}
            <div className="flex flex-col">
              <label className="font-medium text-slate-700">
                Maximum Technical Cycles N_max
              </label>
              <input
                type="number"
                step="1"
                min="1"
                className="mt-1 rounded-lg border border-slate-300 bg-slate-50 p-2 text-slate-900"
                value={N_max_top}
                onChange={(e) => setNMaxTop(parseInt(e.target.value))}
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-6 leading-relaxed">
            Fixed constants:
            <br />• Capsule mass 0.00324 kg
            <br />• Primary Al EF 14.77 kg CO₂e/kg
            <br />• Initial logistics 0.00037 kg CO₂e/capsule
            <br />• SUP reference 0.00437 kg CO₂e/cup
            <br />• Cleaning + refill 0.001 kg CO₂e/cycle
          </p>
        </section>

        {/* KPIs & Chart */}
        <section className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white rounded-2xl shadow p-4 border border-slate-200">
            <h2 className="font-semibold text-slate-900 mb-4 text-lg">Results (Live)</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-slate-500 text-xs uppercase font-medium">
                  Survival Rate q
                </div>
                <div className="text-xl font-semibold text-slate-900">
                  {(calc.q * 100).toFixed(1)}%
                </div>
                <div className="text-slate-500 text-xs">q = p_ret × (1 − p_scr)</div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-slate-500 text-xs uppercase font-medium">
                  Start Cost (N = 1)
                </div>
                <div className="text-xl font-semibold text-slate-900">
                  {(calc.firstCost * 1000).toFixed(2)} g CO₂e / cup
                </div>
                <div className="text-slate-500 text-xs">
                  Includes Al + manufacturing + initial logistics
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-slate-500 text-xs uppercase font-medium">
                  Cost at N = {N_max_top}
                </div>
                <div className="text-xl font-semibold text-slate-900">
                  {(calc.lastCost * 1000).toFixed(2)} g CO₂e / cup
                </div>
                <div className="text-slate-500 text-xs">After amortization over N_max</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-slate-500 text-xs uppercase font-medium">
                  Theoretical Minimum per Cycle
                </div>
                <div className="text-xl font-semibold text-slate-900">
                  {calc.g_cycle.toFixed(2)} g CO₂e / cup
                </div>
                <div className="text-slate-500 text-xs">Cleaning + transport only</div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-slate-500 text-xs uppercase font-medium">
                  SUP Reference
                </div>
                <div className="text-xl font-semibold text-slate-900">
                  {calc.g_single_shot.toFixed(2)} g CO₂e / cup
                </div>
                <div className="text-slate-500 text-xs">Single-use capsule</div>
              </div>

              <div
                className={`rounded-xl border ${
                  calc.breakEven
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-200 bg-slate-50"
                } p-3 shadow-sm`}
              >
                <div className="text-slate-500 text-xs uppercase font-medium">
                  Break-Even Point
                </div>
                <div
                  className={`text-xl font-semibold ${
                    calc.breakEven ? "text-emerald-700" : "text-slate-900"
                  }`}
                >
                  {calc.breakEven ? `N = ${calc.breakEven}` : "Not within range"}
                </div>
                <div className="text-slate-500 text-xs">First cycle where MUP ≤ SUP</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-4 border border-slate-200">
            <h2 className="font-semibold text-slate-900 mb-4 text-lg">
              CO₂ per Cup over Reuse Cycles (g)
            </h2>

            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={calc.chartData}>
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

                  <Line
                    type="monotone"
                    dataKey="MUP"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={false}
                    name="MUP amortized"
                  />
                  <Line
                    type="monotone"
                    dataKey="SUP"
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    dot={false}
                    name="SUP reference"
                  />
                  <Line
                    type="monotone"
                    dataKey="MinCycle"
                    stroke="#6b7280"
                    strokeDasharray="2 2"
                    strokeWidth={2}
                    dot={false}
                    name="MUP minimum"
                  />

                  {calc.breakEven && (
                    <ReferenceLine
                      x={calc.breakEven}
                      stroke="#10b981"
                      strokeWidth={3}
                      strokeDasharray="3 3"
                      label={{
                        value: `Break-even N=${calc.breakEven}`,
                        position: "top",
                        fill: "#065f46",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
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
