#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function die(msg) { console.error(msg); process.exit(1); }

const siteDir = process.argv[2];
const tag = process.argv[3] || '';
const dmgUrl = process.argv[4] || '';

if (!siteDir) die('Usage: update-site.js <siteDir> <tag> <dmgUrl>');

const indexPath = path.join(process.cwd(), siteDir, 'index.html');
if (!fs.existsSync(indexPath)) die('index.html not found at ' + indexPath);

let html = fs.readFileSync(indexPath, 'utf8');

const tagWithV = tag ? (tag.startsWith('v') ? tag : 'v' + tag) : '';
const softwareVersion = tagWithV.replace(/^v/, '');

// 1) Update download button href (id="download-btn")
if (dmgUrl) {
  html = html.replace(/(<a[^>]*id="download-btn"[^>]*href=")([^"]*)(")/i, function(_, a, b, c){
    return a + dmgUrl + c;
  });
}

// 2) Update visible meta paragraph with data-t="download.meta"
if (tagWithV) {
  html = html.replace(/<p[^>]*data-t="download.meta"[^>]*>[\s\S]*?<\/p>/i, `<p class="download-box__meta" data-t="download.meta">${tagWithV} Public Beta · macOS · Apple Silicon (ARM64) · Free</p>`);
}

// 3) Update JSON-LD SoftwareApplication node
const ldRe = /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i;
const match = html.match(ldRe);
if (match) {
  try {
    const json = JSON.parse(match[1]);
    if (json['@graph'] && Array.isArray(json['@graph'])) {
      for (let node of json['@graph']) {
        if (node['@type'] === 'SoftwareApplication') {
          if (softwareVersion) node.softwareVersion = softwareVersion;
          if (dmgUrl) node.downloadUrl = dmgUrl;
        }
      }
      const newLd = JSON.stringify(json, null, 2);
      html = html.replace(ldRe, `<script type="application/ld+json">\n${newLd}\n  </script>`);
    }
  } catch (e) {
    console.error('Failed to parse JSON-LD:', e.message);
  }
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log('Updated', indexPath);
