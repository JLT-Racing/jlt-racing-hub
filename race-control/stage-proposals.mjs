import {previewAdvancement} from './advancement.mjs';
import {previewTournamentStages} from './tournament-stages.mjs';
export function proposedStageRoster(groups,approvedImports,league,stage){
 const first=previewAdvancement(groups,approvedImports,league);
 if(!first.ready)throw Error('Qualification advancement incomplete');
 if(stage==='raceoff'){
  if(!first.pooledRoster)throw Error('This league has no race-off');
  return first.pooledRoster;
 }
 if(stage!=='championship')throw Error('Invalid stage');
 const next=previewTournamentStages(groups,approvedImports,league);
 const roster=next.championshipRoster;
 if(roster)return roster;
 if(first.qualifiers)return {id:'L'+league+'-CHAMPIONSHIP',league,official:false,simulated:false,pendingStewardVerification:true,drivers:first.qualifiers.drivers};
 throw Error('Both approved race-offs required before championship roster verification');
}
