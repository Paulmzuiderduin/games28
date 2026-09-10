import { readFile } from 'node:fs/promises';
import { syncQuotaGuardSnapshot } from './quota-guard-snapshot.mjs';
const runtime = JSON.parse(await readFile(new URL('../src/data/runtime.json', import.meta.url), 'utf8'));
const count = await syncQuotaGuardSnapshot({ runtime, supabaseUrl: process.env.SUPABASE_URL, serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY });
console.log(`Quota guard snapshot synchronized (${count} quotas updated).`);
