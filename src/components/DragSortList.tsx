import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityActionEvent,
  Animated,
  PanResponder,
  StyleSheet,
  View,
  ViewProps,
} from 'react-native';
import { spacing } from '../theme';
import { moveItem, slotAt } from '../utils';

/** Height of every row while a drag is in progress (rows fold to this). */
export const COLLAPSED_HEIGHT = 72;
export const ITEM_GAP = spacing(3);
const STEP = COLLAPSED_HEIGHT + ITEM_GAP;
/** Finger travel before a touch on the handle turns into a drag. */
const DRAG_SLOP = 4;

export interface DragItemState {
  /** True for every row while any row is being dragged: render it short. */
  collapsed: boolean;
  /** True for the row under the finger. */
  dragging: boolean;
  /** Spread onto the grab handle (gesture + screen-reader move actions). */
  handleProps: ViewProps;
}

interface Controller {
  begin: (id: string) => void;
  move: (dy: number, pageY: number) => void;
  end: () => void;
}

/**
 * A list whose rows are reordered by dragging a handle.
 *
 * Rows can be any height, so grabbing a handle folds every row down to
 * COLLAPSED_HEIGHT; that way the whole list fits on screen and a row can be
 * carried anywhere without auto-scrolling. The grabbed row follows the finger,
 * the others slide aside, and on release everything unfolds in the new order.
 * Built on PanResponder, so it needs no native gesture library.
 *
 * `renderItem` must give a row that is exactly COLLAPSED_HEIGHT tall when
 * `collapsed` is true, and must keep the handle mounted in both states (the
 * gesture lives on it).
 */
export function DragSortList<T extends { id: string }>({
  items,
  renderItem,
  onReorder,
  onDragChange,
}: {
  items: T[];
  renderItem: (item: T, state: DragItemState) => React.ReactNode;
  /** Called with the new id order when a drop lands in a different slot. */
  onReorder: (ids: string[]) => void;
  /** Lets the parent freeze its ScrollView while a row is being dragged. */
  onDragChange?: (dragging: boolean) => void;
}) {
  const ids = items.map(i => i.id);
  const [drag, setDrag] = useState<{
    id: string;
    from: string[];
    order: string[];
  } | null>(null);

  // translateY per row, created on first sight of an id
  const ys = useRef(new Map<string, Animated.Value>()).current;
  const yOf = useCallback(
    (id: string) => {
      let v = ys.get(id);
      if (!v) {
        v = new Animated.Value(0);
        ys.set(id, v);
      }
      return v;
    },
    [ys],
  );

  const containerRef = useRef<React.ComponentRef<typeof View>>(null);
  const containerY = useRef<number | null>(null);
  const finger = useRef(0);
  const live = useRef<{
    id: string;
    started: boolean;
    startIndex: number;
    from: string[];
    order: string[];
  } | null>(null);
  const latest = useRef({ ids, onReorder, onDragChange });
  latest.current = { ids, onReorder, onDragChange };

  // Rows other than the dragged one slide to make room
  const orderKey = drag?.order.join('\u0000');
  const draggedId = drag?.id;
  useEffect(() => {
    if (!drag) return;
    const slides = drag.order.flatMap((id, slot) =>
      id === drag.id
        ? []
        : Animated.timing(yOf(id), {
            toValue: (slot - drag.from.indexOf(id)) * STEP,
            duration: 160,
            useNativeDriver: false,
          }),
    );
    slides.forEach(a => a.start());
    return () => slides.forEach(a => a.stop());
    // `drag` is read through orderKey/draggedId on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey, draggedId, yOf]);

  // After a drop the rows are laid out in their new order, so clear the offsets
  useLayoutEffect(() => {
    if (!drag) ys.forEach(v => v.setValue(0));
  }, [drag, ys]);

  /** Puts the dragged row under the finger and works out its slot. */
  const place = useCallback(() => {
    const l = live.current;
    if (!l || !l.started || containerY.current === null) return;
    const count = l.from.length;
    const top = Math.max(
      0,
      Math.min(
        (count - 1) * STEP,
        finger.current - containerY.current - COLLAPSED_HEIGHT / 2,
      ),
    );
    yOf(l.id).setValue(top - l.startIndex * STEP);
    const slot = slotAt(top, STEP, count);
    const at = l.order.indexOf(l.id);
    if (slot !== at) {
      l.order = moveItem(l.order, at, slot);
      setDrag({ id: l.id, from: l.from, order: l.order });
    }
  }, [yOf]);

  /** Where the list sits on screen; it moves when the rows fold. */
  const measure = useCallback(() => {
    containerRef.current?.measureInWindow((_x, y) => {
      if (
        containerY.current === null ||
        Math.abs(containerY.current - y) > 0.5
      ) {
        containerY.current = y;
        place();
      }
    });
  }, [place]);

  const ctl = useRef<Controller>({
    begin: id => {
      const from = latest.current.ids;
      live.current = {
        id,
        started: false,
        startIndex: from.indexOf(id),
        from,
        order: from,
      };
    },

    move: (dy, pageY) => {
      const l = live.current;
      if (!l) return;
      finger.current = pageY;
      if (!l.started) {
        if (Math.abs(dy) < DRAG_SLOP) return;
        l.started = true;
        containerY.current = null; // layout is about to change; re-measure
        setDrag({ id: l.id, from: l.from, order: l.order });
        latest.current.onDragChange?.(true);
        return;
      }
      place();
      measure();
    },

    end: () => {
      const l = live.current;
      if (!l) return;
      live.current = null;
      if (!l.started) return;
      const slot = l.order.indexOf(l.id);
      // Settle into the slot, then hand the new order to the parent
      Animated.timing(yOf(l.id), {
        toValue: (slot - l.startIndex) * STEP,
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

  const moveBy = (id: string, delta: number) => {
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from >= 0 && to >= 0 && to < ids.length) {
      onReorder(moveItem(ids, from, to));
    }
  };

  return (
    <View
      ref={containerRef}
      onLayout={() => {
        if (live.current?.started) measure();
      }}
    >
      {items.map(item => (
        <Row
          key={item.id}
          id={item.id}
          y={yOf(item.id)}
          collapsed={!!drag}
          dragging={item.id === draggedId}
          ctl={ctl}
          onMoveBy={d => moveBy(item.id, d)}
          render={state => renderItem(item, state)}
        />
      ))}
    </View>
  );
}

function Row({
  id,
  y,
  collapsed,
  dragging,
  ctl,
  onMoveBy,
  render,
}: {
  id: string;
  y: Animated.Value;
  collapsed: boolean;
  dragging: boolean;
  ctl: Controller;
  onMoveBy: (delta: number) => void;
  render: (state: DragItemState) => React.ReactNode;
}) {
  const pan = useMemo(
    () =>
      PanResponder.create({
        // Claim the touch straight away so the ScrollView can't steal it
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => ctl.begin(id),
        onPanResponderMove: (e, g) => ctl.move(g.dy, e.nativeEvent.pageY),
        onPanResponderRelease: () => ctl.end(),
        onPanResponderTerminate: () => ctl.end(),
      }),
    [id, ctl],
  );

  const handleProps: ViewProps = {
    ...pan.panHandlers,
    accessible: true,
    accessibilityActions: [
      { name: 'moveUp', label: 'Move up' },
      { name: 'moveDown', label: 'Move down' },
    ],
    onAccessibilityAction: (e: AccessibilityActionEvent) =>
      onMoveBy(e.nativeEvent.actionName === 'moveUp' ? -1 : 1),
  };

  return (
    <Animated.View
      style={[
        styles.row,
        collapsed && styles.collapsed,
        dragging && styles.lifted,
        { transform: [{ translateY: y }] },
      ]}
    >
      {render({ collapsed, dragging, handleProps })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: ITEM_GAP },
  collapsed: { height: COLLAPSED_HEIGHT, overflow: 'hidden' },
  lifted: { zIndex: 10, elevation: 8 },
});
