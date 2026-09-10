import { el } from './dom';

/** Sparse, slow-drifting decorative snow particles for the atelier backdrop. Purely visual. */
export function mountSnowfall(container: HTMLElement, count = 22): void {
  const layer = el('div', { class: 'snowfall', 'aria-hidden': 'true' });
  for (let i = 0; i < count; i++) {
    const size = 2 + Math.random() * 3.2;
    const left = Math.random() * 100;
    const duration = 18 + Math.random() * 22;
    const delay = -Math.random() * duration;
    const drift = (Math.random() - 0.5) * 60;
    const opacity = 0.12 + Math.random() * 0.22;
    const flake = el('span', { class: 'snowflake-dot' });
    flake.style.left = `${left}%`;
    flake.style.width = `${size}px`;
    flake.style.height = `${size}px`;
    flake.style.animationDuration = `${duration}s`;
    flake.style.animationDelay = `${delay}s`;
    flake.style.setProperty('--drift', `${drift}px`);
    flake.style.opacity = String(opacity);
    layer.append(flake);
  }
  container.append(layer);
}
