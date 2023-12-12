const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const PORT = 3000;

app.get('/search', async (req, res) => {
    // Récupérer le mot-clé de la requête
    const keyword = req.query.keyword;
    const data = [];
    let message= "";
    let code = 200;
    if(!keyword) {
        res.status(400).send('Mot-clé manquant');
        return;
    }
    // Utiliser Puppeteer pour ouvrir Bing Maps et effectuer la recherche
    const browser = await puppeteer.launch({ headless: false});
    try {
        const page = await browser.newPage();
        await page.goto('https://www.bing.com/maps');

        // Localiser la barre de recherche (remplacer 'selector' par le sélecteur CSS ou XPath réel)
        const searchSelector = 'input[id="maps_sb"]'; // Exemple, ce sélecteur doit être ajusté en fonction de l'HTML
        await page.waitForSelector(searchSelector);
        await page.click(searchSelector);
        await page.type(searchSelector, keyword);
        await page.keyboard.press('Enter'); // ou utiliser page.click() pour un bouton spécifique

        await page.waitForSelector('button[id="bnp_btn_accept"]');
        const acceptCookiesButton = await page.$('button[id="bnp_btn_accept"]');
        await acceptCookiesButton.click();  // accepter les cookies
        let hasNextPage = true;
        do {
            await page.waitForSelector('.entity-listing-container');
            const divList = await page.$('.entity-listing-container');
            const companyList = await divList.$('.b_vList')
            if (companyList) {
                const companies = await companyList.$$('li');
                console.log('companies',companies.length);
                for (const company of companies) {

                    await company.click();
                    await page.waitForSelector('.compInfo');
                    const companyInfos = await page.$('.compInfo');
                    const companyName = await companyInfos.$('.nameContainer');
                    const companyAddress = await companyInfos.$('div[aria-label="Address"]');
                    const companyPhone = await companyInfos.$('div[aria-label="Phone"]');
                    const companyWebsite = await companyInfos.$('div[aria-label="Website"]');
                    // go to the website on a new tab
                    let email = null;
                    if(companyWebsite) {
                        await companyWebsite.click();
                        email = await page.$('a[href*="mailto"]');
                        if(!email) {
                            const pageContent = await page.evaluate(() => {
                                return document.body.innerText;
                            });

                            const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
                            let emails = pageContent.match(emailRegex);

                            if (emails) {
                                emails = [...new Set(emails)];
                            }
                            email = emails ? emails[0] : null;
                        }
                    }
                    const pages = await browser.pages();
                    if (pages.length > 2 && pages[2]) {
                        await pages[2].close();
                    }
                    // get the data
                    const name = await page.evaluate(el => el.textContent, companyName);
                    const address = await page.evaluate(el => el.textContent, companyAddress);
                    const phone = await page.evaluate(el => el.textContent, companyPhone);
                    const website = companyWebsite ? await page.evaluate(el => el.textContent, companyWebsite) : 'No website';
                    const mail = email ? await page.evaluate(el => el.textContent, email) : 'No mail'
                    data.push({name, address, phone, website, mail});
                    await page.waitForSelector('div[data-tag="detailsCardBackBtnContainer"]', { visible: true });
                    const divBack = await page.$('div[data-tag="detailsCardBackBtnContainer"]');
                    const backToList = await divBack.$("a.backArrowButton");
                    await backToList.click();
                }
                await page.waitForSelector('div.bm_svrpagination');
                const pagination = await page.$('div.bm_svrpagination');
                const nextPageButton = await pagination.$('a[aria-label="Next Page"]');
                if (nextPageButton) {
                    await nextPageButton.click();
                    console.log('next page');
                    // Attendre le chargement des nouveaux résultats
                    await page.waitForNavigation();
                } else {
                    hasNextPage = false;
                }
            } else {
                hasNextPage = false;
            }

        } while (hasNextPage);

        await page.waitForNavigation();

        // Fermer le navigateur
    } catch (e) {
        console.log(e);
        message = e;
        code = 500;
    }
    await browser.close();

    res.send({data: data, code: code, message: message});
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
