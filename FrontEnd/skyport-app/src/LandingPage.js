import React from 'react';
import { useNavigate } from 'react-router-dom';
import HexagonIcon from '@mui/icons-material/Hexagon';
import MemoryIcon from '@mui/icons-material/Memory';
import MapIcon from '@mui/icons-material/Map';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import StorageIcon from '@mui/icons-material/Storage';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import PersonIcon from '@mui/icons-material/Person';
import ArchitectureIcon from '@mui/icons-material/Architecture';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

const LandingPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white flex flex-col font-sans overflow-x-hidden w-full">
      {/* NAVBAR */}
      <nav className="flex justify-between items-center px-12 py-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/10 flex items-center justify-center border border-gray-600 rotate-45">
            <span className="rotate-[-45deg] font-bold">X</span>
          </div>
          <span className="text-xl font-bold tracking-tighter italic">SKY PORT</span>
        </div>
        <div className="flex gap-4">
          <button onClick={() => navigate('/auth')} className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 transition">Login</button>
          <button onClick={() => navigate('/auth')} className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 transition">Register</button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="min-h-[calc(100vh-100px)] flex flex-col items-center justify-center text-center px-4 py-16 relative">
        {/* Decorative background gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none"></div>
        
        {/* Üstteki Küçük Badge */}
        <div className="bg-gray-800/50 border border-gray-700 px-4 py-1 rounded-full text-xs flex items-center gap-2 mb-8 z-10 backdrop-blur-sm">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Istanbul Pilot Region - UAM Decision Support System
        </div>

        {/* Ana Başlıklar */}
        <div className="z-10">
          <h1 className="text-6xl md:text-8xl font-black mb-2 tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">SKY</span> PORT
          </h1>
          <h2 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight drop-shadow-lg">
            VERTIPORT <br /> ANALYSIS PLATFORM
          </h2>

          {/* Açıklama Metni */}
          <p className="max-w-2xl mx-auto text-gray-400 text-lg mb-10 leading-relaxed">
            SkyPort is a bidirectional Decision Support System that provides data-driven vertiport 
            site selection for experts, while offering passengers the opportunity to explore 
            Istanbul's next-generation air taxi network.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <button
              onClick={() => navigate('/auth')}
              className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 px-8 py-4 rounded-lg text-lg font-bold transition-all duration-300 transform hover:scale-105 shadow-[0_0_20px_rgba(37,99,235,0.4)]"
            >
              <span className="text-xl">⬡</span> Start Analysis
            </button>
          </div>
        </div>
      </section>

      {/* WHY SKYPORT SECTION */}
      <section className="py-24 px-8 md:px-16 w-full max-w-7xl mx-auto z-10">
        <div className="mb-12">
          <p className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-2">Key Features</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">WHY <span className="text-blue-500">SKYPORT?</span></h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-[#121826]/80 backdrop-blur-md p-6 rounded-2xl border border-gray-800 hover:border-gray-700 hover:shadow-[0_0_25px_rgba(37,99,235,0.15)] flex flex-col transition-all duration-300 group">
            <div className="text-blue-500 mb-6 group-hover:scale-110 transition-transform origin-left"><HexagonIcon fontSize="large" /></div>
            <h3 className="text-xl font-bold mb-3 text-white">H3 Hexagonal Grid Analysis</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed flex-1">
              The analysis region is divided into hexagonal cells using the Uber H3 library; an independent suitability score is calculated for each cell.
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1 bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs rounded-full font-medium">H3</span>
              <span className="px-3 py-1 bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs rounded-full font-medium">PostGIS</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-[#121826]/80 backdrop-blur-md p-6 rounded-2xl border border-gray-800 hover:border-gray-700 hover:shadow-[0_0_25px_rgba(37,99,235,0.15)] flex flex-col transition-all duration-300 group">
            <div className="text-blue-500 mb-6 group-hover:scale-110 transition-transform origin-left"><MemoryIcon fontSize="large" /></div>
            <h3 className="text-xl font-bold mb-3 text-white">Dynamic MCDM Algorithm</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed flex-1">
              AHP and TOPSIS methods simultaneously evaluate obstacle constraints, transportation access, noise sensitivity, and socioeconomic factors.
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1 bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs rounded-full font-medium">AHP</span>
              <span className="px-3 py-1 bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs rounded-full font-medium">TOPSIS</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-[#121826]/80 backdrop-blur-md p-6 rounded-2xl border border-gray-800 hover:border-gray-700 hover:shadow-[0_0_25px_rgba(37,99,235,0.15)] flex flex-col transition-all duration-300 group">
            <div className="text-blue-500 mb-6 group-hover:scale-110 transition-transform origin-left"><MapIcon fontSize="large" /></div>
            <h3 className="text-xl font-bold mb-3 text-white">Interactive Heatmap</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed flex-1">
              Color-coded heatmap visualization on Mapbox GL JS, detailed criterion-based analysis by clicking on cells.
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1 bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs rounded-full font-medium">Mapbox</span>
              <span className="px-3 py-1 bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs rounded-full font-medium">GeoJSON</span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-[#121826]/80 backdrop-blur-md p-6 rounded-2xl border border-gray-800 hover:border-gray-700 hover:shadow-[0_0_25px_rgba(37,99,235,0.15)] flex flex-col transition-all duration-300 group">
            <div className="text-blue-500 mb-6 group-hover:scale-110 transition-transform origin-left"><AltRouteIcon fontSize="large" /></div>
            <h3 className="text-xl font-bold mb-3 text-white">Safe Route Simulation</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed flex-1">
              Optimal flight corridor calculated between two selected Vertiport points, considering 3D building obstacles (mania) and restricted flight zones (NFZ).
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1 bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs rounded-full font-medium">Route</span>
              <span className="px-3 py-1 bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs rounded-full font-medium">A* Algorithm</span>
            </div>
          </div>

          {/* Card 5 */}
          <div className="bg-[#121826]/80 backdrop-blur-md p-6 rounded-2xl border border-gray-800 hover:border-gray-700 hover:shadow-[0_0_25px_rgba(37,99,235,0.15)] flex flex-col transition-all duration-300 group">
            <div className="text-blue-500 mb-6 group-hover:scale-110 transition-transform origin-left"><StorageIcon fontSize="large" /></div>
            <h3 className="text-xl font-bold mb-3 text-white">Open Source Data</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed flex-1">
              OpenStreetMap, IETT route network, and DHMI NFZ database integration; automatic data retrieval with OSMnx.
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1 bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs rounded-full font-medium">OSM</span>
              <span className="px-3 py-1 bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs rounded-full font-medium">OSMnx</span>
            </div>
          </div>

          {/* Card 6 */}
          <div className="bg-[#121826]/80 backdrop-blur-md p-6 rounded-2xl border border-gray-800 hover:border-gray-700 hover:shadow-[0_0_25px_rgba(37,99,235,0.15)] flex flex-col transition-all duration-300 group">
            <div className="text-blue-500 mb-6 group-hover:scale-110 transition-transform origin-left"><CompareArrowsIcon fontSize="large" /></div>
            <h3 className="text-xl font-bold mb-3 text-white">Location Comparison</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed flex-1">
              Compare multiple candidate Vertiport locations side-by-side based on criteria; make data-driven final decisions.
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1 bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs rounded-full font-medium">Dashboard</span>
              <span className="px-3 py-1 bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs rounded-full font-medium">React</span>
            </div>
          </div>

          {/* Card 7 */}
          <div className="bg-[#121826]/80 backdrop-blur-md p-6 rounded-2xl border border-gray-800 hover:border-gray-700 hover:shadow-[0_0_25px_rgba(37,99,235,0.15)] flex flex-col transition-all duration-300 group">
            <div className="text-blue-500 mb-6 group-hover:scale-110 transition-transform origin-left"><PersonIcon fontSize="large" /></div>
            <h3 className="text-xl font-bold mb-3 text-white">Passenger Experience (B2C)</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed flex-1">
              View active network with user-friendly interface, filter by distance/budget, and manage favorites.
            </p>
            <div className="flex gap-2 flex-wrap mt-auto">
              <span className="px-3 py-1 bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs rounded-full font-medium">B2C</span>
            </div>
          </div>

          {/* Card 8 */}
          <div className="bg-[#121826]/80 backdrop-blur-md p-6 rounded-2xl border border-gray-800 hover:border-gray-700 hover:shadow-[0_0_25px_rgba(37,99,235,0.15)] flex flex-col transition-all duration-300 group md:col-span-2 lg:col-span-2">
            <div className="text-blue-500 mb-6 group-hover:scale-110 transition-transform origin-left"><ArchitectureIcon fontSize="large" /></div>
            <h3 className="text-xl font-bold mb-3 text-white">Dual-Architecture</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed flex-1">
              Vertiports analyzed and approved by experts are instantly integrated into the passenger map (live system).
            </p>
            <div className="flex gap-2 flex-wrap mt-auto">
              <span className="px-3 py-1 bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs rounded-full font-medium">Experts</span>
              <span className="px-3 py-1 bg-blue-900/40 border border-blue-800/50 text-blue-300 text-xs rounded-full font-medium">B2C</span>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section className="py-24 px-8 md:px-16 w-full max-w-5xl mx-auto z-10">
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-20 text-center">HOW IT <span className="text-blue-500">WORKS?</span></h2>
        
        {/* For Passengers Timeline */}
        <div className="mb-20">
          <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mb-10 w-full md:w-32 py-1 px-3 border border-gray-700 rounded bg-[#121826]">For Passengers</p>
          <div className="flex flex-col md:flex-row justify-between relative gap-8 md:gap-0">
            {/* Timeline line */}
            <div className="absolute top-6 left-0 w-full h-[2px] bg-gray-800 -z-10 hidden md:block"></div>
            
            {/* Steps */}
            {[
              { num: 1, text: "View Active Network" },
              { num: 2, text: "Filter by Needs" },
              { num: 3, text: "Save Favorites" },
              { num: 4, text: "Plan Route" },
            ].map((step, idx) => (
              <div key={idx} className="flex flex-col items-center bg-[#0a0f1a] md:px-4 text-center md:flex-1 relative group">
                <div className="absolute top-6 left-1/2 w-full h-[2px] bg-blue-600/0 md:group-hover:bg-blue-600/50 transition-all duration-500 -z-10 hidden md:block group-last:hidden"></div>
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center font-black text-xl mb-6 shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-transform group-hover:scale-110">
                  {step.num}
                </div>
                <div className="px-5 py-3 bg-[#121826] border border-gray-800 rounded-lg text-sm text-gray-300 font-bold shadow-lg w-full max-w-[180px]">
                  {step.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* For Experts Timeline */}
        <div className="mb-24">
          <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mb-10 w-full md:w-28 py-1 px-3 border border-gray-700 rounded bg-[#121826]">For Experts</p>
          <div className="flex flex-col md:flex-row justify-between relative gap-8 md:gap-0">
            {/* Timeline line */}
            <div className="absolute top-6 left-0 w-full h-[2px] bg-gray-800 -z-10 hidden md:block"></div>
            
            {/* Steps */}
            {[
              { num: 1, text: "Select Region" },
              { num: 2, text: "Fetch Data" },
              { num: 3, text: "Adjust Weights" },
              { num: 4, text: "Simulate" },
              { num: 5, text: "Visualize" },
            ].map((step, idx) => (
              <div key={idx} className="flex flex-col items-center bg-[#0a0f1a] md:px-2 text-center md:flex-1 relative group">
                <div className="absolute top-6 left-1/2 w-full h-[2px] bg-blue-600/0 md:group-hover:bg-blue-600/50 transition-all duration-500 -z-10 hidden md:block group-last:hidden"></div>
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center font-black text-xl mb-6 shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-transform group-hover:scale-110">
                  {step.num}
                </div>
                <div className="text-sm text-gray-300 font-bold max-w-[150px]">
                  {step.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Banner */}
        <div className="bg-gradient-to-br from-[#1a233a] to-[#0f1523] border border-gray-700 p-12 rounded-3xl text-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          {/* Decorative shine */}
          <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-blue-400/10 to-transparent skew-x-12 group-hover:left-[200%] transition-all duration-1000 ease-in-out pointer-events-none"></div>
          
          <h2 className="text-3xl md:text-5xl font-black mb-6 tracking-tight">ARE YOU READY TO ANALYZE?</h2>
          <p className="text-gray-400 mb-10 max-w-xl mx-auto text-lg">Discover the most suitable Vertiport locations in Istanbul based on data.</p>
          <button 
            onClick={() => navigate('/auth')}
            className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-xl text-lg font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_40px_rgba(37,99,235,0.6)] flex items-center justify-center mx-auto gap-3 transform hover:-translate-y-1"
          >
            <span className="flex items-center justify-center bg-white/20 rounded-full w-8 h-8"><PlayArrowIcon fontSize="small"/></span> Start Analysis — Free
          </button>
        </div>
      </section>
      
      {/* Footer minimal */}
      <footer className="py-8 border-t border-gray-800 mt-auto text-center text-gray-600 text-sm">
        &copy; {new Date().getFullYear()} SkyPort Analytics. All rights reserved.
      </footer>
    </div>
  );
};

export default LandingPage;
