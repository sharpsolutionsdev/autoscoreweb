const fs = require('fs');
const puppeteer = require('puppeteer'); // v23.0.0 or later

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const timeout = 5000;
    page.setDefaultTimeout(timeout);

    const lhApi = await import('lighthouse'); // v10.0.0 or later
    const flags = {
        screenEmulation: {
            disabled: true
        }
    }
    const config = lhApi.desktopConfig;
    const lhFlow = await lhApi.startFlow(page, {name: 'Recording 4/21/2026 at 5:32:20 AM', config, flags});
    {
        const targetPage = page;
        await targetPage.setViewport({
            width: 1403,
            height: 772
        })
    }
    await lhFlow.startNavigation();
    {
        const targetPage = page;
        await targetPage.goto('https://dartvoice.app/web-app');
    }
    await lhFlow.endNavigation();
    await lhFlow.startTimespan();
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await puppeteer.Locator.race([
            targetPage.locator('div.pl-4 > div.relative svg'),
            targetPage.locator('::-p-xpath(//*[@id=\\"main-content\\"]/div[2]/div/div[1]/div[1]/div/div[1]/div[2]/app-match-team-score/div/div/div[1]/div[2]/button/dc-icon/svg)'),
            targetPage.locator(':scope >>> div.pl-4 > div.relative svg')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 13.638885498046875,
                y: 14.458328247070312,
              },
            });
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await puppeteer.Locator.race([
            targetPage.locator('#ion-overlay-8 svg'),
            targetPage.locator('::-p-xpath(//*[@id=\\"ion-overlay-8\\"]/app-edit-match-scores-dialog/app-fullscreen-dialog-layout/div[2]/div/div[2]/app-accordion/div/div/dc-icon/svg)'),
            targetPage.locator(':scope >>> #ion-overlay-8 svg')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 0.90277099609375,
                y: 6.9444427490234375,
              },
            });
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(ENTER_NEW_VALUE)'),
            targetPage.locator('input'),
            targetPage.locator('::-p-xpath(//*[@id=\\"ion-overlay-8\\"]/app-edit-match-scores-dialog/app-fullscreen-dialog-layout/div[2]/div/div[2]/app-accordion/div/div[2]/div/div/div[1]/input)'),
            targetPage.locator(':scope >>> input')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 62.77777099609375,
                y: 35.19444274902344,
              },
            });
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await targetPage.keyboard.down('Backspace');
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await targetPage.keyboard.up('Backspace');
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(ENTER_NEW_VALUE)'),
            targetPage.locator('input'),
            targetPage.locator('::-p-xpath(//*[@id=\\"ion-overlay-8\\"]/app-edit-match-scores-dialog/app-fullscreen-dialog-layout/div[2]/div/div[2]/app-accordion/div/div[2]/div/div/div[1]/input)'),
            targetPage.locator(':scope >>> input')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 379.77777099609375,
                y: 26.194442749023438,
              },
            });
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(ENTER_NEW_VALUE)'),
            targetPage.locator('input'),
            targetPage.locator('::-p-xpath(//*[@id=\\"ion-overlay-8\\"]/app-edit-match-scores-dialog/app-fullscreen-dialog-layout/div[2]/div/div[2]/app-accordion/div/div[2]/div/div/div[1]/input)'),
            targetPage.locator(':scope >>> input')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 81.77777099609375,
                y: 31.194442749023438,
              },
            });
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(ENTER_NEW_VALUE)'),
            targetPage.locator('input'),
            targetPage.locator('::-p-xpath(//*[@id=\\"ion-overlay-8\\"]/app-edit-match-scores-dialog/app-fullscreen-dialog-layout/div[2]/div/div[2]/app-accordion/div/div[2]/div/div/div[1]/input)'),
            targetPage.locator(':scope >>> input')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 33.77777099609375,
                y: 23.194442749023438,
              },
            });
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(ENTER_NEW_VALUE)'),
            targetPage.locator('#ion-overlay-8 input'),
            targetPage.locator('::-p-xpath(//*[@id=\\"ion-overlay-8\\"]/app-edit-match-scores-dialog/app-fullscreen-dialog-layout/div[2]/div/div[2]/app-accordion/div/div[2]/div/div/div[1]/input)'),
            targetPage.locator(':scope >>> #ion-overlay-8 input')
        ])
            .setTimeout(timeout)
            .fill('');
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await targetPage.keyboard.down('Backspace');
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await targetPage.keyboard.up('Backspace');
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await targetPage.keyboard.down('Backspace');
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await targetPage.keyboard.up('Backspace');
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(ENTER_NEW_VALUE)'),
            targetPage.locator('input'),
            targetPage.locator('::-p-xpath(//*[@id=\\"ion-overlay-8\\"]/app-edit-match-scores-dialog/app-fullscreen-dialog-layout/div[2]/div/div[2]/app-accordion/div/div[2]/div/div/div[1]/input)'),
            targetPage.locator(':scope >>> input')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 33.77777099609375,
                y: 23.194442749023438,
              },
            });
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(ENTER_NEW_VALUE)'),
            targetPage.locator('input'),
            targetPage.locator('::-p-xpath(//*[@id=\\"ion-overlay-8\\"]/app-edit-match-scores-dialog/app-fullscreen-dialog-layout/div[2]/div/div[2]/app-accordion/div/div[2]/div/div/div[1]/input)'),
            targetPage.locator(':scope >>> input')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 53.77777099609375,
                y: 31.194442749023438,
              },
            });
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(ENTER_NEW_VALUE)'),
            targetPage.locator('#ion-overlay-8 input'),
            targetPage.locator('::-p-xpath(//*[@id=\\"ion-overlay-8\\"]/app-edit-match-scores-dialog/app-fullscreen-dialog-layout/div[2]/div/div[2]/app-accordion/div/div[2]/div/div/div[1]/input)'),
            targetPage.locator(':scope >>> #ion-overlay-8 input')
        ])
            .setTimeout(timeout)
            .fill('');
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await targetPage.keyboard.down('Backspace');
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await targetPage.keyboard.up('Backspace');
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(ENTER_NEW_VALUE)'),
            targetPage.locator('#ion-overlay-8 input'),
            targetPage.locator('::-p-xpath(//*[@id=\\"ion-overlay-8\\"]/app-edit-match-scores-dialog/app-fullscreen-dialog-layout/div[2]/div/div[2]/app-accordion/div/div[2]/div/div/div[1]/input)'),
            targetPage.locator(':scope >>> #ion-overlay-8 input')
        ])
            .setTimeout(timeout)
            .fill('34');
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Save) >>>> ::-p-aria([role=\\"generic\\"])'),
            targetPage.locator('div.rounded-b-2xl span'),
            targetPage.locator('::-p-xpath(//*[@id=\\"ion-overlay-8\\"]/app-edit-match-scores-dialog/app-fullscreen-dialog-layout/div[2]/div/div[2]/app-accordion/div/div[2]/div/div/div[2]/button/span)'),
            targetPage.locator(':scope >>> div.rounded-b-2xl span')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 5.625,
                y: 11.694427490234375,
              },
            });
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Save) >>>> ::-p-aria([role=\\"generic\\"])'),
            targetPage.locator('div.rounded-b-2xl span'),
            targetPage.locator('::-p-xpath(//*[@id=\\"ion-overlay-8\\"]/app-edit-match-scores-dialog/app-fullscreen-dialog-layout/div[2]/div/div[2]/app-accordion/div/div[2]/div/div/div[2]/button/span)'),
            targetPage.locator(':scope >>> div.rounded-b-2xl span')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 3.625,
                y: 7.694427490234375,
              },
            });
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://app.dartcounter.net/dashboard', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await puppeteer.Locator.race([
            targetPage.locator('app-alerts > div'),
            targetPage.locator('::-p-xpath(/html/body/app-root/ion-app/app-alerts/div)'),
            targetPage.locator(':scope >>> app-alerts > div')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 845,
                y: 402,
              },
            });
    }
    await lhFlow.endTimespan();
    const lhFlowReport = await lhFlow.generateReport();
    fs.writeFileSync(__dirname + '/flow.report.html', lhFlowReport)

    await browser.close();

})().catch(err => {
    console.error(err);
    process.exit(1);
});
