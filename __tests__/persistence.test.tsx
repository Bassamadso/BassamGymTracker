import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { AppState } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { createDataStore } from '../src/storage';
import { StoreProvider, useStore } from '../src/store';
import { failingOn, openMemoryDb } from '../test-utils/nodeSqlite';

type Api = ReturnType<typeof useStore>;

let api!: Api;
const Probe = () => {
  api = useStore();
  return null;
};

const db = () => openMemoryDb();

/** Mounts the provider on `database`, like one launch of the app. */
async function launch(openStore: () => Promise<any>) {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(
      <StoreProvider openStore={openStore}>
        <Probe />
      </StoreProvider>,
    );
  });
  return r;
}

/** Lets queued saves (a chain of promises) run to the end. */
const settle = () =>
  ReactTestRenderer.act(async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
  });

const send: Api['dispatch'] = action =>
  ReactTestRenderer.act(() => api.dispatch(action));

/** Logs one finished workout: 60 kg × 5 on Bench Press. */
async function logWorkout() {
  await send({ type: 'startWorkout' });
  await send({ type: 'addToWorkout', exerciseIds: ['default-0'] });
  const we = api.state.active!.exercises[0];
  await send({
    type: 'updateSet',
    workoutExerciseId: we.id,
    setId: we.sets[0].id,
    patch: { weight: '60', reps: '5', done: true },
  });
  await send({ type: 'finishWorkout' });
}

beforeEach(() => AsyncStorage.clear());

test('a finished workout is still there after the app restarts', async () => {
  const database = db();
  const open = () => createDataStore(database);

  let r = await launch(open);
  await logWorkout();
  // Closing the app flushes pending changes
  await ReactTestRenderer.act(() => r.unmount());
  await settle();

  r = await launch(open);
  expect(api.state.loaded).toBe(true);
  expect(api.state.history).toHaveLength(1);
  expect(api.state.history[0].exercises[0].sets[0]).toMatchObject({
    weight: '60',
    reps: '5',
    done: true,
  });
  expect(api.state.active).toBeNull();
  await ReactTestRenderer.act(() => r.unmount());
});

test('the built-in library is never saved, only what the user changed', async () => {
  const database = db();
  const open = () => createDataStore(database);

  let r = await launch(open);
  expect(api.state.exercises.length).toBeGreaterThan(800);
  await send({
    type: 'addExercise',
    exercise: { id: 'mine', name: 'Zercher Squat', muscle: 'Legs' },
  });
  await send({ type: 'deleteExercise', id: 'default-1' });
  await ReactTestRenderer.act(() => r.unmount());
  await settle();

  const rows = (await database.execute('SELECT id FROM exercises')).rows;
  expect(rows.map(x => x.id).sort()).toEqual(['default-1', 'mine']);

  r = await launch(open);
  expect(api.state.exercises.length).toBeGreaterThan(800);
  expect(api.state.exercises.find(e => e.id === 'mine')?.name).toBe(
    'Zercher Squat',
  );
  expect(api.state.exercises.find(e => e.id === 'default-1')?.archived).toBe(
    true,
  );
  await ReactTestRenderer.act(() => r.unmount());
});

test('the old save is imported on the first launch and never again', async () => {
  await AsyncStorage.setItem(
    'gymtracker:v1',
    JSON.stringify({ restSeconds: 45 }),
  );
  const database = db();
  const open = () => createDataStore(database);

  let r = await launch(open);
  expect(api.state.restSeconds).toBe(45);
  await ReactTestRenderer.act(() => r.unmount());

  // Changing the old key now has no effect: the database is the source of truth
  await AsyncStorage.setItem(
    'gymtracker:v1',
    JSON.stringify({ restSeconds: 200 }),
  );
  r = await launch(open);
  expect(api.state.restSeconds).toBe(45);
  await ReactTestRenderer.act(() => r.unmount());
});

test('the old save is left in place after importing it', async () => {
  const raw = JSON.stringify({ restSeconds: 45 });
  await AsyncStorage.setItem('gymtracker:v1', raw);
  const r = await launch(() => createDataStore(db()));
  await ReactTestRenderer.act(() => r.unmount());
  expect(await AsyncStorage.getItem('gymtracker:v1')).toBe(raw);
});

describe('write behaviour', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const advance = (ms: number) =>
    ReactTestRenderer.act(() => jest.advanceTimersByTimeAsync(ms));

  test('changes are saved after a short pause, as one small write', async () => {
    const database = db();
    const r = await launch(() => createDataStore(database));
    await advance(1000);
    await send({ type: 'startWorkout' });
    await send({ type: 'addToWorkout', exerciseIds: ['default-0'] });
    await advance(1000);

    database.statements.length = 0;
    const we = api.state.active!.exercises[0];
    for (const weight of ['6', '60', '60.', '60.5']) {
      await send({
        type: 'updateSet',
        workoutExerciseId: we.id,
        setId: we.sets[0].id,
        patch: { weight },
      });
      await advance(100);
    }
    // Still typing: nothing written yet
    expect(database.statements).toHaveLength(0);

    await advance(500);
    // Four keystrokes, one write, and only the workout-in-progress row
    expect(database.statements).toHaveLength(1);
    expect(database.statements[0]).toMatch(/INTO meta/);
    await ReactTestRenderer.act(() => r.unmount());
  });

  test('unsaved changes are written as soon as the app goes to the background', async () => {
    // Capture the handler the provider registers for app-state changes
    const original = AppState.addEventListener;
    let onChange: ((s: string) => void) | undefined;
    (AppState as any).addEventListener = (_: string, handler: any) => {
      onChange = handler;
      return { remove() {} };
    };
    try {
      const database = db();
      const r = await launch(() => createDataStore(database));
      await advance(1000);
      await send({ type: 'setRestSeconds', seconds: 150 });

      const saved = () =>
        database.execute("SELECT value FROM meta WHERE key = 'restSeconds'");
      // Within the save delay: not written yet
      expect((await saved()).rows).toHaveLength(0);

      await ReactTestRenderer.act(async () => onChange!('background'));
      await advance(10);
      expect((await saved()).rows[0].value).toBe('150');
      await ReactTestRenderer.act(() => r.unmount());
    } finally {
      (AppState as any).addEventListener = original;
    }
  });
});

describe('when the database cannot be used', () => {
  test('the old save is shown but never written to', async () => {
    const raw = JSON.stringify({ restSeconds: 45 });
    await AsyncStorage.setItem('gymtracker:v1', raw);
    const r = await launch(() => Promise.reject(new Error('no native module')));

    expect(api.state.loaded).toBe(true);
    expect(api.state.restSeconds).toBe(45);

    await send({ type: 'setRestSeconds', seconds: 150 });
    await ReactTestRenderer.act(() => r.unmount());
    await settle();
    expect(await AsyncStorage.getItem('gymtracker:v1')).toBe(raw);
  });

  test('a failed import falls back the same way and is retried next launch', async () => {
    const raw = JSON.stringify({ restSeconds: 45 });
    await AsyncStorage.setItem('gymtracker:v1', raw);
    const database = db();

    // First launch: the import's transaction fails when marking itself done
    let r = await launch(() => createDataStore(failingOn(database, /INTO meta/)));
    expect(api.state.loaded).toBe(true);
    expect(api.state.restSeconds).toBe(45);
    await send({ type: 'setRestSeconds', seconds: 150 });
    await ReactTestRenderer.act(() => r.unmount());
    await settle();
    expect(await AsyncStorage.getItem('gymtracker:v1')).toBe(raw);

    // Second launch, database healthy again: the import goes through
    r = await launch(() => createDataStore(database));
    expect(api.state.restSeconds).toBe(45);
    await ReactTestRenderer.act(() => r.unmount());
  });
});
