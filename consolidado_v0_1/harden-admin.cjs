'use strict';
// Remove obsolete credential issuing from the administrator's provisioning endpoint.
const fs=require('node:fs'),path=require('node:path');
const file='artifacts/api-server/src/routes/admin.ts',s=fs.readFileSync(file,'utf8');
if(s.includes('CREDENTIAL_ISSUING_REMOVED')){console.log('ADMIN_ALREADY_HARDENED');process.exit(0)}
for(const marker of ['import { randomBytes } from "crypto";','const token = randomBytes(32).toString("hex");','// Build the magic link','      token,','      magicLink,'])if(!s.includes(marker))throw Error('ADMIN_SOURCE_CHANGED');
const backup='prioris-review-backup-20261012-routing/'+file;fs.mkdirSync(path.dirname(backup),{recursive:true});if(!fs.existsSync(backup))fs.writeFileSync(backup,s);
let updated=s.replace('import { randomBytes } from "crypto";','import { timingSafeEqual } from "crypto";');
updated=updated.replace('if (!provided || provided !== adminToken) {','const expectedBytes = Buffer.from(adminToken);\n  const providedBytes = Buffer.from(provided);\n  if (!provided || providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) {');
updated=updated.replace('const { email, organization_id } = req.body ?? {};','const { email: suppliedEmail, organization_id } = req.body ?? {};\n    const email = typeof suppliedEmail === "string" ? suppliedEmail.trim().toLowerCase() : suppliedEmail;');
updated=updated.replace('const token = randomBytes(32).toString("hex");','// CREDENTIAL_ISSUING_REMOVED: normal email login issues expiring hashed credentials.');
updated=updated.replace('role: usersTable.role })','role: usersTable.role, organizationId: usersTable.organizationId })');
const begin=updated.indexOf('    if (existing) {'),end=updated.indexOf('    } else {',begin);
if(begin<0||end<0)throw Error('ADMIN_UPSERT_CHANGED');
updated=updated.slice(0,begin)+'    if (existing) {\n      if (existing.organizationId !== organization_id) { res.status(409).json({ error: "Este e-mail já pertence a outra organização." }); return; }\n      userId = existing.id;\n      req.log.info({ userId }, "Admin: usuário já cadastrado; credencial preservada");\n'+updated.slice(end);
updated=updated.replace('authToken: token, role: "leader"','authToken: null, role: "leader"');
const linkStart=updated.indexOf('    // Build the magic link'),linkEnd=updated.indexOf('    res.status(existing ? 200 : 201)',linkStart);
updated=updated.slice(0,linkStart)+updated.slice(linkEnd);
updated=updated.replace('      token,\n      magicLink,','      loginRequired: true,');
updated=updated.replace('req.log.info({ userId, email, orgId: organization_id }, "Admin: novo usuário criado");','req.log.info({ userId }, "Admin: novo usuário criado");');
fs.writeFileSync(file,updated);console.log('ADMIN_NO_RAW_TOKEN_NO_SESSION_REPLACEMENT_NO_CROSS_ORG_REUSE');
