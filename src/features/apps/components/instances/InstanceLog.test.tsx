import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import InstanceLog from './InstanceLog';

const VIEWPORT_HEIGHT = 100;
const CONTENT_HEIGHT = 1_000;

// jsdom does no layout, so the scroll metrics the follow-tail effect reads have to be faked.
function stubLayout(output: HTMLElement) {
  let scrollTop = 0;
  Object.defineProperty(output, 'clientHeight', { configurable: true, value: VIEWPORT_HEIGHT });
  Object.defineProperty(output, 'scrollHeight', { configurable: true, value: CONTENT_HEIGHT });
  Object.defineProperty(output, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (next: number) => {
      scrollTop = next;
    },
  });
  return {
    scrollTo(next: number) {
      scrollTop = next;
      fireEvent.scroll(output);
    },
  };
}

describe('InstanceLog follow tail', () => {
  it('scrolls to the end when new output arrives', () => {
    const { rerender } = render(<InstanceLog text="first line" loading={false} />);
    const output = screen.getByRole('log');
    stubLayout(output);

    rerender(<InstanceLog text={'first line\nsecond line'} loading={false} />);

    expect(output.scrollTop).toBe(CONTENT_HEIGHT);
  });

  it('keeps the reader in place when they have scrolled back', () => {
    const { rerender } = render(<InstanceLog text="first line" loading={false} />);
    const output = screen.getByRole('log');
    const layout = stubLayout(output);

    layout.scrollTo(0);
    rerender(<InstanceLog text={'first line\nsecond line'} loading={false} />);

    expect(output.scrollTop).toBe(0);
  });

  it('resumes following once the reader returns to the end', () => {
    const { rerender } = render(<InstanceLog text="first line" loading={false} />);
    const output = screen.getByRole('log');
    const layout = stubLayout(output);

    layout.scrollTo(0);
    rerender(<InstanceLog text={'first line\nsecond line'} loading={false} />);
    layout.scrollTo(CONTENT_HEIGHT - VIEWPORT_HEIGHT);
    rerender(<InstanceLog text={'first line\nsecond line\nthird line'} loading={false} />);

    expect(output.scrollTop).toBe(CONTENT_HEIGHT);
  });
});
