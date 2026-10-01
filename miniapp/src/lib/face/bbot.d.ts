/** The pinned bbot package ships JavaScript; this describes only its used public API. */
declare module '@bwnd/bbot' {
  export type Expression = 'content' | 'worried' | 'joy' | 'surprised' | 'happy' | 'curious';
  export type Face = {
    setExpression(expression: Expression): void;
    react(reaction: 'bounce' | 'nod'): void;
    talk(level: number): void;
    look(x: number, y: number, duration?: number): void;
    destroy(): void;
  };
  export function createFace(
    element: HTMLElement,
    options: { expression: Expression; mouth: boolean; blink: boolean; idle: boolean },
  ): Face;
}
