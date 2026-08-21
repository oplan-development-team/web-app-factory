import type { ReactNode } from 'react';

interface SectionProps {
  /** 通し番号。製版の工程表らしく、順序があることを見せる */
  step: string;
  title: string;
  children: ReactNode;
}

export function Section({ step, title, children }: SectionProps) {
  return (
    <section className="panel">
      <h2 className="panel-heading">
        <span className="numeral panel-step" aria-hidden="true">
          {step}
        </span>
        <span className="panel-title">{title}</span>
      </h2>
      <div className="panel-body">{children}</div>
    </section>
  );
}
