/**
 * Click-to-edit behaviour for the poster's editable SVG <text> nodes
 * (title / date / place). A floating <input> is positioned over the clicked
 * text using its live bounding box; committing the edit writes the new
 * value back onto the SVG text node and reports it via onCommit so the
 * caller can persist the override across re-renders.
 */
export function enableInlineEditing(
  svg: SVGSVGElement,
  onCommit: (elementId: string, value: string) => void,
): void {
  svg.querySelectorAll<SVGTextElement>('text.editable').forEach((node) => {
    node.addEventListener('click', () => startEditing(node, onCommit));
  });
}

function startEditing(
  node: SVGTextElement,
  onCommit: (elementId: string, value: string) => void,
): void {
  const existing = document.querySelector('.inline-edit-input');
  if (existing) existing.remove();

  const rect = node.getBoundingClientRect();
  const computed = window.getComputedStyle(node);

  const input = document.createElement('input');
  input.className = 'inline-edit-input';
  input.value = node.textContent ?? '';
  input.maxLength = 80;
  input.style.position = 'fixed';
  input.style.left = `${rect.left - 4}px`;
  input.style.top = `${rect.top - 6}px`;
  input.style.width = `${Math.max(rect.width + 40, 120)}px`;
  input.style.fontFamily = computed.fontFamily;
  input.style.fontSize = computed.fontSize;
  input.style.fontWeight = computed.fontWeight;
  input.style.letterSpacing = computed.letterSpacing;
  input.style.textAlign = node.getAttribute('text-anchor') === 'end' ? 'right' : 'left';

  document.body.appendChild(input);
  input.focus();
  input.select();

  const commit = () => {
    const value = input.value.trim();
    if (value) {
      node.textContent = value;
      onCommit(node.id, value);
    }
    input.remove();
  };

  const cancel = () => input.remove();

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      input.removeEventListener('blur', commit);
      cancel();
    }
  });
}
