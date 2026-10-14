export function createPilotPersistence(file:string,state:any):{
 save():void;refresh():boolean;acquireRequest():()=>void;requestActive():boolean;
};
