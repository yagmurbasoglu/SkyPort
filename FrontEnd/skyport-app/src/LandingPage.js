import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import HexagonIcon from '@mui/icons-material/Hexagon';
import RadarIcon from '@mui/icons-material/Radar';
import BlockIcon from '@mui/icons-material/Block';
import ApartmentIcon from '@mui/icons-material/Apartment';
import DirectionsTransitIcon from '@mui/icons-material/DirectionsTransit';
import AirIcon from '@mui/icons-material/Air';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';

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
    icon: <BlockIcon />,
    title: 'No-fly zones',
    text: 'Restricted airspace is shown on the map and treated as a blocker during route validation.',
  },
  {
    icon: <RadarIcon />,
    title: 'Controlled airspace',
    text: 'Controlled zones remain visible so experts can understand where approval constraints exist.',
  },
  {
    icon: <ApartmentIcon />,
    title: 'Obstacle exposure',
    text: 'Buildings and obstacle signals influence suitability and route warnings for selected corridors.',
  },
  {
    icon: <DirectionsTransitIcon />,
    title: 'Transport access',
    text: 'Candidate cells are evaluated against surrounding mobility access and operational usefulness.',
  },
  {
    icon: <AirIcon />,
    title: 'Weather layer',
    text: 'Open-Meteo wind data, including elevated wind layers, informs route safety checks.',
  },
  {
    icon: <AutoGraphIcon />,
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

const DataParticles = ({ scrollProgress }) => {
  const particles = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 120 - 10}%`,
      size: Math.random() * 12 + 4,
      duration: Math.random() * 8 + 4,
      delay: Math.random() * -10,
      isPink: Math.random() > 0.7,
      depth: Math.random() * 1.5 + 0.5,
    }));
  }, []);

  return (
    <div className="particles-container" aria-hidden="true">
      {particles.map((p) => (
        <div key={p.id} className="particle-wrapper" style={{ left: p.left, top: p.top, transform: `translateY(${scrollProgress * p.depth * -200}px)` }}>
          <div className={`particle ${p.isPink ? 'pink-particle' : ''}`} style={{ width: `${p.size}px`, height: `${p.size}px`, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }} />
        </div>
      ))}
    </div>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [gapInView, setGapInView] = useState(false);
  const gapRef = useRef(null);

  useEffect(() => {
    const updateProgress = () => {
      const progress = Math.min(window.scrollY / 760, 1);
      setScrollProgress(progress);
    };

    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    return () => window.removeEventListener('scroll', updateProgress);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setGapInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    if (gapRef.current) observer.observe(gapRef.current);
    return () => observer.disconnect();
  }, []);

  const flightSceneStyle = {
    transform: `translate3d(${scrollProgress * 120}px, ${scrollProgress * -320}px, 0) scale(${1 + scrollProgress * 0.4}) rotate(${-5 - scrollProgress * 5}deg)`,
  };

  return (
    <div className="skyport-landing">
      <style>{landingCss}</style>


      <nav className="landing-nav">
        <button className="brand" onClick={() => navigate('/')} aria-label="SkyPort home">
          <span className="brand-mark">
            <img src="/skyport-logo.png" alt="SkyPort Logo" />
          </span>
          <span>SkyPort</span>
        </button>
        <div className="nav-actions">
          <button className="nav-link" onClick={() => navigate('/auth', { state: { mode: 'login' } })}>Login</button>
          <button className="nav-button" onClick={() => navigate('/auth', { state: { mode: 'register' } })}>Create account</button>
        </div>
      </nav>

      <main>
        <section className="hero">
          <DataParticles scrollProgress={scrollProgress} />
          <div className="flight-scene" style={flightSceneStyle} aria-hidden="true">
            <div className="white-wake" />
            <div className="aircraft-wrap">
              <img src="/aircar_real.png" alt="Aircar eVTOL" />
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
            <div className="age-card">
              <h4>eVTOL corridors</h4>
              <p>Designated low-altitude urban airways bypassing ground traffic.</p>
            </div>
            <div className="age-card">
              <h4>Vertiport networks</h4>
              <p>Strategically placed hubs for seamless takeoffs and landings.</p>
            </div>
            <div className="age-card">
              <h4>Data-led safety</h4>
              <p>Real-time analytics ensuring secure, noise-compliant flight paths.</p>
            </div>
          </div>
        </section>

        <IstanbulNetworkMap />

        <section className="gap-section" ref={gapRef}>
          <div className="gap-title">
            <p>But there is a gap.</p>
            <h2>Air mobility needs one place for site analysis, map layers and route simulation.</h2>
          </div>
          <div className={`gap-grid ${gapInView ? 'in-view' : ''}`}>
            {gapCards.map((card, index) => (
              <article className="gap-card" key={card.title} style={{ transitionDelay: `${index * 0.15}s` }}>
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
                <div className="factor-icon">{factor.icon}</div>
                <span>{factor.title}</span>
                <h3>{factor.text}</h3>
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
            <circle cx="8" cy="8" r="3.2" fill="#b65f70" opacity="0.35" />
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

        <rect width="1180" height="620" rx="18" fill="#020617" />
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

        <circle className="pulse-ring" cx="170" cy="444" r="13" />
        <circle className="endpoint endpoint-a" cx="170" cy="444" r="13" />
        <circle className="pulse-ring" cx="1010" cy="176" r="13" />
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
          <path d="M14 0 L28 7 L28 17 L14 24 L0 17 L0 7 Z" fill="none" stroke="rgba(182, 95, 112, 0.15)" strokeWidth="1" />
        </pattern>
        <filter id={`miniGlow-${variant}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="520" height="300" fill="#010410" />
      <rect width="520" height="300" fill={`url(#miniGrid-${variant})`} />
      <path d="M0 212 C86 170 136 196 190 158 C248 116 310 142 370 112 C430 82 476 76 520 54 L520 300 L0 300 Z" fill="rgba(225, 123, 143, 0.12)" />

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
  color: #f1f5f9;
  background: #020617;
  font-family: Inter, sans-serif;
  overflow-x: hidden;
}
.landing-nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 60px;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(24px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 0;
  background: transparent;
  color: #ffffff;
  cursor: pointer;
}
.brand span { font-weight: 900; font-size: 1.2rem; letter-spacing: 1px; }
.brand span span { color: #e17b8f; }
.brand-mark {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: #fff;
  background: transparent;
  overflow: hidden;
}
.brand-mark img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  mix-blend-mode: lighten;
  filter: drop-shadow(0 0 8px rgba(182, 95, 112, 0.5));
}
.nav-actions { display: flex; align-items: center; gap: 12px; }
.nav-link, .nav-button {
  min-height: 42px;
  border-radius: 8px;
  padding: 10px 18px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.3s ease;
}
.nav-link {
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  background: rgba(255, 255, 255, 0.04);
}
.nav-button {
  border: none;
  color: #ffffff;
  background: #e17b8fff;
}
.nav-link:hover, .nav-button:hover {
  box-shadow: 0 0 24px rgba(225, 123, 143, 0.6);
  transform: translateY(-1px);
}

.hero {
  position: relative;
  min-height: 118vh;
  display: flex;
  align-items: center;
  padding: 128px 60px;
  overflow: hidden;
  background:
    radial-gradient(circle at 85% 40%, rgba(225, 123, 143, 0.5), transparent 60%),
    linear-gradient(to top, rgba(225, 123, 143, 0.1) 0%, transparent 35%),
    linear-gradient(135deg, #020617 0%, #0f172a 100%);
}
.particles-container { position: absolute; inset: 0; z-index: 1; overflow: hidden; pointer-events: none; }
.particle-wrapper { position: absolute; will-change: transform; transition: transform 80ms linear; }
.particle { background: rgba(255,255,255,0.4); border-radius: 50%; animation: floatParticle linear infinite; box-shadow: 0 0 12px rgba(255,255,255,0.4); }
.pink-particle { background: #e17b8f; box-shadow: 0 0 20px rgba(225, 123, 143, 0.9); opacity: 0.85; }
@keyframes floatParticle {
  0%, 100% { transform: translate(0, 0); opacity: 0.2; }
  33% { transform: translate(15px, -20px); opacity: 0.8; }
  66% { transform: translate(-10px, -40px); opacity: 0.4; }
}

.hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
  background-size: 30px 30px;
  opacity: 0.5;
  pointer-events: none;
}
.flight-scene {
  position: absolute;
  right: -24vw;
  bottom: 0vh;
  width: min(88vw, 1500px);
  height: 78vh;
  z-index: 2;
  transition: transform 80ms linear;
  will-change: transform;
}
.white-wake {
  position: absolute;
  left: 19%; top: 10%; width: 128%; height: 128%;
  background: #ff8da1ff;
  opacity: 0.3;
  transform: skewX(15deg) rotate(0deg);
  border-radius: 8px;
  box-shadow: 0 0 150px rgba(225, 123, 143, 0.5);
}
.aircraft-wrap { position: absolute; left: 0; top: 6%; width: 62%; z-index: 2; }
.aircraft-wrap img { width: 100%; height: auto; filter: drop-shadow(0 34px 48px rgba(0,0,0,0.6)); }
.spark { position: absolute; z-index: 3; width: 28px; height: 28px; opacity: 0.3; }
.spark::before, .spark::after { content: ""; position: absolute; left: 50%; top: 50%; background: #e17b8f; transform: translate(-50%, -50%); }
.spark::before { width: 2px; height: 28px; }
.spark::after { width: 28px; height: 2px; }
.spark-one { left: 46%; top: 22%; }
.spark-two { right: 9%; bottom: 22%; }
.spark-three { left: 26%; bottom: 34%; transform: scale(0.68); }

.hero-copy { position: relative; z-index: 4; max-width: 800px; opacity: 0; animation: cinematicReveal 1.2s cubic-bezier(0.2, 0, 0.2, 1) 0.2s forwards; }
@keyframes cinematicReveal { 0% { opacity: 0; transform: translateY(30px) scale(0.98); filter: blur(10px); } 100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); } }
.eyebrow { color: #e17b8f; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; font-size: 0.8rem; margin-bottom: 24px; }
.hero h1 { font-size: 5.4rem; font-weight: 900; line-height: 0.95; margin-bottom: 32px; text-transform: uppercase; }
.hero h1 span { color: #e17b8f; }
.lead { max-width: 540px; margin-bottom: 48px; color: #cbd5e1; font-size: 1.15rem; line-height: 1.7; }
.hero-actions { display: flex; gap: 16px; }
.primary-action { background: #e17b8f; color: #fff; border: none; padding: 16px 36px; border-radius: 12px; font-weight: 800; cursor: pointer; box-shadow: 0 10px 30px rgba(225, 123, 143, 0.4); transition: all 0.3s ease; }
.secondary-action { background: rgba(255, 255, 255, 0.05); color: #fff; border: 1px solid rgba(255, 255, 255, 0.15); padding: 16px 36px; border-radius: 12px; font-weight: 800; cursor: pointer; transition: all 0.3s ease; }
.primary-action:hover, .secondary-action:hover {
  box-shadow: 0 0 28px rgba(225, 123, 143, 0.6);
  transform: translateY(-2px);
}

.hero-meta { position: absolute; left: 60px; bottom: 42px; z-index: 4; display: flex; gap: 24px; }
.hero-meta span { border-left: 2px solid #e17b8f; padding-left: 12px; color: #cbd5e1; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; opacity: 0.5; }

.aviation-age { padding: 112px 60px; background: #020617; color: #ffffff; border-top: 1px solid rgba(255, 255, 255, 0.05); }
.section-kicker { color: #e17b8f; font-weight: 800; text-transform: uppercase; font-size: 0.75rem; margin-bottom: 34px; border: 1px solid rgba(225, 123, 143, 0.3); padding: 8px 14px; border-radius: 8px; width: fit-content; }
.aviation-age h2 { font-size: 5rem; font-weight: 900; line-height: 1; text-transform: uppercase; }
.aviation-age h2 span { display: block; color: #e17b8f; font-style: italic; font-weight: 400; }
.age-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; max-width: 920px; margin-top: 56px; }
.age-card { border-radius: 8px; border: 1px solid rgba(225, 123, 143, 0.3); background: rgba(225, 123, 143, 0.04); padding: 18px; color: #cbd5e1; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); cursor: default; }
.age-card h4 { font-weight: 800; font-size: 1.1rem; margin: 0; color: #e17b8f; transition: color 0.3s ease; }
.age-card:hover { background: rgba(225, 123, 143, 0.15); border-color: rgba(225, 123, 143, 0.6); box-shadow: 0 8px 30px rgba(225, 123, 143, 0.25); transform: translateY(-4px); }
.age-card:hover h4 { color: #ff8da1; }
.age-card p { margin: 0; font-size: 0.9rem; line-height: 1.5; color: #ff8da1; max-height: 0; opacity: 0; overflow: hidden; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
.age-card:hover p { max-height: 100px; opacity: 0.9; margin-top: 12px; }

.network-section { display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 60px; padding: 120px 60px; background: #010410; }
.network-copy h2 { font-size: 3.6rem; font-weight: 900; line-height: 1; margin: 14px 0 28px; }
.network-copy p { color: #e17b8f; font-weight: 900; text-transform: uppercase; font-size: 0.75rem; }
.network-copy span { color: #cbd5e1; line-height: 1.7; opacity: 0.7; }
.virtual-map { background: #020617; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.05); overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,0.6); }
.map-shoreline { fill: none; stroke: rgba(255,255,255,0.1); stroke-width: 1.5; }
.map-waterline { fill: none; stroke: rgba(225, 123, 143, 0.2); stroke-width: 1.2; stroke-dasharray: 8 12; }
.network-route { fill: none; stroke: rgba(255,255,255,0.15); stroke-width: 2.5; stroke-dasharray: 12 12; }
.network-route-flow { fill: none; stroke: #e17b8f; stroke-width: 6; stroke-linecap: round; stroke-dasharray: 40 100; animation: mapFlow 6s linear infinite; filter: url(#routeGlow); transition: all 0.4s ease; }
.virtual-map:hover .network-route-flow { stroke: #ff8da1; animation: mapFlow 2s linear infinite; stroke-width: 8; }
@keyframes mapFlow { from { stroke-dashoffset: 140; } to { stroke-dashoffset: 0; } }
.analysis-ring { fill: rgba(225, 123, 143, 0.05); stroke: rgba(225, 123, 143, 0.3); stroke-width: 2; stroke-dasharray: 10 10; }
.pulse-ring { fill: transparent; stroke: #e17b8f; stroke-width: 2; transform-box: fill-box; transform-origin: center; animation: expandPulse 2.5s infinite cubic-bezier(0.2, 0, 0.2, 1); }
@keyframes expandPulse { 0% { transform: scale(1); opacity: 1; stroke-width: 4; } 100% { transform: scale(3.5); opacity: 0; stroke-width: 0; } }
.endpoint { stroke: #fff; stroke-width: 3; fill: #e17b8f; filter: url(#routeGlow); transition: all 0.4s ease; }
.virtual-map:hover .endpoint { fill: #ff8da1; transform-box: fill-box; transform-origin: center; transform: scale(1.15); }
.signal-dot { fill: #e17b8f; opacity: 0.6; }

.gap-section { padding: 120px 60px; background: #020617; }
.gap-title h2 { font-size: 3rem; font-weight: 900; margin: 12px 0 60px; max-width: 800px; text-transform: uppercase; }
.gap-title p { color: #e17b8f; font-weight: 900; text-transform: uppercase; font-size: 0.75rem; }
.gap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.gap-card { background: rgba(255, 255, 255, 0.02); padding: 40px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.05); opacity: 0; transform: translateY(40px); transition: all 0.8s cubic-bezier(0.2, 0, 0.2, 1); }
.gap-grid.in-view .gap-card { opacity: 1; transform: translateY(0); }
.gap-card span { color: #e17b8f; font-weight: 900; font-size: 0.65rem; text-transform: uppercase; margin-bottom: 12px; display: block; }
.gap-card h3 { font-size: 1.5rem; margin-bottom: 16px; }

.simulation-section { padding: 120px 60px; background: #010410; }
.simulation-heading h2 { font-size: 3.2rem; font-weight: 900; margin: 12px 0 60px; text-transform: uppercase; }
.simulation-heading p { color: #e17b8f; font-weight: 900; text-transform: uppercase; font-size: 0.75rem; }

.step-showcase {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(360px, 44%);
  gap: 16px;
  overflow-x: auto;
  padding: 4px 0 20px;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}
.step-showcase::-webkit-scrollbar { height: 9px; }
.step-showcase::-webkit-scrollbar-thumb { border-radius: 8px; background: rgba(255, 255, 255, 0.1); }

.step-screen {
  scroll-snap-align: start;
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 540px;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #020617;
  box-shadow: 0 18px 54px rgba(0, 0, 0, 0.5);
}

.step-copy { padding: 24px 24px 18px; }
.step-copy span { display: inline-flex; margin-bottom: 22px; color: #e17b8f; font-weight: 950; }
.step-copy h3 { margin-bottom: 12px; color: #ffffff; font-size: 1.8rem; line-height: 1; }
.step-copy p { max-width: 520px; margin: 0; color: #cbd5e1; line-height: 1.62; }

.mini-map { min-height: 300px; border-top: 1px solid rgba(255, 255, 255, 0.08); background: #010410; }
.select-box { fill: rgba(225, 123, 143, 0.12); stroke: rgba(225, 123, 143, 0.72); stroke-width: 2; stroke-dasharray: 10 8; }
.mini-node { stroke: #020617; stroke-width: 4; }
.mini-node.blue { fill: #e17b8f; }
.mini-node.orange { fill: #ff8da1; }
.mini-node.green { fill: #e17b8f; }
.mini-node.red { fill: #944b59; }
.mini-heat.high { fill: rgba(225, 123, 143, 0.48); }
.mini-heat.mid { fill: rgba(255, 141, 161, 0.42); }
.mini-heat.low { fill: rgba(148, 75, 89, 0.32); }
.mini-nfz { fill: rgba(148, 75, 89, 0.22); stroke: rgba(148, 75, 89, 0.78); stroke-width: 2; }
.mini-controlled { fill: rgba(225, 123, 143, 0.16); stroke: rgba(225, 123, 143, 0.7); stroke-width: 2; }
.mini-route-flow { fill: none; stroke-linecap: round; }
.mini-route-base { stroke: rgba(255, 255, 255, 0.1); stroke-width: 10; }
.mini-route-flow { stroke: #e17b8f; stroke-width: 5; stroke-dasharray: 28 42; animation: mapFlow 8s ease-in-out infinite; }

.unlock-section { padding: 120px 60px; background: #020617; }
.unlock-heading h2 { font-size: 3rem; font-weight: 900; margin: 12px 0 60px; text-transform: uppercase; }
.unlock-heading p { color: #e17b8f; font-weight: 900; text-transform: uppercase; font-size: 0.75rem; }
.capability-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
.capability-card { 
  background: rgba(225, 123, 143, 0.65); 
  backdrop-filter: blur(22spx);
  padding: 32px; 
  border-radius: 24px; 
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease; 
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}
.capability-card:hover { transform: translateY(-10px); background: rgba(225, 123, 143, 0.9); border-color: rgba(255, 255, 255, 0.2); }
.capability-card h3 { color: #020617; }
.capability-card p { color: #020617; opacity: 0.8; }
.card-icon { color: #020617; margin-bottom: 24px; }

.perspective-section { padding: 120px 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; background: #010410; }
.perspective-copy h2 { font-size: 3.4rem; font-weight: 900; line-height: 1; margin: 20px 0 32px; text-transform: uppercase; }
.perspective-copy span { color: #e17b8f; font-weight: 900; }
.factor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.factor-card { 
  border-top: 1px solid rgba(225, 123, 143, 0.3); 
  padding-top: 34px; 
  background: transparent;
  transition: all 0.4s ease;
  display: flex;
  flex-direction: column;
}
.factor-card:hover {
  border-top-color: #ff8da1;
  transform: translateY(-4px);
}
.factor-icon { color: #ff8da1; margin-bottom: 20px; font-size: 1.8rem; }
.factor-card span { color: #ff8da1; font-weight: 900; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
.factor-card h3 { font-size: 1.05rem; margin: 0; line-height: 1.6; color: #cbd5e1; font-weight: 400; }

.final-landing-cta { padding: 120px 60px; background: #020617; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05); }
.final-landing-cta h2 { font-size: 3.2rem; font-weight: 900; margin: 12px 0 48px; text-transform: uppercase; }
.final-landing-cta p { color: #e17b8f; font-weight: 900; text-transform: uppercase; }
.final-landing-cta button { background: #e17b8f; color: #fff; border: none; padding: 20px 60px; border-radius: 16px; font-weight: 900; font-size: 1.1rem; cursor: pointer; box-shadow: 0 10px 40px rgba(225, 123, 143, 0.4); transition: all 0.3s ease; }
.final-landing-cta button:hover {
  box-shadow: 0 0 32px rgba(225, 123, 143, 0.6);
  transform: translateY(-2px);
}

.landing-footer { padding: 80px 60px 40px; background: #010410; border-top: 1px solid rgba(255, 255, 255, 0.05); }
.footer-content { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
.footer-links { display: flex; gap: 32px; }
.footer-links a { color: #ffffff; opacity: 0.5; text-decoration: none; font-size: 0.9rem; }
.footer-bottom { border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 40px; text-align: center; font-size: 0.8rem; opacity: 0.3; }

`;

export default LandingPage;
