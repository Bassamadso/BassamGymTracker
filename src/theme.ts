export const colors = {
  bg: '#0A0A0B',
  card: '#151517',
  cardAlt: '#1F1F23',
  border: '#2A2A30',
  text: '#F5F5F7',
  muted: '#8A8A93',
  accent: '#C6FF3D', // electric lime
  onAccent: '#0A0A0B',
  accentSoft: 'rgba(198, 255, 61, 0.12)',
  success: '#C6FF3D',
  successSoft: 'rgba(198, 255, 61, 0.10)',
  gold: '#FFC94D',
  goldSoft: 'rgba(255, 201, 77, 0.15)',
  danger: '#FF5A5F',
};

export const spacing = (n: number) => n * 4;

export const type = {
  kicker: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
  display: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900' as const,
    letterSpacing: -1,
  },
  number: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800' as const,
    fontVariant: ['tabular-nums' as const],
  },
};
