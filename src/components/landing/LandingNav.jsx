export default function LandingNav() {
  return (
    <header className="lp-topbar">
      <div className="lp-mini-logo"><span className="br">[</span><span className="hex">HEX</span><span className="dash">-</span><span className="ble">BLE</span><sup>6</sup><span className="br">]</span></div>
      <div className="lp-telemetry">
        <div className="lp-telemetry-track">
          STATE.06 // P=0.713 // <b>CALIBRATION ACTIVE</b> // ENTROPY 0.284 // <b>RISK.GATE OPEN</b> // OUTCOME VECTOR [A/B/C] // SOURCE OF TRUTH // TRUST LAYER ENGAGED // STATE.06 // P=0.713 // <b>CALIBRATION ACTIVE</b> // ENTROPY 0.284 // <b>RISK.GATE OPEN</b> // OUTCOME VECTOR [A/B/C] // SOURCE OF TRUTH // TRUST LAYER ENGAGED //
        </div>
      </div>
    </header>
  );
}