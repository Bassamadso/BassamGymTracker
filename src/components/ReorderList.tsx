import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { moveItem, slotAt } from '../utils';

export interface ReorderItem {
  id: string;
  title: string;
  subtitle?: string;
}

const ROW_HEIGHT = 64;
const GAP = spacing(2);
const STEP = ROW_HEIGHT + GAP;

interface Controller {
  begin: (id: string) => void;
  move: (dy: number) => void;
  end: () => void;
}

/**
 * A short list of fixed-height rows the user reorders by dragging the ≡ handle.
 * Rows are absolutely positioned: the dragged row follows the finger while the
 * others slide into the gap it leaves. Built on PanResponder so it needs no
 * native gesture library.
 */
export function ReorderList({
  items,
  onReorder,
  onDragChange,
}: {
  items: ReorderItem[];
  /** Called with the new id order when a drag ends in a different slot. */
  onReorder: (ids: string[]) => void;
  /** Lets the parent freeze its ScrollView while a row is being dragged. */
  onDragChange?: (dragging: boolean) => void;
}) {
  const ids = items.map(i => i.id);
  const [drag, setDrag] = useState<{ id: string; order: string[] } | null>(
    null,
  );
  const order = drag ? drag.order : ids;

  // One animated `top` per row, created on first sight of an id
  const tops = useRef(new Map<string, Animated.Value>()).current;
  const topOf = useCallback(
    (id: string, index: number) => {
      let v = tops.get(id);
      if (!v) {
        v = new Animated.Value(index * STEP);
        tops.set(id, v);
      }
      return v;
    },
    [tops],
  );

  // Slide every row except the one under the finger to its slot
  const orderKey = order.join('\u0000');
  const draggedId = drag?.id;
  useEffect(() => {
    const slides = orderKey.split('\u0000').flatMap((id, i) =>
      id === draggedId
        ? []
        : Animated.timing(topOf(id, i), {
            toValue: i * STEP,
            duration: 160,
            useNativeDriver: false,
          }),
    );
    slides.forEach(a => a.start());
    return () => slides.forEach(a => a.stop());
  }, [orderKey, draggedId, topOf]);

  // Gesture handlers must not close over stale props, so they go through a ref
  const live = useRef<{
    id: string;
    start: number;
    from: string[];
    order: string[];
  } | null>(null);
  const latest = useRef({ ids, onReorder, onDragChange });
  latest.current = { ids, onReorder, onDragChange };

  const ctl = useRef<Controller>({
    begin: id => {
      const current = latest.current.ids;
      live.current = {
        id,
        start: current.indexOf(id) * STEP,
        from: current,
        order: current,
      };
      setDrag({ id, order: current });
      latest.current.onDragChange?.(true);
    },
    move: dy => {
      const l = live.current;
      if (!l) return;
      const count = l.order.length;
      const top = Math.max(0, Math.min((count - 1) * STEP, l.start + dy));
      topOf(l.id, 0).setValue(top);
      const slot = slotAt(top, STEP, count);
      const at = l.order.indexOf(l.id);
      if (slot !== at) {
        l.order = moveItem(l.order, at, slot);
        setDrag({ id: l.id, order: l.order });
      }
    },
    end: () => {
      const l = live.current;
      if (!l) return;
      live.current = null;
      // Settle into the slot, then hand the new order to the parent
      Animated.timing(topOf(l.id, 0), {
        toValue: l.order.indexOf(l.id) * STEP,
        duration: 120,
        useNativeDriver: false,
      }).start(() => {
        if (l.order.some((id, i) => id !== l.from[i])) {
          latest.current.onReorder(l.order);
        }
        // A new drag may have started while this one was settling
        if (live.current) return;
        setDrag(null);
        latest.current.onDragChange?.(false);
      });
    },
  }).current;

  return (
    <View style={{ height: Math.max(0, items.length * STEP - GAP) }}>
      {items.map(item => {
        const index = order.indexOf(item.id);
        return (
          <Row
            key={item.id}
            item={item}
            index={index}
            count={items.length}
            top={topOf(item.id, index)}
            dragging={item.id === draggedId}
            ctl={ctl}
            onMove={to => {
              if (to >= 0 && to < ids.length) {
                onReorder(moveItem(ids, ids.indexOf(item.id), to));
              }
            }}
          />
        );
      })}
    </View>
  );
}

function Row({
  item,
  index,
  count,
  top,
  dragging,
  ctl,
  onMove,
}: {
  item: ReorderItem;
  index: number;
  count: number;
  top: Animated.Value;
  dragging: boolean;
  ctl: Controller;
  onMove: (to: number) => void;
}) {
  const { id } = item;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Once the drag starts, don't let the ScrollView take it over
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => ctl.begin(id),
        onPanResponderMove: (_, g) => ctl.move(g.dy),
        onPanResponderRelease: () => ctl.end(),
        onPanResponderTerminate: () => ctl.end(),
      }),
    [id, ctl],
  );

  return (
    <Animated.View
      accessible
      accessibilityLabel={`${item.title}. Position ${index + 1} of ${count}`}
      accessibilityActions={[
        { name: 'moveUp', label: 'Move up' },
        { name: 'moveDown', label: 'Move down' },
      ]}
      onAccessibilityAction={e =>
        onMove(index + (e.nativeEvent.actionName === 'moveUp' ? -1 : 1))
      }
      style={[styles.row, { top }, dragging && styles.rowLifted]}
    >
      <View
        {...pan.panHandlers}
        style={styles.handle}
        testID={`drag-handle-${id}`}
        hitSlop={{ top: 8, bottom: 8 }}
      >
        <Text style={styles.grip}>≡</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {item.subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={styles.position}>{index + 1}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowLifted: {
    zIndex: 10,
    elevation: 8,
    borderColor: colors.accent,
    backgroundColor: colors.cardAlt,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  handle: {
    width: 56,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grip: { color: colors.muted, fontSize: 26, fontWeight: '700' },
  text: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  position: {
    color: colors.muted,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    paddingHorizontal: spacing(4),
  },
});
