import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white flex flex-col font-sans">
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
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
        {/* Üstteki Küçük Badge */}
        <div className="bg-gray-800/50 border border-gray-700 px-4 py-1 rounded-full text-xs flex items-center gap-2 mb-8">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Istanbul Pilot Region - UAM Decision Support System
        </div>

        {/* Ana Başlıklar */}
        <h1 className="text-6xl md:text-8xl font-black mb-2 tracking-tight">
          <span className="text-blue-500">SKY</span> PORT
        </h1>
        <h2 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight">
          VERTIPORT <br /> ANALYSIS PLATFORM
        </h2>

        {/* Açıklama Metni */}
        <p className="max-w-2xl text-gray-400 text-lg mb-10 leading-relaxed">
          SkyPort is a bidirectional Decision Support System that provides data-driven vertiport 
          site selection for experts, while offering passengers the opportunity to explore 
          Istanbul's next-generation air taxi network.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => navigate('/auth')}
            className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-md text-lg font-bold transition-all transform hover:scale-105"
          >
            <span className="text-xl">⬡</span> Start Analysis
          </button>
          <button
            onClick={() => navigate('/passenger')}
            className="group flex items-center gap-2 border border-purple-500 text-purple-400 hover:bg-purple-500/20 px-8 py-4 rounded-md text-lg font-bold transition-all transform hover:scale-105"
          >
            <span className="text-xl">✈</span> Launch Navigation
          </button>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;