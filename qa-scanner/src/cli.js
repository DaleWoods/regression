#!/usr/bin/env node
// CLI entry point — run a scan without the web app.
//
//   node src/cli.js --sitemap https://example.com/sitemap.xml [--max-pages 50]
//   node src/cli.js --urls https://a.com/x,https://a.com/y --out out/
//   node src/cli.js --brand goldsmiths
import { collectUrls } from './sitemap.js';
import { scanSite } from './scan.js';
import { writeReports } from './report.js';
import { config, findBrand } from './config.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'no-semantic') args.noSemantic = true;
    else args[key] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

let source = null;
let brand = null;
if (args.brand) {
  brand = findBrand(args.brand);
  if (!brand) {
    console.error(`Unknown brand "${args.brand}" — check config/brands.json`);
    process.exit(1);
  }
  source = brand.sitemapUrl;
} else if (args.urls) {
  source = args.urls.split(',').map((u) => u.trim()).filter(Boolean);
} else if (args.sitemap) {
  source = args.sitemap;
} else {
  console.error(
    'Usage: node src/cli.js (--sitemap <url|file> | --urls <u1,u2,...> | --brand <id>) ' +
      '[--max-pages N] [--concurrency N] [--out dir] [--no-semantic]'
  );
  process.exit(1);
}

const maxPages = parseInt(args['max-pages'] || '', 10) || brand?.maxPages || config.maxPages;
const concurrency =
  parseInt(args.concurrency || '', 10) || brand?.concurrency || config.scanConcurrency;
const outDir = args.out || 'out';

const urls = await collectUrls(source, { limit: maxPages });
if (urls.length === 0) {
  console.error('No URLs collected — check the sitemap/URL input.');
  process.exit(1);
}
console.log(`Scanning ${urls.length} page(s), concurrency ${concurrency}...`);

const results = await scanSite({
  urls,
  brand: brand ? { id: brand.id, name: brand.name } : null,
  concurrency,
  semantic: args.noSemantic ? false : undefined,
  onProgress: ({ done, total, currentUrl }) =>
    console.log(`  [${done}/${total}] ${currentUrl}`),
});

const files = writeReports(results, outDir);
console.log(
  `Done: ${results.summary.total} issue(s) on ${results.summary.pagesWithIssues} page(s).`
);
console.log(`  ${files.html}\n  ${files.csv}\n  ${files.json}`);
