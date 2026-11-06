import type { ReactNode } from "react";

/**
 * Splits a title into words that rise one after the other behind a mask when the
 * title is revealed (see use-landing-motion.ts). The text stays plain words
 * separated by spaces, so it reads normally for screen readers and search engines.
 */
export function SplitWords({ text, offset = 0 }: Readonly<{ text: string; offset?: number }>): ReactNode {
  return text.split(" ").map((word, i, words) => (
    <span key={`${i}-${word}`}>
      <span className="lp-w">
        <span style={{ "--i": i + offset } as React.CSSProperties}>{word}</span>
      </span>
      {i < words.length - 1 ? " " : null}
    </span>
  ));
}
