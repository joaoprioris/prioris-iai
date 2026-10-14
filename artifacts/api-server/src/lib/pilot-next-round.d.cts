export function pilotIdentity(round:number): {id:string;organizationId:string;organizationName:string;email:string;role:string};
export function advanceBlock(state:any,inFlight?:number,now?:number):string|null;
export function advancePilotRound(state:any,options:{expectedRound:number;sessionId:string;inFlight?:number;now?:number},save:()=>void):{round:number;expiresAt:number};
