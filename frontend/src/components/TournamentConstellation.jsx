import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '../motion';
import { Link } from '../router';

const GROUPS = 'ABCDEFGHIJKL'.split('');
const confederationLabels = { AFC: 'Asia', CAF: 'Africa', CONCACAF: 'North & Central America', CONMEBOL: 'South America', OFC: 'Oceania', UEFA: 'Europe' };

export default function TournamentConstellation({ teams = [] }) {
  const grouped = useMemo(() => GROUPS.map((group) => ({ group, teams: teams.filter((team) => team.group_name === group) })), [teams]);
  const ordered = useMemo(() => grouped.flatMap((item) => item.teams), [grouped]);
  const [selected, setSelected] = useState('');
  const [mobileGroup, setMobileGroup] = useState('A');
  const [active, setActive] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const rootRef = useRef(null);
  const buttonRefs = useRef(new Map());
  const frameRef = useRef(0);
  const reduced = useReducedMotion();
  const selectedTeam = teams.find((team) => team.name === selected);

  useEffect(() => {
    if (!selected && teams[0]) { setSelected(teams[0].name); setMobileGroup(teams[0].group_name); }
  }, [selected, teams]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced || !('IntersectionObserver' in window)) { setActive(true); return undefined; }
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { threshold: .18 });
    observer.observe(root);
    return () => observer.disconnect();
  }, [reduced]);
  useEffect(() => {
    const change = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => { document.removeEventListener('visibilitychange', change); if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, []);

  const select = useCallback((team) => { setSelected(team.name); setMobileGroup(team.group_name); }, []);
  const moveFocus = useCallback((event, team) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const current = ordered.findIndex((item) => item.name === team.name);
    const delta = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -4 : 4;
    const next = ordered[(current + delta + ordered.length) % ordered.length];
    select(next); buttonRefs.current.get(next.name)?.focus();
  }, [ordered, select]);
  const pointerMove = (event) => {
    if (reduced || !active || !window.matchMedia?.('(pointer:fine)').matches) return;
    const rect = rootRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - .5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - .5) * 2;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => { rootRef.current?.style.setProperty('--atlas-x', x.toFixed(3)); rootRef.current?.style.setProperty('--atlas-y', y.toFixed(3)); });
  };
  const pointerLeave = () => { rootRef.current?.style.setProperty('--atlas-x', '0'); rootRef.current?.style.setProperty('--atlas-y', '0'); };

  return (
    <div ref={rootRef} className={`constellation ${active && pageVisible ? 'is-active' : 'is-paused'} ${selectedTeam ? 'has-selection' : ''}`} aria-labelledby="constellation-title" onPointerMove={pointerMove} onPointerLeave={pointerLeave}>
      <div className="constellation-orbit" aria-hidden="true"><span>48</span><i>TEAMS</i></div>
      <div className="constellation-head"><div><p className="kicker">Live tournament field</p><h2 id="constellation-title">Twelve groups. One route through.</h2></div><p className="constellation-key"><i /> group path <span /> selected team</p></div>
      <div className="constellation-desktop">
        <svg viewBox="0 0 960 520" role="img" aria-labelledby="atlas-title" aria-describedby="atlas-desc">
          <title id="atlas-title">The 48-team Tournament Constellation</title><desc id="atlas-desc">Teams are arranged in twelve groups of four. Use arrow keys between team nodes, then follow the selected team to its match record.</desc>
          <defs><pattern id="pitch-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="currentColor" strokeOpacity=".08" /></pattern><filter id="node-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
          <rect className="pitch-grid" width="960" height="520" fill="url(#pitch-grid)" /><path className="halfway" d="M480 34V486M454 260a26 26 0 1 0 52 0 26 26 0 1 0-52 0" />
          {grouped.map(({ group, teams: members }, groupIndex) => {
            const left = groupIndex < 6; const row = groupIndex % 6; const y = 62 + row * 78; const gateX = left ? 438 : 522; const startX = left ? 62 : 898; const groupSelected = members.some((team) => team.name === selected);
            return <g key={group} className={groupSelected ? 'is-group-selected' : ''} style={{ '--group-delay': `${groupIndex * 65}ms` }}>
              <text className="group-label" x={left ? 24 : 936} y={y + 4} textAnchor={left ? 'start' : 'end'}>G{group}</text><path className="group-path-base" d={`M${left ? 150 : 810} ${y} H${gateX}`} /><path className="group-path" pathLength="1" d={`M${left ? 150 : 810} ${y} H${gateX}`} /><path className="route-signal" pathLength="1" d={`M${left ? 150 : 810} ${y} H${gateX}`} />
              {members.map((team, teamIndex) => { const x = left ? startX + teamIndex * 90 : startX - teamIndex * 90; const chosen = selected === team.name; return <g key={team.name} className={`team-node ${chosen ? 'is-selected' : ''}`} style={{ '--node-delay': `${150 + (groupIndex * 4 + teamIndex) * 22}ms` }}><circle className="node-halo" cx={x} cy={y} r="18" /><circle cx={x} cy={y} r="8" /><foreignObject x={x - 43} y={y + 12} width="86" height="30"><button ref={(node) => { if (node) buttonRefs.current.set(team.name, node); }} type="button" onClick={() => select(team)} onFocus={() => select(team)} onKeyDown={(event) => moveFocus(event, team)} aria-pressed={chosen} aria-label={`${team.name}, Group ${group}`} aria-describedby={chosen ? 'atlas-team-readout' : undefined}>{team.name}</button></foreignObject></g>; })}
              <circle className="group-gate" cx={gateX} cy={y} r="4" />
            </g>;
          })}
          <path className="knockout-path" pathLength="1" d="M438 62V452M522 62V452M438 140H480M522 140H480M438 296H480M522 296H480M480 140V296" /><path className="knockout-signal" pathLength="1" d="M438 62V452M438 296H480V140H522M522 62V452" /><path className="trophy-mark" d="M466 214h28v14c0 13-6 22-14 22s-14-9-14-22v-14Zm0 4h-10v8c0 8 5 13 12 14m26-22h10v8c0 8-5 13-12 14m-12 10v12m-14 0h28" />
        </svg>
      </div>
      <div className="constellation-mobile">
        <div className="group-tabs" role="tablist" aria-label="Tournament groups">{GROUPS.map((group) => <button key={group} type="button" role="tab" aria-selected={mobileGroup === group} onClick={() => { setMobileGroup(group); const first = grouped.find((item) => item.group === group)?.teams[0]; if (first) select(first); }}>{group}</button>)}</div>
        <div key={mobileGroup} className="mobile-pitch" role="tabpanel" aria-label={`Group ${mobileGroup}`}>{grouped.find((item) => item.group === mobileGroup)?.teams.map((team, index) => <button key={team.name} type="button" className={selected === team.name ? 'is-selected' : ''} aria-pressed={selected === team.name} onClick={() => select(team)}><span>{String(index + 1).padStart(2, '0')}</span><b>{team.name}</b><i aria-hidden="true">{selected === team.name ? 'SELECTED' : 'VIEW'}</i></button>)}</div>
      </div>
      <div id="atlas-team-readout" className="constellation-readout" aria-live="polite">{selectedTeam ? <><div><span>Selected side</span><strong>{selectedTeam.name}</strong></div><div><span>Field position</span><strong>Group {selectedTeam.group_name} · seed rank {selectedTeam.strength_rank}</strong></div><div><span>Confederation</span><strong>{confederationLabels[selectedTeam.confederation] || selectedTeam.confederation}</strong></div><Link className="text-link" to={`/predictions?team=${encodeURIComponent(selectedTeam.name)}`}>Trace match record <i aria-hidden="true">→</i></Link></> : <p>Team data appears when the tournament field is available.</p>}</div>
    </div>
  );
}
