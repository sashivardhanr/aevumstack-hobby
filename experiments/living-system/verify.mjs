// Run with the project's existing Playwright dependency and the isolated preview server.
import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const origin = 'http://127.0.0.1:4185';
const image = name => fileURLToPath(new URL(`./previews/${name}.png`, import.meta.url));
let passed = 0;
const check = (condition, label) => { assert.ok(condition, label); passed++; };
for (const [name, engine] of [['Chromium', chromium], ['WebKit', webkit]]) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({ viewport: { width:1440, height:1050 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin); await page.evaluate(() => document.fonts.ready);
    for (const width of [1440,768,390,320]) {
      await page.setViewportSize({width,height:1050});
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} reflow ${width}`);
      check(await page.locator('h1').isVisible(), `${name} heading ${width}`);
      const controls = await page.locator('#run, #sample-start, .primary').evaluateAll(nodes => nodes.map(e => {const r=e.getBoundingClientRect();return r.width>=24 && r.height>=24;}));
      check(controls.every(Boolean), `${name} target size ${width}`);
      if (name === 'Chromium' && [1440,390].includes(width)) {
        await page.screenshot({path:image(`signal-${width}`),fullPage:true});
      }
    }
    await page.setViewportSize({width:1440,height:1050});
    await page.locator('#run').focus();
    check(await page.locator('#run').evaluate(e => document.activeElement === e && parseFloat(getComputedStyle(e).outlineWidth)>=2), `${name} keyboard focus`);
    const requests=[];const onRequest=r=>requests.push(r.url());page.on('request',onRequest);
    await page.locator('#run').press('Enter');
    check(await page.locator('#workbench').getAttribute('data-stage')==='website',`${name} website begins`);
    check(await page.locator('#run').isDisabled(),`${name} duplicate suppression`);
    await page.waitForTimeout(850);
    check(await page.locator('#workbench').getAttribute('data-flow')==='booking' && await page.locator('#workbench').getAttribute('data-stage')==='website',`${name} signal precedes booking`);
    await page.waitForTimeout(1000);
    check(await page.locator('#workbench').getAttribute('data-stage')==='booking',`${name} booking after arrival`);
    await page.waitForTimeout(1500);
    check(await page.locator('.task-list li.done').count()===1,`${name} first automation step only`);
    await page.waitForTimeout(2400);
    check(await page.locator('#workbench').getAttribute('data-stage')==='complete',`${name} completed`);
    check(await page.locator('.task-list li.done').count()===3,`${name} all automation steps`);
    check(await page.locator('#run').isEnabled(),`${name} replay enabled`);
    check((await page.locator('#sequence-status').textContent()).includes('No real booking'),`${name} honest live announcement`);
    check(requests.length===0,`${name} no sequence network requests`);
    if(name==='Chromium')await page.screenshot({path:image('signal-complete-1440'),fullPage:true});
    await page.locator('#run').click();
    await page.locator('header').scrollIntoViewIfNeeded();
    // An explicit page scroll away from the whole workbench cancels owned timers.
    await page.setViewportSize({width:1440,height:400});
    await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(100);
    check(await page.locator('#workbench').getAttribute('data-stage')==='idle',`${name} offscreen cancellation`);
    await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('#sample-start').click();
    check(await page.locator('#workbench').getAttribute('data-stage')==='complete',`${name} reduced-motion immediate result`);
    check(await page.locator('.traveller').evaluate(e=>getComputedStyle(e).transitionDuration==='0s'),`${name} reduced-motion transitions disabled`);
    check(await page.evaluate(()=>localStorage.length===0 && sessionStorage.length===0),`${name} no storage`);
    check(errors.length===0,`${name} no page errors`);
    const context = await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
    const staticPage=await context.newPage();
    await staticPage.route('https://fonts.googleapis.com/**',r=>r.abort());await staticPage.route('https://fonts.gstatic.com/**',r=>r.abort());
    await staticPage.goto(origin);
    check(await staticPage.locator('h1').isVisible() && await staticPage.locator('.stage').count()===3,`${name} no-JS content`);
    check(await staticPage.locator('#run').isHidden() && await staticPage.locator('#sample-start').isHidden(),`${name} no dead no-JS controls`);
    check(await staticPage.locator('.masthead img').evaluate(e=>e.complete&&e.naturalWidth>0),`${name} font-independent identity`);
    check(await staticPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} fallback font reflow`);
    await context.close();
    console.log(`${name}: prototype checks passed`);
  } finally { await browser.close(); }
}
// Palette contrast: essential body/heading text and interactive button labels.
const luminance = hex => {
 const c=hex.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return c[0]*.2126+c[1]*.7152+c[2]*.0722;
};
for (const [fg,bg] of [['0B0D10','F3F0E8'],['4b555c','F3F0E8'],['606a70','F3F0E8'],['F3F0E8','192127'],['AAB2B8','192127'],['0B0D10','FF5C40']]) {
 const l=[luminance(fg),luminance(bg)].sort((a,b)=>b-a);const ratio=(l[0]+.05)/(l[1]+.05);
 check(ratio>=4.5,`text contrast ${fg}/${bg}`);console.log(`${fg}/${bg}: ${ratio.toFixed(2)}:1`);
}
console.log(`${passed} focused assertions passed. No application, Docker, SMTP or database suites invoked.`);
