'use strict';
// Development preview only. Use after enabling editor-only private preview in Replit.
const fs=require('node:fs');const file='.replit',source=fs.readFileSync(file,'utf8');const blocks=[];
const next=source.replace(/\[\[ports\]\][\s\S]*?(?=\n\[|$)/g,original=>{const local=Number(original.match(/localPort\s*=\s*(\d+)/)?.[1]),external=Number(original.match(/externalPort\s*=\s*(\d+)/)?.[1]);let desired;
 if(local===3000&&external===3000)desired=80;
 else if(local===22573&&external===80)desired=3000;
 else return original;
 const modified=original.replace(/externalPort\s*=\s*\d+/,'externalPort = '+desired);blocks.push({original,modified});return modified});
if(blocks.length!==2)throw Error('UNEXPECTED_PREVIEW_PORTS');
fs.writeFileSync('.prioris-auth-test/pilot-port-backup.json',JSON.stringify({privatePreviewRequired:true,blocks},null,2));fs.writeFileSync(file,next);console.log('PRIVATE_PREVIEW_POINTS_TO_FICTITIOUS_PILOT_RESTORE_ON_STOP');
