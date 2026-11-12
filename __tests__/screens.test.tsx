import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { buildPlan, SPLITS } from '../src/plans';
import { initialState } from '../src/store';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const textOf = (r: ReactTestRenderer.ReactTestRenderer) =>
  JSON.stringify(r.toJSON());

let r!: ReactTestRenderer.ReactTestRenderer;
const render = async () => {
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(<App />);
  });
  return r;
};

beforeEach(() => AsyncStorage.clear());
afterEach(() => ReactTestRenderer.act(() => r.unmount()));

test('home invites the user to set up a plan', async () => {
  await render();
  expect(textOf(r)).toContain('Plan your training week');
});

test('home shows the plan days and starts the next one', async () => {
  const routines = buildPlan(SPLITS[0], initialState.exercises);
  await AsyncStorage.setItem('gymtracker:v1', JSON.stringify({ routines }));
  await render();
  const json = textOf(r);
  expect(json).toContain('START PUSH');
  expect(json).toContain('NEXT UP');
  expect(json).toContain('Legs');

  const start = r.root.find(
    n =>
      n.props.accessibilityRole === 'button' &&
      typeof n.props.onPress === 'function' &&
      n.findAll(c => c.props.children === 'START PUSH').length > 0,
  );
  await ReactTestRenderer.act(async () => start.props.onPress());
  expect(textOf(r)).toContain('Bench Press');
  expect(textOf(r)).toContain('Target 4 × 6-8');
});

describe('a started plan day', () => {
  const press = (label: string) =>
    r.root.find(
      n =>
        n.props.accessibilityRole === 'button' &&
        typeof n.props.onPress === 'function' &&
        n.findAll(c => c.props.children === label).length > 0,
    );

  const startPush = async () => {
    const routines = buildPlan(SPLITS[0], initialState.exercises);
    await AsyncStorage.setItem('gymtracker:v1', JSON.stringify({ routines }));
    await render();
    await ReactTestRenderer.act(async () =>
      press('START PUSH').props.onPress(),
    );
  };

  test('shows its name as text that cannot be edited', async () => {
    await startPush();
    expect(textOf(r)).toContain('"Push"');
    expect(
      r.root.findAll(n => n.props.accessibilityLabel === 'Workout name'),
    ).toHaveLength(0);
  });

  test('an empty workout can still be renamed', async () => {
    await render();
    await ReactTestRenderer.act(async () =>
      press('START WORKOUT').props.onPress(),
    );
    expect(
      r.root.findAll(n => n.props.accessibilityLabel === 'Workout name').length,
    ).toBeGreaterThan(0);
  });

  test('exercises can be reordered and the new order is kept', async () => {
    await startPush();
    const firstIndex = (s: string) => textOf(r).indexOf(s);
    // Plan order: Bench Press, then Incline Dumbbell Press
    expect(firstIndex('Bench Press')).toBeLessThan(
      firstIndex('Incline Dumbbell Press'),
    );

    await ReactTestRenderer.act(async () =>
      press('⇅  Reorder').props.onPress(),
    );
    expect(
      r.root.findAll(n => n.props.testID?.startsWith('drag-handle-')).length,
    ).toBeGreaterThan(0);
    // Set inputs are hidden while reordering
    expect(textOf(r)).not.toContain('Set 1 weight');

    // Same action a screen reader uses to move a row down
    const row = r.root.find(
      n =>
        typeof n.props.onAccessibilityAction === 'function' &&
        String(n.props.accessibilityLabel).startsWith('Bench Press'),
    );
    await ReactTestRenderer.act(async () =>
      row.props.onAccessibilityAction({
        nativeEvent: { actionName: 'moveDown' },
      }),
    );
    expect(firstIndex('Incline Dumbbell Press')).toBeLessThan(
      firstIndex('Bench Press'),
    );

    // Leaving reorder mode shows the exercises in the new order
    await ReactTestRenderer.act(async () => press('Done').props.onPress());
    expect(textOf(r)).toContain('Set 1 weight');
    expect(firstIndex('Incline Dumbbell Press')).toBeLessThan(
      firstIndex('Bench Press'),
    );
  });
});

describe('day editor', () => {
  const buttons = (label: string) =>
    r.root.findAll(
      n =>
        n.props.accessibilityRole === 'button' &&
        typeof n.props.onPress === 'function' &&
        n.findAll(c => c.props.children === label).length > 0,
    );

  const handles = () =>
    r.root.findAll(
      n =>
        typeof n.props.onAccessibilityAction === 'function' &&
        String(n.props.accessibilityLabel).startsWith('Reorder '),
    );

  /** Exercise names in the editor, top to bottom. */
  const editorOrder = () =>
    Array.from(
      new Set(
        handles().map(
          n => /^Reorder (.*)\. Drag/.exec(n.props.accessibilityLabel)![1],
        ),
      ),
    );

  const handle = (name: string) =>
    handles().find(n =>
      n.props.accessibilityLabel.startsWith(`Reorder ${name}.`),
    )!;

  const move = (name: string, actionName: 'moveUp' | 'moveDown') =>
    ReactTestRenderer.act(async () =>
      handle(name).props.onAccessibilityAction({ nativeEvent: { actionName } }),
    );

  const openPushEditor = async () => {
    const routines = buildPlan(SPLITS[0], initialState.exercises);
    await AsyncStorage.setItem('gymtracker:v1', JSON.stringify({ routines }));
    await render();
    // First "Edit" on the home screen belongs to the Push day
    await ReactTestRenderer.act(async () => buttons('Edit')[0].props.onPress());
  };

  const PUSH = [
    'Bench Press',
    'Incline Dumbbell Press',
    'Overhead Press',
    'Lateral Raise',
    'Tricep Pushdown',
  ];

  test('has a drag handle on every exercise instead of move-up buttons', async () => {
    await openPushEditor();
    expect(editorOrder()).toEqual(PUSH);
    // The touch handlers that start a drag live on the handle
    expect(handles()[0].props.onStartShouldSetResponder).toBeDefined();
    expect(
      r.root.findAll(n =>
        String(n.props.accessibilityLabel).startsWith('Move '),
      ),
    ).toHaveLength(0);
  });

  test('moving an exercise changes the saved order', async () => {
    await openPushEditor();
    await move('Bench Press', 'moveDown');
    expect(editorOrder()).toEqual([
      'Incline Dumbbell Press',
      'Bench Press',
      ...PUSH.slice(2),
    ]);

    // Saving returns home, where the plan lists the new order
    await ReactTestRenderer.act(async () => buttons('Save')[0].props.onPress());
    expect(handles()).toHaveLength(0);
    expect(textOf(r)).toContain(
      'Incline Dumbbell Press · Bench Press · Overhead Press',
    );
  });

  test('cancelling discards the new order', async () => {
    await openPushEditor();
    await move('Bench Press', 'moveDown');
    await ReactTestRenderer.act(async () =>
      buttons('Cancel')[0].props.onPress(),
    );
    expect(handles()).toHaveLength(0);
    expect(textOf(r)).toContain(
      'Bench Press · Incline Dumbbell Press · Overhead Press',
    );
  });

  test('the first exercise cannot move up and the last cannot move down', async () => {
    await openPushEditor();
    await move('Bench Press', 'moveUp');
    await move('Tricep Pushdown', 'moveDown');
    expect(editorOrder()).toEqual(PUSH);
  });

  test('an exercise can travel several slots through repeated moves', async () => {
    await openPushEditor();
    await move('Tricep Pushdown', 'moveUp');
    await move('Tricep Pushdown', 'moveUp');
    await move('Tricep Pushdown', 'moveUp');
    expect(editorOrder()).toEqual([
      'Bench Press',
      'Tricep Pushdown',
      'Incline Dumbbell Press',
      'Overhead Press',
      'Lateral Raise',
    ]);
  });
});
