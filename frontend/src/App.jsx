import React from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Predictions from './pages/Predictions';
import Accuracy from './pages/Accuracy';
import Bias from './pages/Bias';

const links = [['/', 'Dashboard'], ['/predictions', 'Predictions'], ['/accuracy', 'Accuracy'], ['/bias', 'Bias Lab']];

export default function App() {
  return <BrowserRouter><div className="min-h-screen bg-slate-950 text-slate-100"><aside className="fixed inset-y-0 left-0 w-64 border-r border-slate-800 bg-slate-900/90 p-6"><div className="text-2xl font-black">🏆 WC 2026 AI</div><p className="mt-2 text-sm text-slate-400">XGBoost + Poisson Monte Carlo predictor</p><nav className="mt-8 space-y-2">{links.map(([to,label]) => <NavLink key={to} to={to} end={to === '/'} className={({isActive}) => `block rounded-xl px-4 py-3 font-semibold transition ${isActive ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}>{label}</NavLink>)}</nav></aside><main className="ml-64 p-8"><Routes><Route path="/" element={<Dashboard />} /><Route path="/predictions" element={<Predictions />} /><Route path="/accuracy" element={<Accuracy />} /><Route path="/bias" element={<Bias />} /></Routes></main></div></BrowserRouter>;
}
