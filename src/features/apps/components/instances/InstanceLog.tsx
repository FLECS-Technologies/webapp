import { useLayoutEffect, useRef } from 'react';

// How close to the end the view must be for the log to keep following new output.
const FOLLOW_TAIL_THRESHOLD_PX = 24;

interface InstanceLogProps {
  text: string;
  loading: boolean;
  error?: string;
}

export default function InstanceLog({ text, loading, error }: InstanceLogProps) {
  const outputRef = useRef<HTMLPreElement>(null);
  const followTailRef = useRef(true);
  const content = loading && !text ? 'Loading log...' : text;

  const handleScroll = () => {
    const output = outputRef.current;
    if (!output) return;
    const distanceFromBottom = output.scrollHeight - output.scrollTop - output.clientHeight;
    followTailRef.current = distanceFromBottom <= FOLLOW_TAIL_THRESHOLD_PX;
  };

  useLayoutEffect(() => {
    const output = outputRef.current;
    if (!output || !followTailRef.current) return;
    output.scrollTop = output.scrollHeight;
  }, [content]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3" data-testid="log-editor">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-error/25 bg-error/5 px-3 py-2 text-sm text-error"
        >
          {error}
        </div>
      )}
      <pre
        ref={outputRef}
        onScroll={handleScroll}
        role="log"
        aria-busy={loading}
        aria-live="polite"
        className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-surface p-4 font-mono text-sm leading-relaxed text-text-primary [scrollbar-gutter:stable]"
      >
        {content}
      </pre>
    </div>
  );
}
