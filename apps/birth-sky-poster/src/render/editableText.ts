/**
 * Click-to-edit behaviour for the poster's editable SVG <text> nodes
 * (title / date / place).
 *
 * A floating <input> is positioned over the clicked text using its live
 * bounding box; committing writes the value back onto the SVG node and reports
 * it so the caller can keep the override across re-renders.
 */

const INPUT_CLASS = 'inline-edit-input';
const MAX_LENGTH = 80;

export type CommitHandler = (elementId: string, value: string) => void;

/**
 * Removes any floating editor still attached to the document.
 *
 * Called before opening a new one and before a re-render: the poster SVG is
 * replaced wholesale on every render, and an editor left behind would hover
 * over a node that no longer exists (FR-007.8).
 */
export function closeInlineEditor(doc: Document = document): void {
  doc.querySelectorAll(`.${INPUT_CLASS}`).forEach((node) => node.remove());
}

export function enableInlineEditing(svg: SVGSVGElement, onCommit: CommitHandler): void {
  svg.querySelectorAll<SVGTextElement>('text.editable').forEach((node) => {
    // The prototype bound click only, leaving these three fields unreachable
    // by keyboard. Exposing them as buttons gives them focus, a role, and an
    // activation contract (FR-007.2, NFR-005.2).
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', `${node.textContent ?? ''}（クリックまたはEnterで編集）`);

    node.addEventListener('click', () => startEditing(node, onCommit));
    node.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      startEditing(node, onCommit);
    });
  });
}

function startEditing(node: SVGTextElement, onCommit: CommitHandler): void {
  const doc = node.ownerDocument;
  const view = doc.defaultView;
  if (view === null) return;

  closeInlineEditor(doc);

  const input = doc.createElement('input');
  input.className = INPUT_CLASS;
  input.value = node.textContent ?? '';
  input.maxLength = MAX_LENGTH;
  input.setAttribute('aria-label', 'ポスターの文言を編集');

  const position = () => {
    const rect = node.getBoundingClientRect();
    const computed = view.getComputedStyle(node);

    input.style.position = 'fixed';
    input.style.left = `${rect.left - 4}px`;
    input.style.top = `${rect.top - 6}px`;
    input.style.width = `${Math.max(rect.width + 40, 120)}px`;
    input.style.fontFamily = computed.fontFamily;
    input.style.fontSize = computed.fontSize;
    input.style.fontWeight = computed.fontWeight;
    input.style.letterSpacing = computed.letterSpacing;
    input.style.textAlign = node.getAttribute('text-anchor') === 'end' ? 'right' : 'left';
  };

  position();
  doc.body.appendChild(input);
  input.focus();
  input.select();

  // A fixed-position overlay anchored to a live bounding box drifts as soon as
  // the page scrolls or reflows, so it has to follow.
  const reposition = () => position();
  view.addEventListener('scroll', reposition, true);
  view.addEventListener('resize', reposition);

  let settled = false;

  const teardown = () => {
    settled = true;
    view.removeEventListener('scroll', reposition, true);
    view.removeEventListener('resize', reposition);
    input.remove();
    node.focus();
  };

  const commit = () => {
    if (settled) return;
    const value = input.value.trim();
    teardown();
    // An empty commit keeps the previous value rather than blanking the
    // poster, which would leave the user with no handle to click back onto.
    if (value === '') return;
    node.textContent = value;
    node.setAttribute('aria-label', `${value}（クリックまたはEnterで編集）`);
    onCommit(node.id, value);
  };

  const cancel = () => {
    if (settled) return;
    teardown();
  };

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  });
}
