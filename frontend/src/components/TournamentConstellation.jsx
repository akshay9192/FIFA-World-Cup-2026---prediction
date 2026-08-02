import React, { useEffect, useMemo, useState } from 'react';
import { Link } from '../router';

const GROUPS = 'ABCDEFGHIJKL'.split('');
const confederationLabels = {
  AFC: 'Asia', CAF: 'Africa', CONCACAF: 'North & Central America',
  CONMEBOL: 'South America', OFC: 'Oceania', UEFA: 'Europe',
};

export default function TournamentConstellation({ teams = [] }) {
  const grouped = useMemo(() => GROUPS.map((group) => ({
    group,
    teams: teams.filter((team) => team.group_name === group),
  })), [teams]);
  const [selected, setSelected] = useState(teams[0]?.name || '');
  const [mobileGroup, setMobileGroup] = useState('A');
  const selectedTeam = teams.find((team) => team.name === selected);

  useEffect(() => {
    if (!selected && teams[0]) {
      setSelected(teams[0].name);
      setMobileGroup(teams[0].group_name);
    }
  }, [selected, teams]);

  function select(team) {
    setSelected(team.name);
    setMobileGroup(team.group_name);
  }

  return (
    <div className="constellation" aria-labelledby="constellation-title">
      <div className="constellation-head">
        <div>
          <p className="kicker">Live tournament field</p>
          <h2 id="constellation-title">Twelve groups. One route through.</h2>
        </div>
        <p className="constellation-key"><i /> group path <span /> selected team</p>
      </div>

      <div className="constellation-desktop">
        <svg viewBox="0 0 960 520" role="img" aria-labelledby="atlas-title" aria-describedby="atlas-desc">
          <title id="atlas-title">The 48-team Tournament Constellation</title>
          <desc id="atlas-desc">Teams are arranged in twelve official groups of four. Select a team to identify its group and experimental strength rank.</desc>
          <defs>
            <pattern id="pitch-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" fill="none" stroke="currentColor" strokeOpacity=".08" />
            </pattern>
          </defs>
          <rect width="960" height="520" fill="url(#pitch-grid)" />
          <path className="halfway" d="M480 34V486M454 260a26 26 0 1 0 52 0 26 26 0 1 0-52 0" />
          {grouped.map(({ group, teams: members }, groupIndex) => {
            const left = groupIndex < 6;
            const row = groupIndex % 6;
            const y = 62 + row * 78;
            const gateX = left ? 438 : 522;
            const startX = left ? 62 : 898;
            const groupSelected = members.some((team) => team.name === selected);
            return (
              <g key={group} className={groupSelected ? 'is-group-selected' : ''}>
                <text className="group-label" x={left ? 24 : 936} y={y + 4} textAnchor={left ? 'start' : 'end'}>G{group}</text>
                <path className="group-path" d={`M${left ? 150 : 810} ${y} H${gateX}`} />
                {members.map((team, teamIndex) => {
                  const x = left ? startX + teamIndex * 90 : startX - teamIndex * 90;
                  const active = selected === team.name;
                  return (
                    <g key={team.name} className={`team-node ${active ? 'is-selected' : ''}`}>
                      <circle cx={x} cy={y} r={active ? 13 : 8} />
                      <foreignObject x={x - 42} y={y + 12} width="84" height="28">
                        <button type="button" onClick={() => select(team)} aria-pressed={active} aria-label={`${team.name}, Group ${group}`}>
                          {team.name}
                        </button>
                      </foreignObject>
                    </g>
                  );
                })}
                <circle className="group-gate" cx={gateX} cy={y} r="4" />
              </g>
            );
          })}
          <path className="knockout-path" d="M438 62V452M522 62V452M438 140H480M522 140H480M438 296H480M522 296H480M480 140V296" />
          <path className="trophy-mark" d="M466 214h28v14c0 13-6 22-14 22s-14-9-14-22v-14Zm0 4h-10v8c0 8 5 13 12 14m26-22h10v8c0 8-5 13-12 14m-12 10v12m-14 0h28" />
        </svg>
      </div>

      <div className="constellation-mobile">
        <div className="group-tabs" role="tablist" aria-label="Tournament groups">
          {GROUPS.map((group) => (
            <button key={group} type="button" role="tab" aria-selected={mobileGroup === group} onClick={() => setMobileGroup(group)}>{group}</button>
          ))}
        </div>
        <div className="mobile-pitch" role="tabpanel" aria-label={`Group ${mobileGroup}`}>
          {grouped.find((item) => item.group === mobileGroup)?.teams.map((team, index) => (
            <button key={team.name} type="button" className={selected === team.name ? 'is-selected' : ''} onClick={() => select(team)}>
              <span>{String(index + 1).padStart(2, '0')}</span>{team.name}
            </button>
          ))}
        </div>
      </div>

      <div className="constellation-readout" aria-live="polite">
        {selectedTeam ? (
          <>
            <div><span>Selected side</span><strong>{selectedTeam.name}</strong></div>
            <div><span>Field position</span><strong>Group {selectedTeam.group_name} · seed rank {selectedTeam.strength_rank}</strong></div>
            <div><span>Confederation</span><strong>{confederationLabels[selectedTeam.confederation] || selectedTeam.confederation}</strong></div>
            <Link className="text-link" to={`/predictions?team=${encodeURIComponent(selectedTeam.name)}`}>Trace match record →</Link>
          </>
        ) : <p>Team data will appear when the tournament field is available.</p>}
      </div>
    </div>
  );
}
