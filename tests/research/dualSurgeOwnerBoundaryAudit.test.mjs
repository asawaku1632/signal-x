import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const access=readFileSync(path.join(root,"app/lib/learningOwnerAccess.ts"),"utf8");
const owner=readFileSync(path.join(root,"app/lib/learningOwner.ts"),"utf8");
const page=readFileSync(path.join(root,"app/admin/dual-surge-shadow/page.tsx"),"utf8");
test("owner-only access rule rejects empty and multiple configured accounts",()=>{
 assert.match(access,/configuredOwner\?\.trim\(\)\.toLowerCase\(\)/);
 assert.match(access,/return false/);
 assert.match(access,/sessionEmail\.trim\(\)\.toLowerCase\(\) === owner/);
 assert.match(access,/\[\^\\s,@\]/);
});
test("owner session uses server session and not administrator list",()=>{
 assert.match(owner,/getServerSession\(authOptions\)/);
 assert.match(owner,/isSingleAccountLearningOwner\(email, configuredOwner\)/);
 assert.doesNotMatch(owner,/process\.env\.ADMIN_EMAILS/);
});
test("research page requires owner session and denies access before client rendering",()=>{
 assert.match(page,/const\s*\{isOwner\}\s*=\s*await getLearningOwnerSession\(\)/);
 assert.match(page,/if\s*\(!isOwner\)notFound\(\)/);
 assert.ok(page.indexOf("if(!isOwner)notFound()")<page.indexOf("<DualSurgeClient"));
});
