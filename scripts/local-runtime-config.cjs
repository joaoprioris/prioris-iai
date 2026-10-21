'use strict';

function loopbackHttpBase(value) {
  try {
    const url=new URL(value??'');
    return url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  } catch { return false; }
}
function localHttpProfile(env=process.env) {
  return env.NODE_ENV==='development'&&env.IAI_LOCAL_HTTP==='true'&&loopbackHttpBase(env.APP_BASE_URL);
}
function runtimeHost(env=process.env) {
  return localHttpProfile(env)?'127.0.0.1':'0.0.0.0';
}

module.exports={localHttpProfile,runtimeHost};
