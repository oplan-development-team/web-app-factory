// Vite inlines the file contents at transform time, which works under both the
// node and jsdom test environments (import.meta.url is not a file: URL in
// jsdom, so reading from disk here would not).
import indexHtml from '../index.html?raw';

/**
 * Installs the real index.html body into the jsdom document.
 *
 * Tests read the shipped markup rather than a hand-written fixture on purpose:
 * every id the app looks up is checked against the document users actually
 * get, so renaming one in the markup fails a test instead of failing at
 * runtime.
 */
export function mountAppMarkup(doc: Document = document): void {
  const body = /<body>([\s\S]*?)<script/.exec(indexHtml)?.[1];

  if (body === undefined) {
    throw new Error('Could not extract the <body> of index.html for the test fixture.');
  }

  doc.body.innerHTML = body;
}
