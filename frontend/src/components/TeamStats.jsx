import React from 'react';
export default function TeamStats({ team }) { if (!team) return null; return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h3 className="font-bold">{team.name}</h3><p className="text-sm text-slate-400">FIFA rank {team.fifa_ranking} • {team.confederation}</p></div>; }
