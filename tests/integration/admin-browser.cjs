// Run against a local production preview with Playwright installed.
// All Supabase traffic uses synthetic fixtures; no real login or writes.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'); const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {})});try{
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/cloud.umami.is/**',r=>r.abort());
// Synthetic session only in this isolated browser. All backend traffic is intercepted.
await page.addInitScript(()=>localStorage.setItem('sb-gavpllldsyepqhldczud-auth-token',JSON.stringify({access_token:'fixture-only',refresh_token:'fixture-only',expires_at:4102444800,token_type:'bearer',user:{id:'00000000-0000-4000-8000-000000000001',email:'fixture@example.invalid'}})));
const records=['pending','review_later','rejected'].map((status,i)=>({id:'qa-'+i,status,detected_at:'2026-09-12T00:00:00Z',source_url:'https://www.fei.org/',extracted_evidence:'Synthetic QA evidence, not a real qualification.',suggested_record:{noc:'NED',sport:'Equestrian',subjectType:'team_quota',state:'allocated',quotaCount:1,disciplines:['Team Dressage']}}));
const runtime=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../../public/runtime.json')));
const sources=runtime.meta.qualificationSources; const source=sources.find(s=>s.id==='if-equestrian');
assert.ok(source); const evidence=new URL('/qa-exact-article',source.url).href;
const reports=[{id:'qa-report',status:'pending',category:'missing_qualification',noc:'BEL',sport:'Equestrian',source_url:evidence,details:'Synthetic Belgian qualification report only.',created_at:'2026-09-12T00:00:00Z'}];
let writes=[];
await page.route('https://gavpllldsyepqhldczud.supabase.co/**',async r=>{const u=new URL(r.request().url());const method=r.request().method();
if(method!=='GET'){const body=r.request().postDataJSON();writes.push({path:u.pathname,body});if(u.pathname.endsWith('/rpc/convert_community_report')){assert.equal(body.p_source_url,evidence);records.push({id:'qa-converted',status:'pending',detected_at:'2026-09-12T01:00:00Z',source_id:source.id,source_url:evidence,suggested_record:body.p_suggested_record});reports[0].status='converted';return r.fulfill({contentType:'application/json',body:'"qa-converted"'});}return r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Fixture writes blocked'})});}
return r.fulfill({contentType:'application/json',body:JSON.stringify(u.searchParams.has('id')?[]:u.pathname.includes('qualification_review_candidates')?records:u.pathname.includes('community_reports')?reports:[])});});
for(const width of [390,768,1280]){await page.setViewportSize({width,height:900});await page.goto((process.env.GAMES28_PREVIEW_URL || 'http://127.0.0.1:4184')+'/admin');await page.getByText('fixture@example.invalid',{exact:false}).waitFor();
for(const tab of ['Waiting','Review later','Rejected']){await page.getByRole('tablist',{name:'Qualification review status'}).getByRole('tab',{name:new RegExp(tab)}).click();await page.locator('.admin-review-layout').waitFor(); if(tab==='Rejected') await page.getByRole('button',{name:'Reopen for review',exact:true}).waitFor(); else await page.getByRole('heading',{name:'What will be published',exact:true}).waitFor(); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,tab+' overflow '+width);}
console.log('admin fixture tabs and populated layout',width,'passed');}
await page.getByRole('tablist',{name:'Qualification review status'}).getByRole('tab',{name:/Waiting/}).click();
await page.getByRole('button',{name:'Reject — do not publish',exact:true}).click();
await page.getByText('Fixture writes blocked',{exact:true}).waitFor();
assert.equal(records[0].status,'pending');
assert.equal(await page.getByRole('button',{name:'Reject — do not publish',exact:true}).isEnabled(),true);
const create=page.getByRole('button',{name:'Create qualification candidate',exact:true});
assert.equal(await create.isDisabled(),true);
await page.locator('label').filter({has:page.locator('span').getByText('Official source to verify',{exact:true})}).locator('select').selectOption(source.id);
assert.equal(await page.locator('label').filter({hasText:'Exact official evidence link'}).locator('input').inputValue(),evidence);
await create.click();
await page.waitForTimeout(500); assert.ok(writes.some(w=>w.path.endsWith('/rpc/convert_community_report'))); console.log('Country after conversion',await page.locator('.admin-review-editor label').filter({has:page.locator('span').getByText('Country',{exact:true})}).locator('select').inputValue());
await page.locator('.admin-review-editor label').filter({has:page.locator('span').getByText('Country',{exact:true})}).locator('select').waitFor();
assert.equal(await page.locator('.admin-review-editor label').filter({has:page.locator('span').getByText('Country',{exact:true})}).locator('select').inputValue(),'BEL','Converted report must populate its own country, not the previous draft');
console.log('Save error and exact-evidence conversion passed');
assert.deepEqual(errors,[]);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
