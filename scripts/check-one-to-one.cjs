'use strict';
// Runs old regression specifications against current components, without
// editing old evidence, connecting to a database, or loading any AI provider.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const current=path.resolve('artifacts/api-server/src/lib');
for(const name of ['conversation-service','conversation-guidance']){
 const source=path.resolve('prioris-routing-consolidation-20261012/'+name+'.test.cjs');
 let text=fs.readFileSync(source,'utf8').replace("require('./"+name+".cjs')","require("+JSON.stringify(path.join(current,name+'.cjs'))+")");
 const m=new Module(source,module);
 m.filename=source;m.paths=Module._nodeModulePaths(path.dirname(source));m._compile(text,source);
}
require(path.join(current,'one-to-one.test.cjs'));
