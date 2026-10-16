'use strict';
const { NOTICE_VERSION, retainUserInput, ConversationError } = require('./conversation-service.cjs');
function createPostgresRepository(pool) {
  const scoped = scope => [scope.userId, scope.organizationId];
  async function transaction(scope, work) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO prioris_history_preferences(user_id,organization_id) VALUES($1,$2) ON CONFLICT DO NOTHING', scoped(scope));
      const { rows } = await client.query('SELECT enabled,notice_version,revision FROM prioris_history_preferences WHERE user_id=$1 AND organization_id=$2 FOR UPDATE', scoped(scope));
      if (rows.length !== 1) throw new Error('SCOPE_NOT_FOUND');
      const result = await work(client, rows[0]);
      await client.query('COMMIT'); return result;
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }
  return {
    async assertInputCurrent(scope,entry){
      const {rows}=await pool.query("SELECT s.id FROM sessions s JOIN prioris_history_preferences p USING(user_id,organization_id) WHERE s.user_id=$1 AND s.organization_id=$2 AND s.id=$3 AND s.status='active' AND s.exchange_count=$4 AND p.revision::text=$5 AND s.context->'inputReceipts'->$6::text->>'status'='processing'",[...scoped(scope),entry.sessionId,entry.expectedCount,String(entry.settingsRevision),entry.requestId]);
      if(rows.length!==1)throw new ConversationError('CONVERSATION_CHANGED',409);
    },
    async recordInput(scope,entry){
      return transaction(scope,async(client,settings)=>{
        if(String(settings.revision)!==String(entry.settingsRevision))throw Object.assign(Error('CONVERSATION_CHANGED'),{code:'CONVERSATION_CHANGED'});
        const {rows}=await client.query('SELECT context,status,exchange_count FROM sessions WHERE user_id=$1 AND organization_id=$2 AND id=$3 FOR UPDATE',[...scoped(scope),entry.sessionId]);
        const row=rows[0];
        const context=retainUserInput(row?{context:row.context,status:row.status,exchangeCount:row.exchange_count||0}:null,entry);
        await client.query('UPDATE sessions SET context=$4::jsonb WHERE user_id=$1 AND organization_id=$2 AND id=$3',[...scoped(scope),entry.sessionId,JSON.stringify(context)]);
        return context;
      });
    },
    async recordInputFailure(scope,entry){
      return transaction(scope,async client=>{
        await client.query("UPDATE sessions SET context=jsonb_set(context,ARRAY['inputReceipts',$4::text,'status'],to_jsonb('failed'::text)) WHERE user_id=$1 AND organization_id=$2 AND id=$3 AND status='active' AND context->'inputReceipts'->$4::text->>'status'='processing'",[...scoped(scope),entry.sessionId,entry.requestId]);
      });
    },
    async getCompletedRequest(scope,sessionId,requestId){
      const {rows}=await pool.query('SELECT content_hash FROM prioris_completed_requests WHERE user_id=$1 AND organization_id=$2 AND session_id=$3 AND request_id=$4',[...scoped(scope),sessionId,requestId]);
      return rows.length?{contentHash:rows[0].content_hash}:null;
    },
    async getSession(scope, id) {
      const { rows } = await pool.query('SELECT id,context,status,exchange_count FROM sessions WHERE user_id=$1 AND organization_id=$2 AND id=$3', [...scoped(scope),id]);
      return rows.length ? { id: rows[0].id, context: rows[0].context, status: rows[0].status, exchangeCount: rows[0].exchange_count || 0 } : null;
    },
    async getHistorySettings(scope) {
      const { rows } = await pool.query('SELECT enabled,notice_version,revision FROM prioris_history_preferences WHERE user_id=$1 AND organization_id=$2', scoped(scope));
      return rows.length ? { enabled: rows[0].enabled, noticeVersion: rows[0].notice_version, revision: String(rows[0].revision) } : { enabled:false,noticeVersion:null,revision:'0' };
    },
    async readPrivateHistory(scope, limit, currentSessionId = null) {
      // Also check current preference, so an opt-out prevents subsequent retrieval.
      const { rows } = await pool.query('SELECT h.record FROM prioris_private_history h JOIN prioris_history_preferences p USING(user_id,organization_id) WHERE h.user_id=$1 AND h.organization_id=$2 AND p.enabled AND p.notice_version=$3 AND ($5::uuid IS NULL OR h.session_id<>$5::uuid) ORDER BY h.created_at DESC,h.id DESC LIMIT $4', [...scoped(scope),NOTICE_VERSION,Math.min(4,Math.max(0,limit)),currentSessionId]);
      return rows.reverse().map(r => r.record);
    },
    async setHistorySettings(scope, enabled, noticeVersion) {
      if (typeof enabled !== 'boolean' || (enabled && noticeVersion !== NOTICE_VERSION)) throw new Error('NOTICE_REQUIRED');
      return transaction(scope, async client => {
        await client.query('UPDATE prioris_history_preferences SET enabled=$3,notice_version=$4,revision=revision+1,updated_at=now() WHERE user_id=$1 AND organization_id=$2', [...scoped(scope),enabled,enabled?NOTICE_VERSION:noticeVersion]);
        return true;
      });
    },
    async eraseHistory(scope) {
      return transaction(scope, async client => {
        await client.query('DELETE FROM prioris_private_history WHERE user_id=$1 AND organization_id=$2', scoped(scope));
        await client.query('DELETE FROM prioris_completed_requests WHERE user_id=$1 AND organization_id=$2', scoped(scope));
        await client.query("UPDATE sessions SET context=NULL,status='closed' WHERE user_id=$1 AND organization_id=$2", scoped(scope));
        await client.query('UPDATE prioris_history_preferences SET enabled=false,revision=revision+1,updated_at=now() WHERE user_id=$1 AND organization_id=$2', scoped(scope));
        return true;
      });
    },
    async commitTurn(scope, turn) {
      return transaction(scope, async (client, settings) => {
        if (String(settings.revision) !== String(turn.settingsRevision)) return false;
        const duplicate=await client.query('SELECT 1 FROM prioris_completed_requests WHERE user_id=$1 AND organization_id=$2 AND session_id=$3 AND request_id=$4',[...scoped(scope),turn.sessionId,turn.requestId]);
        if(duplicate.rowCount)return false;
        const q=await client.query("UPDATE sessions SET context=$4::jsonb,agent_type=$5,status=$6,exchange_count=$7 WHERE user_id=$1 AND organization_id=$2 AND id=$3 AND exchange_count=$8 AND status='active' RETURNING id", [...scoped(scope),turn.sessionId,JSON.stringify(turn.context),turn.agent,turn.status,turn.nextCount,turn.expectedCount]);
        if (q.rowCount !== 1) return false;
        await client.query('INSERT INTO prioris_completed_requests(user_id,organization_id,session_id,request_id,content_hash) VALUES($1,$2,$3,$4,$5)',[...scoped(scope),turn.sessionId,turn.requestId,turn.contentHash]);
        if (turn.privateRecord && settings.enabled && settings.notice_version===NOTICE_VERSION) {
          await client.query('INSERT INTO prioris_private_history(user_id,organization_id,session_id,record) VALUES($1,$2,$3,$4::jsonb)', [...scoped(scope),turn.sessionId,JSON.stringify(turn.privateRecord)]);
        }
        return true;
      });
    },
  };
}
module.exports={createPostgresRepository};
