import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

const LOGO = require('../../assets/brand/logo-mark.png');

export const SLOGAN = ['ACHIEVE', 'DREAMS', 'STRIVE', 'ONWARD'];

/**
 * Full-screen brand intro. Picks up where the native splash leaves off
 * (logo centred on black), reveals the wordmark and slogan, then calls
 * `onFinish` once `ready` is true and the intro has played.
 */
export function BrandSplash({
  ready,
  onFinish,
}: {
  ready: boolean;
  onFinish: () => void;
}) {
  const lift = useRef(new Animated.Value(0)).current;
  const words = useRef(SLOGAN.map(() => new Animated.Value(0))).current;
  const fadeOut = useRef(new Animated.Value(1)).current;
  const introDone = useRef(false);
  // The intro callback below is created once on mount, so it must read the
  // latest `ready` through a ref — a plain closure would be stuck on `false`.
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const exiting = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const intro = Animated.sequence([
      Animated.timing(lift, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.stagger(
        140,
        words.map(w =>
          Animated.timing(w, {
            toValue: 1,
            duration: 260,
            useNativeDriver: true,
          }),
        ),
      ),
      Animated.delay(450),
    ]);
    intro.start(({ finished }) => {
      if (!finished) return; // interrupted by unmount
      introDone.current = true;
      if (readyRef.current) exit();
    });
    return () => {
      intro.stop();
      exiting.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready && introDone.current) exit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const exit = () => {
    if (exiting.current) return;
    const fade = Animated.timing(fadeOut, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    });
    exiting.current = fade;
    fade.start(({ finished }) => {
      if (finished) onFinish();
    });
  };

  const logoY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -60] });
  const textOpacity = lift;
  const textY = lift.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  return (
    <Animated.View style={[styles.root, { opacity: fadeOut }]}>
      <Animated.View style={{ transform: [{ translateY: logoY }] }}>
        <Image source={LOGO} style={styles.logo} />
      </Animated.View>
      <Animated.View
        style={[
          styles.textBlock,
          { opacity: textOpacity, transform: [{ translateY: textY }] },
        ]}
      >
        <Text style={styles.wordmark}>ADSO</Text>
        <View style={styles.slogan}>
          {SLOGAN.map((w, i) => (
            <Animated.Text key={w} style={[styles.word, { opacity: words[i] }]}>
              {i > 0 ? ' · ' : ''}
              {w}
            </Animated.Text>
          ))}
        </View>
      </Animated.View>
      <Animated.Text style={[styles.byline, { opacity: textOpacity }]}>
        by Bassam Adso
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 160, height: 160 },
  textBlock: {
    position: 'absolute',
    top: '50%',
    marginTop: 40,
    alignItems: 'center',
  },
  wordmark: {
    color: colors.text,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 12,
    marginRight: -12, // balance trailing letter spacing
  },
  slogan: { flexDirection: 'row', marginTop: spacing(3) },
  word: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  byline: {
    position: 'absolute',
    bottom: spacing(12),
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
