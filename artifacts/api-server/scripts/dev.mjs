import { spawn } from 'node:child_process';

function run(args) {
  return new Promise((resolve, reject) => {
    const child=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,NODE_ENV:'development'}});
    child.once('error',reject);
    child.once('exit',(code,signal)=>code===0?resolve():reject(Error(`Processo encerrou (${signal??code}).`)));
  });
}

await run(['./build.mjs']);
await run(['--enable-source-maps','./dist/index.mjs']);
