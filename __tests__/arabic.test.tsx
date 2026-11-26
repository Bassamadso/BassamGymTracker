import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Alert } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { createI18n } from '../src/i18n/core';
import { buildPlan, SPLITS } from '../src/plans';
import { initialState } from '../src/store';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

const arabic = createI18n('ar', true);

let r!: ReactTestRenderer.ReactTestRenderer;
const textOf = () => JSON.stringify(r.toJSON());
const render = async () => {
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(<App />);
  });
};
const press = (label: string) =>
  r.root.find(
    n =>
      n.props.accessibilityRole === 'button' &&
      typeof n.props.onPress === 'function' &&
      n.findAll(c => c.props.children === label).length > 0,
  );

beforeEach(() => AsyncStorage.clear());
afterEach(() => {
  jest.restoreAllMocks();
  return ReactTestRenderer.act(() => r.unmount());
});

describe('with Arabic selected', () => {
  beforeEach(() => AsyncStorage.setItem('gymtracker:lang', 'ar'));

  test('the home screen and tabs are in Arabic', async () => {
    await render();
    const json = textOf();
    for (const word of [
      'جاهز للتمرين؟',
      'خطّط لأسبوع تدريبك',
      'تمرين',
      'السجل',
      'المكتبة',
    ]) {
      expect(json).toContain(word);
    }
    expect(json).not.toContain('Plan your training week');
    expect(json).not.toContain('Ready to lift?');
  });

  test('a plan day starts with Arabic labels and exercise names', async () => {
    const routines = buildPlan(SPLITS[0], initialState.exercises, arabic.t);
    await AsyncStorage.setItem('gymtracker:v1', JSON.stringify({ routines }));
    await render();
    expect(textOf()).toContain('ابدأ دفع');

    await ReactTestRenderer.act(async () => press('ابدأ دفع').props.onPress());
    const json = textOf();
    expect(json).toContain('ضغط البنش'); // Bench Press
    expect(json).toContain('الهدف 4 × 6-8');
    expect(json).toContain('رقم'); // SET column
    expect(json).not.toContain('Bench Press');
  });

  test('Arabic digits typed into a weight field are stored as 0–9', async () => {
    await render();
    await ReactTestRenderer.act(async () =>
      press('ابدأ التمرين').props.onPress(),
    );
    // Add the first exercise from the picker
    await ReactTestRenderer.act(async () =>
      press('+  أضف تمارين').props.onPress(),
    );
    const [row] = r.root.findAll(
      n =>
        n.props.accessibilityRole === 'checkbox' &&
        typeof n.props.onPress === 'function',
    );
    await ReactTestRenderer.act(async () => row.props.onPress());
    await ReactTestRenderer.act(async () => press('إضافة (1)').props.onPress());

    const weight = r.root.find(
      n => n.props.accessibilityLabel === 'وزن المجموعة 1 بالكيلوجرام',
    );
    await ReactTestRenderer.act(async () => weight.props.onChangeText('٦٢٫٥'));
    expect(
      r.root.find(
        n => n.props.accessibilityLabel === 'وزن المجموعة 1 بالكيلوجرام',
      ).props.value,
    ).toBe('62.5');
  });
});

describe('switching language in the app', () => {
  const switcher = (name: string) =>
    r.root.find(
      n =>
        n.props.accessibilityRole === 'button' &&
        typeof n.props.onPress === 'function' &&
        n.findAll(c => c.props.children === name).length > 0,
    );

  test('English is the default when the device is not Arabic', async () => {
    await render();
    expect(textOf()).toContain('Ready to lift?');
    expect(textOf()).toContain('Language · اللغة');
  });

  test('picking Arabic translates the UI, remembers the choice, and asks for a restart', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render();
    await ReactTestRenderer.act(async () =>
      switcher('العربية').props.onPress(),
    );

    expect(textOf()).toContain('جاهز للتمرين؟');
    expect(await AsyncStorage.getItem('gymtracker:lang')).toBe('ar');
    // The layout direction only changes after a restart (the test runs LTR)
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe('أعد التشغيل للتطبيق');
  });

  test('switching back to English restores the English UI', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await AsyncStorage.setItem('gymtracker:lang', 'ar');
    await render();
    expect(textOf()).toContain('جاهز للتمرين؟');

    await ReactTestRenderer.act(async () =>
      switcher('English').props.onPress(),
    );
    expect(textOf()).toContain('Ready to lift?');
    expect(await AsyncStorage.getItem('gymtracker:lang')).toBe('en');
  });

  test('no restart prompt when the direction already matches', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await AsyncStorage.setItem('gymtracker:lang', 'ar');
    await render();
    // English → English is a no-op as far as direction goes (the test is LTR)
    await ReactTestRenderer.act(async () =>
      switcher('English').props.onPress(),
    );
    expect(alert).not.toHaveBeenCalled();
  });
});
