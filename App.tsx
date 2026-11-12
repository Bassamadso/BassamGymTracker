/**
 * Gym Tracker — log workouts, sets and exercises.
 *
 * @format
 */

import React, { useCallback, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BrandSplash } from './src/components/BrandSplash';
import { RestTimer } from './src/components/RestTimer';
import { ExercisesScreen } from './src/screens/ExercisesScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { StoreProvider, useStore } from './src/store';
import { colors, spacing } from './src/theme';

type Tab = 'workout' | 'history' | 'exercises';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'workout', label: 'Train', icon: '⚡' },
  { key: 'history', label: 'History', icon: '◷' },
  { key: 'exercises', label: 'Library', icon: '☰' },
];

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

/** Plays the brand intro over the app while saved data loads. */
function Root() {
  const { state } = useStore();
  const [splash, setSplash] = useState(true);
  const hideSplash = useCallback(() => setSplash(false), []);
  return (
    <View style={styles.root}>
      {state.loaded ? <AppContent /> : null}
      {splash ? (
        <BrandSplash ready={state.loaded} onFinish={hideSplash} />
      ) : null}
    </View>
  );
}

function AppContent() {
  const { state, dispatch } = useStore();
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
        {TABS.map(t => {
          const on = t.key === tab;
          const live = t.key === 'workout' && state.active;
          return (
            <Pressable
              key={t.key}
              style={styles.tab}
              onPress={() => setTab(t.key)}
            >
              <View style={[styles.tabInner, on && styles.tabInnerOn]}>
                <Text style={[styles.tabIcon, on && styles.tabOn]}>
                  {t.icon}
                </Text>
                <Text style={[styles.tabLabel, on && styles.tabOn]}>
                  {t.label}
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
