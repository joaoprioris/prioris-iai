export const IDENTITY: {id:string;organizationId:string;organizationName:string;email:string;role:string};
export function createPilotStore(state: any, save?: () => void,identity?:typeof IDENTITY): {repository:any;open(scope:any):any;identity:typeof IDENTITY};
