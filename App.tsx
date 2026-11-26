/**
 * Gym Tracker — log workouts, sets and exercises.
 *
 * @format
 */

import React, { useCallback, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BrandSplash } from './src/components/BrandSplash';
import { RestTimer } from './src/components/RestTimer';
import { Text } from './src/components/Text';
import { I18nProvider, useI18n } from './src/i18n';
import type { MessageKey } from './src/i18n/en';
import { ExercisesScreen } from './src/screens/ExercisesScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { StoreProvider, useStore } from './src/store';
import { colors, spacing } from './src/theme';

type Tab = 'workout' | 'history' | 'exercises';

const TABS: { key: Tab; label: MessageKey; icon: string }[] = [
  { key: 'workout', label: 'tab.train', icon: '⚡' },
  { key: 'history', label: 'tab.history', icon: '◷' },
  { key: 'exercises', label: 'tab.library', icon: '☰' },
];

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <I18nProvider>
        <StoreProvider>
          <Root />
        </StoreProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

/** Plays the brand intro over the app while saved data and language load. */
function Root() {
  const { state } = useStore();
  const { ready: languageReady } = useI18n();
  const loaded = state.loaded && languageReady;
  const [splash, setSplash] = useState(true);
  const hideSplash = useCallback(() => setSplash(false), []);
  return (
    <View style={styles.root}>
      {loaded ? <AppContent /> : null}
      {splash ? <BrandSplash ready={loaded} onFinish={hideSplash} /> : null}
    </View>
  );
}

function AppContent() {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('workout');

  const stopRest = useCallback(
    () => dispatch({ type: 'stopRest' }),
    [dispatch],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.root}>
        {tab === 'workout' && <WorkoutScreen />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'exercises' && <ExercisesScreen />}
        {state.rest ? (
          <RestTimer
            endsAt={state.rest.endsAt}
            total={state.rest.total}
            onChange={endsAt => dispatch({ type: 'adjustRest', endsAt })}
            onDone={stopRest}
          />
        ) : null}
      </View>
      <View style={styles.tabBar}>
        {TABS.map(item => {
          const on = item.key === tab;
          const live = item.key === 'workout' && state.active;
          return (
            <Pressable
              key={item.key}
              style={styles.tab}
              onPress={() => setTab(item.key)}
            >
              <View style={[styles.tabInner, on && styles.tabInnerOn]}>
                <Text style={[styles.tabIcon, on && styles.tabOn]}>
                  {item.icon}
                </Text>
                <Text style={[styles.tabLabel, on && styles.tabOn]}>
                  {t(item.label)}
                </Text>
                {live ? <View style={styles.liveDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    marginHorizontal: spacing(4),
    marginBottom: spacing(2),
    borderRadius: 24,
    padding: spacing(1.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tab: { flex: 1 },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1.5),
    paddingVertical: spacing(3),
    borderRadius: 18,
  },
  tabInnerOn: { backgroundColor: colors.accent },
  tabIcon: { color: colors.muted, fontSize: 15 },
  tabLabel: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  tabOn: { color: colors.onAccent },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
});

export default App;
