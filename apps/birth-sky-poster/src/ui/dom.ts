/**
 * Checked element lookup.
 *
 * The prototype reached for `document.getElementById(id) as HTMLInputElement`
 * throughout. That cast is a lie the type system cannot catch: a renamed id in
 * index.html still compiles, then fails much later with a "cannot read
 * properties of null" thrown from deep inside a render pass. These helpers fail
 * loudly at startup instead, naming the id that went missing (NFR-008.2).
 */

export class MissingElementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingElementError';
  }
}

/** Returns the element with the given id, verifying its tag at runtime. */
export function requireElement<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  id: string,
  tag: K,
): HTMLElementTagNameMap[K] {
  const el = doc.getElementById(id);

  if (el === null) {
    throw new MissingElementError(`Required element #${id} was not found in the document.`);
  }
  if (el.localName !== tag) {
    throw new MissingElementError(
      `Required element #${id} is a <${el.localName}>, expected <${tag}>.`,
    );
  }
  // The tag has just been verified, so the narrowing below is sound.
  return el as HTMLElementTagNameMap[K];
}
