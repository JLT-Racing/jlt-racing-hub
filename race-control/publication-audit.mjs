import {previewTournamentStages} from './tournament-stages.mjs';
import {proposedStageRoster} from './stage-proposals.mjs';
import {stageDigest} from './stage-rosters.mjs';
import {calculateStandings} from './standings.mjs';
import {qualificationFormat} from './rules.mjs';
export function publicationAudit(groups,imports,approved,confirmed,sha){
 const blockers=[],leagues=[],output=[];
 if(!/^[a-f0-9]{64}$/.test(sha)||!groups.length||groups.some(g=>!g.official||g.simulated))blockers.push('Verified official roster required');
 const ids=new Set(),slots=new Set(),approvedIds=new Set(approved.map(x=>String(x.raceId)));
 for(const x of imports){
  const id=String(x.raceId),slot=x.groupId+':'+x.slot;
  if(ids.has(id)||slots.has(slot))blockers.push('Duplicate race ID or slot: '+id);
  ids.add(id);slots.add(slot);
  if(x.rosterSha!==sha||!x.official||x.simulated!==false)blockers.push('Invalid official import: '+id);
  if(!approvedIds.has(id))blockers.push('Pending steward approval: '+id);
 }
 for(const x of approved)if(!ids.has(String(x.raceId)))blockers.push('Missing imported race: '+x.raceId);
 for(const league of [...new Set(groups.map(g=>g.league))]){
  const issues=[],qualifications=[];
  const format=qualificationFormat(groups,league);
  for(const g of groups.filter(g=>g.league===league)){
   try{
    const s=calculateStandings(g,approved,'qualification');
    for(let i=1;i<=format.regularRaces;i++)if(!s.slots.includes('Qualification '+i))issues.push(g.id+' missing Qualification '+i);
    qualifications.push({groupId:g.id,standings:s.standings});
   }catch(e){issues.push(e.message)}
  }
  let stage;
  if(!issues.length)try{
   stage=previewTournamentStages(groups,approved,league);
   for(const kind of ['raceoff','championship']){
    const roster=kind==='raceoff'?stage.pooledRoster:stage.championshipRoster;
    if(kind==='raceoff'&&!roster)continue;
    if(!roster){issues.push('Championship roster not ready');continue}
    const proposed=proposedStageRoster(groups,approved,league,kind);
    if(!confirmed.some(x=>x.id===proposed.id&&x.rootSha===sha&&x.digest===stageDigest(proposed,sha)))issues.push(kind+' roster not confirmed');
   }
   if(stage.raceoff?.missing?.length)issues.push('Missing race-offs: '+stage.raceoff.missing.join(', '));
   if(stage.missingChampionshipRaces?.length)issues.push('Missing championship races: '+stage.missingChampionshipRaces.join(', '));
   if(!stage.championshipStandings)issues.push('Championship standings incomplete');
  }catch(e){issues.push(e.message)}
  leagues.push({league,ready:!issues.length,issues});
  blockers.push(...issues.map(x=>'L'+league+': '+x));
  if(!issues.length)output.push({league,qualifications,raceoff:stage.raceoffStandings?.standings||null,championship:stage.championshipStandings.standings});
 }
 const ready=blockers.length===0;
 return {mode:'PRIVATE_PREVIEW_ONLY',ready,publicationLocked:true,blockers,leagues,preview:ready?{schema:1,competition:'JLT Autumn 2026',leagues:output}:null};
}
