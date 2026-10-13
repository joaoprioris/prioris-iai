export const IDENTITY: {id:string;organizationId:string;organizationName:string;email:string;role:string};
export function createPilotStore(state: any, save?: () => void): {repository:any;open(scope:any):any;identity:typeof IDENTITY};
