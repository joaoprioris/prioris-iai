'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),esbuild=require(path.resolve('artifacts/api-server/node_modules/esbuild'));
const root=path.resolve('.prioris-auth-test'),data=path.join(root,'pgdata'),socket=path.join(root,'socket');
if(!fs.existsSync(path.join(data,'PG_VERSION')))throw Error('ISOLATED_DATABASE_NOT_PREPARED');
const started=cp.spawnSync('pg_ctl',['-D',data,'status'],{stdio:'ignore'}).status!==0;
if(started&&cp.spawnSync('pg_ctl',['-D',data,'-l',path.join(root,'postgres.log'),'-o',"-h '' -k "+socket+' -p 55432','-w','start'],{stdio:'ignore'}).status!==0)throw Error('ISOLATED_DATABASE_START_FAILED');
try{
 esbuild.buildSync({entryPoints:['artifacts/api-server/src/routes/functional-orchestrator.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',alias:{'@workspace/db':path.resolve('lib/db/src/index.ts')},outfile:path.join(__dirname,'functional-router-bundle.cjs')});
 const r=cp.spawnSync(process.execPath,[path.join(__dirname,'routing-pg.test.cjs')],{stdio:'inherit',env:{...process.env,DATABASE_URL:fs.readFileSync(path.join(root,'database-url.txt'),'utf8'),PRIORIS_ISOLATED_TEST_SOCKET:socket,NODE_PATH:['artifacts/api-server/node_modules','lib/db/node_modules'].map(p=>path.resolve(p)).join(':')}});process.exitCode=r.status??1;
}finally{if(started){const stopped=cp.spawnSync('pg_ctl',['-D',data,'-m','fast','-w','stop'],{stdio:'ignore'}).status===0;console.log('POSTGRES_TEMPORARIO_ENCERRADO',stopped);if(!stopped)process.exitCode=1}}
