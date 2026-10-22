// Empty-stack passes can complete a fast-action step once both players pass.
export function passEntersNextStep(room){
 return room.status==='playing'&&!!room.turn&&!room.flow?.stack?.length&&!room.flow?.locked&&!room.pendingChoiceCount&&['prepare','draw','first-action','second-action','contest-start','mobility-first','mobility-second','contest-before','contest-after','claim-before','claim-after','end'].includes(room.turn.step);
}
export const passPriorityLabel=room=>'让过一次优先权'+(passEntersNextStep(room)?'（进入下个步骤）':'');
