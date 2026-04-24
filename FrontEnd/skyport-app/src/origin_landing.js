import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import HexagonIcon from '@mui/icons-material/Hexagon';
import RadarIcon from '@mui/icons-material/Radar';

const capabilityCards = [
  {
    icon: <HexagonIcon />,
    title: 'Spatial suitability',
    text: 'H3 cells turn a selected Istanbul region into measurable candidate locations.',
  },
  {
    icon: <AltRouteIcon />,
    title: 'Corridor safety',
    text: 'A* route checks combine NFZ, controlled airspace, obstacles and weather limits.',
  },
  {
    icon: <RadarIcon />,
    title: 'Airspace awareness',
    text: 'Restricted and controlled zones stay visible while experts make planning decisions.',
  },
  {
    icon: <AnalyticsIcon />,
    title: 'Decision evidence',
    text: 'Suitability scores, heatmaps and comparisons support explainable site selection.',
  },
];

const gapCards = [
  {
    label: 'Planning teams',
    title: 'Where can we safely build and operate?',
    text: 'Candidate sites need evidence across land use, transport access, obstacles and airspace restrictions.',
  },
  {
    label: 'Passenger network',
    title: 'Which route is usable right now?',
    text: 'Passenger-facing routes must stay understandable while still reflecting operational constraints.',
  },
];

const factors = [
  {
    title: 'No-fly zones',
    text: 'Restricted airspace is shown on the map and treated as a blocker during route validation.',
  },
  {
    title: 'Controlled airspace',
    text: 'Controlled zones remain visible so experts can understand where approval constraints exist.',
  },
  {
    title: 'Obstacle exposure',
    text: 'Buildings and obstacle signals influence suitability and route warnings for selected corridors.',
  },
  {
    title: 'Transport access',
    text: 'Candidate cells are evaluated against surrounding mobility access and operational usefulness.',
  },
  {
    title: 'Weather layer',
    text: 'Open-Meteo wind data, including elevated wind layers, informs route safety checks.',
  },
  {
    title: 'Candidate ranking',
    text: 'AHP/TOPSIS scoring turns multiple criteria into explainable candidate comparisons.',
  },
];

const workflowCards = [
  {
    step: '01',
    title: 'Draw an analysis region',
    text: 'Experts select an Istanbul area on the map and run geodata ingest for buildings, roads, land use and H3 cells.',
  },
  {
    step: '02',
    title: 'Score candidate cells',
    text: 'AHP/TOPSIS weights create a suitability heatmap so high-potential vertiport cells are easy to compare.',
  },
  {
    step: '03',
    title: 'Simulate the route',
    text: 'A route is checked against NFZ, controlled airspace, building obstacles and Open-Meteo wind before it is shown as safe or unsafe.',
  },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const progress = Math.min(window.scrollY / 760, 1);
      setScrollProgress(progress);
    };

    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    return () => window.removeEventListener('scroll', updateProgress);
  }, []);

  const flightSceneStyle = {
    transform: `translate3d(${scrollProgress * 84}px, ${scrollProgress * -280}px, 0) scale(${1 + scrollProgress * 0.34}) rotate(${-7 - scrollProgress * 3}deg)`,
  };

  return (
    <div className="skyport-landing">
      <style>{landingCss}</style>

      <nav className="landing-nav">
        <button className="brand" onClick={() => navigate('/')} aria-label="SkyPort home">
          <span className="brand-mark">
            <FlightTakeoffIcon fontSize="small" />
          </span>
          <span>SkyPort</span>
        </button>
        <div className="nav-actions">
          <button className="nav-link" onClick={() => navigate('/auth')}>Login</button>
          <button className="nav-button" onClick={() => navigate('/auth')}>Create account</button>
        </div>
      </nav>

      <main>
        <section className="hero">
          <div className="flight-scene" style={flightSceneStyle} aria-hidden="true">
            <div className="white-wake" />
            <div className="aircraft-wrap">
              <img src="/assets/evtol-landing.png" alt="" />
            </div>
            <span className="spark spark-one" />
            <span className="spark spark-two" />
            <span className="spark spark-three" />
          </div>

          <div className="hero-copy">
            <p className="eyebrow">Istanbul UAM decision support</p>
            <h1>
              Unlocking
              <br />
              Istanbul's
              <br />
              <span>air mobility</span>
            </h1>
            <p className="lead">
              SkyPort helps experts evaluate vertiport locations, visualize airspace constraints
              and validate eVTOL routes before they become operational corridors.
            </p>
            <div className="hero-actions">
              <button className="primary-action" onClick={() => navigate('/auth')}>Start analysis</button>
              <button className="secondary-action" onClick={() => document.getElementById('capabilities')?.scrollIntoView({ behavior: 'smooth' })}>
                Scroll down
              </button>
            </div>
          </div>

          <div className="hero-meta">
            <span>H3 grid</span>
            <span>AHP/TOPSIS</span>
            <span>Route safety</span>
          </div>
        </section>

        <section id="capabilities" className="aviation-age">
          <div className="section-kicker">The opportunity</div>
          <h2>
            We are entering
            <span>a new age</span>
            of urban aviation
          </h2>
          <div className="age-strip">
            <span>eVTOL corridors</span>
            <span>Vertiport networks</span>
            <span>Data-led safety</span>
          </div>
        </section>

        <IstanbulNetworkMap />

        <section className="gap-section">
          <div className="gap-title">
            <p>But there is a gap.</p>
            <h2>Air mobility needs one place for site analysis, map layers and route simulation.</h2>
          </div>
          <div className="gap-grid">
            {gapCards.map((card) => (
              <article className="gap-card" key={card.title}>
                <span>{card.label}</span>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="simulation-section">
          <div className="simulation-heading">
            <p>What you actually use</p>
            <h2>A map-based simulator for expert planning and passenger routes.</h2>
          </div>
          <StepShowcase />
        </section>

        <section className="unlock-section">
          <div className="unlock-heading">
            <p>How SkyPort unlocks the corridor</p>
            <h2>One workflow from selected region to operational confidence.</h2>
          </div>
          <div className="capability-grid">
            {capabilityCards.map((card) => (
              <article className="capability-card" key={card.title}>
                <div className="card-icon">{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="perspective-section">
          <div className="perspective-copy">
            <span>01 / 03</span>
            <h2>
              Get a 360 view
              <br />
              of Istanbul air mobility.
            </h2>
            <p>
              SkyPort combines spatial suitability, airspace visibility and route simulation so
              expert decisions can be explained before they become passenger routes.
            </p>
          </div>
          <div className="factor-grid">
            {factors.map((factor, index) => (
              <article className="factor-card" key={factor.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{factor.title}</h3>
                <p>{factor.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="final-landing-cta">
          <div>
            <p>Ready to analyse?</p>
            <h2>Build the network, check the airspace, simulate the route.</h2>
          </div>
          <button onClick={() => navigate('/auth')}>Start SkyPort</button>
        </section>
      </main>
    </div>
  );
};

const IstanbulNetworkMap = () => (
  <section className="network-section">
    <div className="network-copy">
      <p>Virtual Istanbul network</p>
      <h2>Watch the corridor connect two sides of the city.</h2>
      <span>
        A simplified digital map shows how SkyPort turns scattered candidate points into a
        route-ready eVTOL corridor.
      </span>
    </div>

    <div className="virtual-map" aria-label="Animated virtual Istanbul simulation map">
      <svg viewBox="0 0 1180 620" role="img">
        <defs>
          <pattern id="istanbulDots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="8" cy="8" r="3.2" fill="#8fa3b8" opacity="0.72" />
          </pattern>
          <clipPath id="istanbulMask">
            <path d="M34 260 C84 120 224 48 410 66 C538 80 612 126 698 162 C784 198 922 182 1018 126 C1088 86 1136 92 1162 148 C1128 194 1070 228 990 242 C936 252 886 278 858 326 C812 408 700 418 610 384 C520 350 450 356 392 420 C318 502 178 488 86 408 C30 358 10 314 34 260 Z" />
            <path d="M310 430 C370 386 438 378 530 396 C620 416 708 452 812 424 C788 506 696 558 560 544 C444 532 352 494 310 430 Z" />
          </clipPath>
          <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="1180" height="620" rx="18" fill="#07151b" />
        <rect width="1180" height="620" fill="url(#istanbulDots)" clipPath="url(#istanbulMask)" />
        <path className="map-shoreline" d="M34 260 C84 120 224 48 410 66 C538 80 612 126 698 162 C784 198 922 182 1018 126 C1088 86 1136 92 1162 148" />
        <path className="map-waterline" d="M72 420 C240 322 390 300 540 334 C692 368 818 334 950 252" />

        <path
          id="istanbulRoutePath"
          className="network-route"
          d="M170 444 C260 312 384 298 498 344 C636 400 722 318 820 260 C894 216 954 206 1010 176"
        />
        <path
          className="network-route-flow"
          d="M170 444 C260 312 384 298 498 344 C636 400 722 318 820 260 C894 216 954 206 1010 176"
        />

        <path className="analysis-ring ring-a" d="M116 392 C154 334 224 328 260 382 C300 444 232 510 166 486 C118 468 92 430 116 392 Z" />
        <path className="analysis-ring ring-b" d="M880 130 C938 86 1026 104 1058 166 C1090 232 1018 292 942 268 C882 250 834 176 880 130 Z" />
        <path className="analysis-ring ring-c" d="M456 286 C520 230 622 256 640 332 C662 420 540 464 468 406 C420 368 414 326 456 286 Z" />

        <circle className="endpoint endpoint-a" cx="170" cy="444" r="13" />
        <circle className="endpoint endpoint-b" cx="1010" cy="176" r="13" />
        <circle className="signal-dot" cx="418" cy="224" r="7" />
        <circle className="signal-dot" cx="648" cy="172" r="7" />
        <circle className="signal-dot" cx="820" cy="322" r="7" />
        <circle className="signal-dot" cx="930" cy="246" r="7" />

      </svg>
    </div>
  </section>
);

const StepShowcase = () => (
  <div className="step-showcase" aria-label="SkyPort workflow screens">
    {workflowCards.map((item, index) => (
      <article className="step-screen" key={item.title}>
        <div className="step-copy">
          <span>{item.step}</span>
          <h3>{item.title}</h3>
          <p>{item.text}</p>
        </div>
        <MiniMap variant={index} />
      </article>
    ))}
  </div>
);

const MiniMap = ({ variant }) => (
  <div className="mini-map">
    <svg viewBox="0 0 520 300" aria-hidden="true">
      <defs>
        <pattern id={`miniGrid-${variant}`} width="28" height="24" patternUnits="userSpaceOnUse">
          <path d="M14 0 L28 7 L28 17 L14 24 L0 17 L0 7 Z" fill="none" stroke="rgba(15,23,42,0.13)" strokeWidth="1" />
        </pattern>
        <filter id={`miniGlow-${variant}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="520" height="300" fill="#eef4ef" />
      <rect width="520" height="300" fill={`url(#miniGrid-${variant})`} />
      <path d="M0 212 C86 170 136 196 190 158 C248 116 310 142 370 112 C430 82 476 76 520 54 L520 300 L0 300 Z" fill="rgba(125,211,252,0.22)" />

      {variant === 0 && (
        <>
          <rect className="select-box" x="116" y="82" width="254" height="146" rx="8" />
          <circle className="mini-node blue" cx="154" cy="206" r="9" />
          <circle className="mini-node orange" cx="338" cy="110" r="9" />
        </>
      )}

      {variant === 1 && (
        <>
          <path className="mini-heat high" d="M210 150 L252 128 L294 150 L294 194 L252 216 L210 194 Z" />
          <path className="mini-heat mid" d="M162 178 L204 156 L246 178 L246 222 L204 244 L162 222 Z" />
          <path className="mini-heat low" d="M290 110 L332 88 L374 110 L374 154 L332 176 L290 154 Z" />
          <circle className="mini-node green" cx="252" cy="172" r="10" />
        </>
      )}

      {variant === 2 && (
        <>
          <path className="mini-nfz" d="M92 164 C122 126 174 136 188 178 C204 226 142 250 104 222 C78 202 74 180 92 164 Z" />
          <path className="mini-controlled" d="M322 74 C374 44 444 72 448 126 C452 176 388 198 342 168 C308 146 292 98 322 74 Z" />
          <path className="mini-route-base" d="M110 220 C192 158 254 230 326 152 C376 98 416 92 456 72" />
          <path className="mini-route-flow" d="M110 220 C192 158 254 230 326 152 C376 98 416 92 456 72" filter={`url(#miniGlow-${variant})`} />
          <circle className="mini-node green" cx="110" cy="220" r="9" />
          <circle className="mini-node red" cx="456" cy="72" r="9" />
        </>
      )}
    </svg>
  </div>
);

const landingCss = `
.skyport-landing {
  min-height: 100vh;
  color: #f8fafc;
  background: #111716;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  overflow-x: hidden;
}
.landing-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 48px;
  background: rgba(17, 23, 22, 0.6);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.brand,
.nav-link,
.nav-button,
.primary-action,
.secondary-action {
  font: inherit;
  cursor: pointer;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 0;
  background: transparent;
  color: #f8fafc;
  font-size: 1.08rem;
  font-weight: 900;
  letter-spacing: 0;
}
.brand-mark {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: #111716;
  background: #f8fafc;
}
.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.nav-link,
.nav-button {
  min-height: 42px;
  border-radius: 8px;
  padding: 10px 18px;
  font-weight: 800;
  letter-spacing: 0;
}
.nav-link {
  border: 1px solid rgba(255, 255, 255, 0.24);
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.04);
}
.nav-button {
  border: 1px solid #f8fafc;
  color: #111716;
  background: #f8fafc;
}
.hero {
  position: relative;
  min-height: 118vh;
  display: block;
  align-items: center;
  padding: 128px 54px 130px;
  overflow: hidden;
  background:
    radial-gradient(circle at 25% 26%, rgba(255, 255, 255, 0.08), transparent 20%),
    linear-gradient(135deg, #151b19 0%, #101615 100%);
}
.hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 4px 4px;
  opacity: 0.55;
  pointer-events: none;
}
.flight-scene {
  position: absolute;
  right: -18vw;
  bottom: -4vh;
  width: min(88vw, 1500px);
  height: 78vh;
  z-index: 2;
  transition: transform 80ms linear;
  will-change: transform;
  transform-origin: 46% 48%;
}
.white-wake {
  position: absolute;
  left: 19%;
  top: 12%;
  width: 128%;
  height: 118%;
  background: #f4f6f4;
  transform: skewX(26deg) rotate(2deg);
  border-radius: 8px;
  box-shadow: 0 34px 90px rgba(0, 0, 0, 0.24);
}
.aircraft-wrap {
  position: absolute;
  left: 0;
  top: 6%;
  width: 62%;
  z-index: 2;
}
.aircraft-wrap img {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 34px 48px rgba(16, 24, 32, 0.18));
  user-select: none;
  pointer-events: none;
}
.spark {
  position: absolute;
  z-index: 3;
  width: 28px;
  height: 28px;
  opacity: 0.5;
}
.spark::before,
.spark::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  background: #66706f;
  transform: translate(-50%, -50%);
}
.spark::before {
  width: 4px;
  height: 28px;
}
.spark::after {
  width: 28px;
  height: 4px;
}
.spark-one {
  left: 46%;
  top: 22%;
}
.spark-two {
  right: 9%;
  bottom: 22%;
}
.spark-three {
  left: 26%;
  bottom: 34%;
  transform: scale(0.68);
}
.hero-copy {
  position: relative;
  z-index: 4;
  max-width: 920px;
  padding-top: 58px;
}
.eyebrow {
  margin: 0 0 26px;
  color: #a8a454;
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0;
}
h1,
h2,
h3,
p {
  margin-top: 0;
}
.hero h1 {
  margin-bottom: 26px;
  color: rgba(248, 250, 252, 0.88);
  font-size: 7.8rem;
  line-height: 0.9;
  font-weight: 950;
  letter-spacing: 0;
  text-transform: uppercase;
}
.hero h1 span {
  color: rgba(167, 162, 75, 0.82);
}
.lead {
  max-width: 560px;
  margin-bottom: 36px;
  color: #aeb7b5;
  font-size: 1.08rem;
  line-height: 1.75;
}
.hero-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}
.primary-action,
.secondary-action {
  min-height: 52px;
  border-radius: 8px;
  padding: 14px 22px;
  font-weight: 900;
  letter-spacing: 0;
}
.primary-action {
  border: 1px solid #f8fafc;
  color: #111716;
  background: #f8fafc;
}
.secondary-action {
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.04);
}
.hero-meta {
  position: absolute;
  left: 54px;
  bottom: 42px;
  z-index: 3;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.hero-meta span {
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  padding: 10px 12px;
  color: #c4ccca;
  font-size: 0.76rem;
  font-weight: 850;
}
.aviation-age {
  position: relative;
  z-index: 4;
  min-height: 94vh;
  display: grid;
  align-content: center;
  padding: 112px 54px;
  background:
    radial-gradient(circle at 80% 20%, rgba(125, 211, 252, 0.12), transparent 24%),
    #111716;
  color: #f8fafc;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.section-kicker {
  width: fit-content;
  margin-bottom: 34px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 9px 14px;
  color: #9ba4a1;
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: uppercase;
}
.aviation-age h2 {
  max-width: 1060px;
  margin: 0;
  color: rgba(248, 250, 252, 0.92);
  font-size: 7.2rem;
  line-height: 0.92;
  font-weight: 950;
  letter-spacing: 0;
  text-transform: uppercase;
}
.aviation-age h2 span {
  display: block;
  color: rgba(167, 162, 75, 0.86);
  font-style: italic;
  font-weight: 400;
}
.age-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  max-width: 920px;
  margin-top: 56px;
}
.age-strip span {
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  padding: 18px;
  color: #cbd5d1;
  font-weight: 850;
}
.network-section {
  position: relative;
  min-height: 96vh;
  display: grid;
  grid-template-columns: 0.72fr 1.28fr;
  gap: 36px;
  align-items: center;
  padding: 96px 54px 112px;
  background:
    radial-gradient(circle at 74% 22%, rgba(182, 95, 112, 0.16), transparent 28%),
    #071312;
  color: #f8fafc;
}
.network-copy {
  position: relative;
  z-index: 2;
}
.network-copy p {
  margin: 0 0 14px;
  color: #a8a454;
  text-transform: uppercase;
  font-size: 0.78rem;
  font-weight: 950;
  letter-spacing: 0;
}
.network-copy h2 {
  margin: 0;
  font-size: 4.4rem;
  line-height: 0.96;
  font-weight: 950;
  letter-spacing: 0;
}
.network-copy span {
  display: block;
  max-width: 520px;
  margin-top: 28px;
  color: #aab5b2;
  line-height: 1.75;
}
.virtual-map {
  position: relative;
  min-height: 520px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #07151b;
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.34);
  overflow: hidden;
}
.virtual-map svg {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 520px;
}
.map-shoreline {
  fill: none;
  stroke: rgba(248, 250, 252, 0.16);
  stroke-width: 1.4;
}
.map-waterline {
  fill: none;
  stroke: rgba(125, 211, 252, 0.22);
  stroke-width: 1.2;
  stroke-dasharray: 8 12;
}
.network-route {
  fill: none;
  stroke: rgba(248, 250, 252, 0.26);
  stroke-width: 2.4;
  stroke-dasharray: 12 12;
}
.network-route-flow {
  fill: none;
  stroke: rgba(125, 211, 252, 0.82);
  stroke-width: 6;
  stroke-linecap: round;
  stroke-dasharray: 30 58;
  animation: mapFlow 7.5s ease-in-out infinite;
  filter: url(#routeGlow);
}
.analysis-ring {
  fill: rgba(125, 211, 252, 0.08);
  stroke: rgba(125, 211, 252, 0.45);
  stroke-width: 2;
  stroke-dasharray: 10 10;
}
.ring-b {
  fill: rgba(249, 115, 22, 0.08);
  stroke: rgba(249, 115, 22, 0.5);
}
.ring-c {
  fill: rgba(34, 197, 94, 0.07);
  stroke: rgba(34, 197, 94, 0.42);
}
.endpoint {
  stroke: #f8fafc;
  stroke-width: 3;
  filter: url(#routeGlow);
}
.endpoint-a {
  fill: #b65f70;
}
.endpoint-b,
.signal-dot {
  fill: #f97316;
}
.signal-dot {
  opacity: 0.92;
}
.map-label,
.map-tag {
  fill: rgba(248, 250, 252, 0.74);
  font-size: 18px;
  font-weight: 850;
  letter-spacing: 0;
}
.map-tag {
  fill: rgba(125, 211, 252, 0.78);
  font-size: 15px;
}
.gap-section {
  display: grid;
  grid-template-columns: 0.95fr 1.05fr;
  gap: 34px;
  padding: 112px 54px;
  background: #f2f4ef;
  color: #111716;
}
.gap-title p,
.unlock-heading p,
.perspective-copy > span,
.final-landing-cta p {
  margin: 0 0 14px;
  color: #25717d;
  text-transform: uppercase;
  font-size: 0.78rem;
  font-weight: 950;
  letter-spacing: 0;
}
.gap-title h2,
.unlock-heading h2,
.perspective-copy h2,
.final-landing-cta h2 {
  margin: 0;
  font-size: 4rem;
  line-height: 1;
  font-weight: 950;
  letter-spacing: 0;
}
.gap-grid {
  display: grid;
  gap: 14px;
}
.gap-card {
  min-height: 250px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-radius: 8px;
  border: 1px solid rgba(17, 23, 22, 0.12);
  background: #fff;
  padding: 24px;
  box-shadow: 0 18px 54px rgba(17, 23, 22, 0.08);
}
.gap-card span {
  width: fit-content;
  margin-bottom: auto;
  border-radius: 8px;
  background: #111716;
  color: #f8fafc;
  padding: 8px 10px;
  font-size: 0.72rem;
  font-weight: 900;
}
.gap-card h3 {
  max-width: 520px;
  margin-bottom: 12px;
  font-size: 2rem;
  line-height: 1;
}
.gap-card p {
  max-width: 560px;
  margin: 0;
  color: #5d6864;
  line-height: 1.65;
}
.simulation-section {
  padding: 112px 54px;
  background: #eef1ec;
  color: #111716;
}
.simulation-heading {
  max-width: 980px;
  margin-bottom: 36px;
}
.simulation-heading p {
  margin: 0 0 14px;
  color: #25717d;
  text-transform: uppercase;
  font-size: 0.78rem;
  font-weight: 950;
}
.simulation-heading h2 {
  margin: 0;
  font-size: 4.5rem;
  line-height: 0.98;
  font-weight: 950;
  letter-spacing: 0;
}
.step-showcase {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(360px, 44%);
  gap: 16px;
  overflow-x: auto;
  padding: 4px 0 20px;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
  scrollbar-color: rgba(17, 23, 22, 0.32) transparent;
}
.step-showcase::-webkit-scrollbar {
  height: 9px;
}
.step-showcase::-webkit-scrollbar-thumb {
  border-radius: 8px;
  background: rgba(17, 23, 22, 0.32);
}
.step-screen {
  scroll-snap-align: start;
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 540px;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid rgba(17, 23, 22, 0.12);
  background: #fff;
  box-shadow: 0 18px 54px rgba(17, 23, 22, 0.08);
}
.step-copy {
  padding: 24px 24px 18px;
}
.step-copy span {
  display: inline-flex;
  margin-bottom: 22px;
  color: #b65f70;
  font-weight: 950;
}
.step-copy h3 {
  margin-bottom: 12px;
  color: #111716;
  font-size: 1.8rem;
  line-height: 1;
}
.step-copy p {
  max-width: 520px;
  margin: 0;
  color: #5d6864;
  line-height: 1.62;
}
.mini-map {
  min-height: 300px;
  border-top: 1px solid rgba(17, 23, 22, 0.08);
  background: #eef4ef;
}
.mini-map svg {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 300px;
}
.select-box {
  fill: rgba(182, 95, 112, 0.12);
  stroke: rgba(182, 95, 112, 0.72);
  stroke-width: 2;
  stroke-dasharray: 10 8;
}
.mini-node {
  stroke: #f8fafc;
  stroke-width: 4;
}
.mini-node.blue {
  fill: #b65f70;
}
.mini-node.orange {
  fill: #f97316;
}
.mini-node.green {
  fill: #22c55e;
}
.mini-node.red {
  fill: #ef4444;
}
.mini-heat {
  stroke: rgba(17, 23, 22, 0.14);
  stroke-width: 1.2;
}
.mini-heat.high {
  fill: rgba(34, 197, 94, 0.48);
}
.mini-heat.mid {
  fill: rgba(234, 179, 8, 0.42);
}
.mini-heat.low {
  fill: rgba(239, 68, 68, 0.32);
}
.mini-nfz {
  fill: rgba(239, 68, 68, 0.22);
  stroke: rgba(239, 68, 68, 0.78);
  stroke-width: 2;
}
.mini-controlled {
  fill: rgba(182, 95, 112, 0.16);
  stroke: rgba(182, 95, 112, 0.7);
  stroke-width: 2;
}
.mini-route-base,
.mini-route-flow {
  fill: none;
  stroke-linecap: round;
}
.mini-route-base {
  stroke: rgba(17, 23, 22, 0.22);
  stroke-width: 10;
}
.mini-route-flow {
  stroke: #22c55e;
  stroke-width: 5;
  stroke-dasharray: 28 42;
  animation: mapFlow 8s ease-in-out infinite;
}
.unlock-section {
  padding: 112px 54px;
  background: #111716;
  color: #f8fafc;
}
.unlock-heading {
  max-width: 900px;
  margin-bottom: 42px;
}
.capability-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.capability-card {
  min-height: 270px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  padding: 24px;
}
.card-icon {
  margin-bottom: 28px;
  color: #e17b8f;
}
.capability-card h3 {
  margin-bottom: 12px;
  font-size: 1.16rem;
}
.capability-card p {
  margin: 0;
  color: #a9b6c2;
  line-height: 1.65;
}
.perspective-section {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: 0.78fr 1.22fr;
  gap: 44px;
  align-items: start;
  min-height: 82vh;
  padding: 112px 54px;
  background: #f2f4ef;
  color: #111716;
}
.perspective-copy {
  position: relative;
  z-index: 2;
}
.perspective-copy p {
  max-width: 560px;
  margin: 28px 0 0;
  color: #5d6864;
  line-height: 1.75;
}
.factor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.factor-card {
  min-height: 226px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-radius: 8px;
  border: 1px solid rgba(17, 23, 22, 0.12);
  background: #fff;
  padding: 22px;
  box-shadow: 0 16px 44px rgba(17, 23, 22, 0.07);
}
.factor-card span {
  color: #b65f70;
  font-size: 0.82rem;
  font-weight: 950;
}
.factor-card h3 {
  margin: 46px 0 12px;
  color: #111716;
  font-size: 1.35rem;
  line-height: 1.05;
}
.factor-card p {
  margin: 0;
  color: #5d6864;
  font-size: 0.94rem;
  line-height: 1.6;
}
.final-landing-cta {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 32px;
  align-items: center;
  padding: 82px 54px;
  background: #111716;
  color: #f8fafc;
}
.final-landing-cta h2 {
  max-width: 860px;
}
.final-landing-cta button {
  min-height: 56px;
  border: 1px solid #f8fafc;
  border-radius: 8px;
  background: #f8fafc;
  color: #111716;
  padding: 16px 24px;
  font: inherit;
  font-weight: 950;
  cursor: pointer;
}
@keyframes mapFlow {
  to {
    stroke-dashoffset: -1010;
  }
}
@media (max-width: 1120px) {
  .hero {
    min-height: 108vh;
    padding: 112px 28px 120px;
  }
  .flight-scene {
    right: -48vw;
    bottom: -2vh;
    width: 150vw;
    opacity: 0.66;
  }
  .hero-copy {
    max-width: 760px;
  }
  .hero h1 {
    font-size: 5rem;
  }
  .aviation-age h2 {
    font-size: 5.2rem;
  }
  .gap-section,
  .network-section,
  .perspective-section,
  .final-landing-cta {
    grid-template-columns: 1fr;
  }
  .capability-grid,
  .age-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 720px) {
  .landing-nav {
    padding: 16px 18px;
  }
  .nav-actions {
    gap: 8px;
  }
  .nav-link {
    display: none;
  }
  .hero {
    min-height: 106vh;
    padding: 98px 18px 118px;
  }
  .flight-scene {
    right: -86vw;
    bottom: 0;
    width: 210vw;
    height: 64vh;
    opacity: 0.5;
  }
  .hero h1 {
    font-size: 3.25rem;
  }
  .lead {
    font-size: 1rem;
  }
  .hero-actions {
    align-items: stretch;
    flex-direction: column;
  }
  .hero-meta {
    left: 18px;
    right: 18px;
    bottom: 28px;
  }
  .aviation-age,
  .network-section,
  .gap-section,
  .simulation-section,
  .unlock-section,
  .perspective-section,
  .final-landing-cta {
    padding: 72px 18px;
  }
  .aviation-age h2 {
    font-size: 3.1rem;
  }
  .capability-grid,
  .age-strip,
  .network-section,
  .gap-section,
  .perspective-section,
  .final-landing-cta {
    grid-template-columns: 1fr;
  }
  .gap-title h2,
  .simulation-heading h2,
  .unlock-heading h2,
  .perspective-copy h2,
  .final-landing-cta h2 {
    font-size: 2.55rem;
  }
  .step-showcase {
    grid-auto-columns: minmax(286px, 86%);
  }
  .step-screen {
    min-height: 520px;
  }
  .factor-grid {
    grid-template-columns: 1fr;
    margin-top: 18px;
  }
}
`;

export default LandingPage;
