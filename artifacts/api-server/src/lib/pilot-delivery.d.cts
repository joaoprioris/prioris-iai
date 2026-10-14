export function createPilotDelivery(state:any,save:()=>void): {
 begin(input:any,inFlight:number):any;finish(id:string,code:string):void;
 view():any;recoverRestart():void;
};
