const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'foo.html'), 'utf-8');
const iterations = 100;
const n = new Date().getTime();
for (var i = 0; i < iterations; i++) {
  const dom = new JSDOM(html);
  const $ = (require('jquery'))(dom.window);
  const itemtext = $('h1[itemprop="name"]').text();
  // console.log(itemtext);
}
const n2 = new Date().getTime();
console.log('time per: ', (n2 - n) / iterations);