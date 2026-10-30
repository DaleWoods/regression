// In-page checks: broken images detected by rendering (not guessed from
// status codes), metadata gaps, link collection, and content extraction for
// the semantic layer.

export async function collectPageData(page) {
  return page.evaluate(async () => {
    const abs = (u) => {
      try {
        return new URL(u, location.href).href;
      } catch {
        return null;
      }
    };

    // Broken images: force decode so lazy/queued images are actually fetched
    // and rendered — an image is broken if decode fails or it renders 0px.
    const imgs = [...document.querySelectorAll('img')].filter((i) => i.getAttribute('src'));
    const brokenImages = [];
    await Promise.all(
      imgs.map(async (img) => {
        let broken = false;
        try {
          await Promise.race([
            img.decode(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('decode timeout')), 8000)),
          ]);
        } catch {
          broken = true;
        }
        if (!broken && img.complete && img.naturalWidth === 0) broken = true;
        if (broken) {
          brokenImages.push({
            src: abs(img.getAttribute('src')) || img.currentSrc || '',
            alt: img.getAttribute('alt') || '',
          });
        }
      })
    );

    const missingAlt = imgs
      .filter((i) => !(i.getAttribute('alt') || '').trim())
      .map((i) => abs(i.getAttribute('src')))
      .filter(Boolean);

    const metadata = {
      title: (document.title || '').trim(),
      metaDescription: (
        document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
      ).trim(),
      h1s: [...document.querySelectorAll('h1')]
        .map((h) => h.textContent.trim())
        .filter(Boolean),
      missingAltCount: missingAlt.length,
      missingAltExamples: missingAlt.slice(0, 10),
    };

    const links = [
      ...new Set(
        [...document.querySelectorAll('a[href]')]
          .map((a) => abs(a.getAttribute('href')))
          .filter((h) => h && /^https?:/i.test(h))
          .map((h) => h.split('#')[0])
      ),
    ];

    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => {
        try {
          return JSON.parse(s.textContent);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const visibleText = (document.body?.innerText || '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .slice(0, 6000);

    return {
      brokenImages,
      metadata,
      links,
      semantic: {
        title: metadata.title,
        metaDescription: metadata.metaDescription,
        h1s: metadata.h1s,
        jsonLd,
        visibleText,
      },
    };
  });
}

export function metadataIssues(md) {
  const issues = [];
  if (!md.title) {
    issues.push({ type: 'metadata', severity: 'high', message: 'Missing <title>' });
  }
  if (!md.metaDescription) {
    issues.push({ type: 'metadata', severity: 'medium', message: 'Missing meta description' });
  }
  if (md.h1s.length === 0) {
    issues.push({ type: 'metadata', severity: 'medium', message: 'No <h1> on page' });
  } else if (md.h1s.length > 1) {
    issues.push({
      type: 'metadata',
      severity: 'low',
      message: `Multiple <h1> elements (${md.h1s.length})`,
      detail: md.h1s.slice(0, 5).join(' | '),
    });
  }
  if (md.missingAltCount > 0) {
    issues.push({
      type: 'metadata',
      severity: 'low',
      message: `${md.missingAltCount} image(s) missing alt text`,
      detail: md.missingAltExamples.join('\n'),
    });
  }
  return issues;
}
