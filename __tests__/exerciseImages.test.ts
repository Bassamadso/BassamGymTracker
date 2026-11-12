import { EXERCISE_CATALOG } from '../src/exerciseCatalog';
import { exerciseImageUrl } from '../src/exerciseImages';
import { initialState } from '../src/store';

const catalogIds = new Set(EXERCISE_CATALOG.map(([id]) => id.slice(3)));

const idOf = (url: string | null) =>
  decodeURIComponent(url!.split('/exercises/')[1].split('/')[0]);

test('catalog exercises point at their dataset photo', () => {
  const url = exerciseImageUrl({ id: 'db-Air_Bike', name: 'Air Bike' });
  expect(url).toMatch(/^https:\/\/.+\/exercises\/Air_Bike\/0\.jpg$/);
});

test('every built-in exercise has a photo that exists in the dataset', () => {
  const builtIns = initialState.exercises.filter(e =>
    e.id.startsWith('default-'),
  );
  expect(builtIns.length).toBeGreaterThan(0);
  for (const e of builtIns) {
    const url = exerciseImageUrl(e);
    expect(url).not.toBeNull();
    expect(catalogIds.has(idOf(url))).toBe(true);
  }
});

test('a custom exercise named like a catalog entry reuses its photo', () => {
  const url = exerciseImageUrl({ id: 'abc', name: 'air bike' });
  expect(idOf(url)).toBe('Air_Bike');
});

test('unknown exercises have no photo', () => {
  expect(exerciseImageUrl({ id: 'abc', name: 'My Weird Move' })).toBeNull();
  expect(exerciseImageUrl(undefined)).toBeNull();
});
