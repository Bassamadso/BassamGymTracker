import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { BrandSplash } from '../src/components/BrandSplash';

// Intro is ~1.6s, fade-out 300ms; 5s covers both with room to spare.
const SETTLE_MS = 5000;

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const advance = (ms: number) =>
  ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(ms);
  });

test('finishes when data is ready before the intro has played', async () => {
  const onFinish = jest.fn();
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(
      <BrandSplash ready={false} onFinish={onFinish} />,
    );
  });

  // Saved data loads almost instantly — long before the intro ends.
  await advance(50);
  await ReactTestRenderer.act(async () => {
    r.update(<BrandSplash ready={true} onFinish={onFinish} />);
  });

  await advance(SETTLE_MS);
  expect(onFinish).toHaveBeenCalledTimes(1);
});

test('finishes when data becomes ready after the intro has played', async () => {
  const onFinish = jest.fn();
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(
      <BrandSplash ready={false} onFinish={onFinish} />,
    );
  });

  await advance(SETTLE_MS);
  expect(onFinish).not.toHaveBeenCalled();

  await ReactTestRenderer.act(async () => {
    r.update(<BrandSplash ready={true} onFinish={onFinish} />);
  });
  await advance(SETTLE_MS);
  expect(onFinish).toHaveBeenCalledTimes(1);
});
