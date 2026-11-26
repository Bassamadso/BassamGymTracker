import type { Message } from './types';

/**
 * English strings — the source of truth. `ar.ts` must define every key here
 * (the compiler enforces it). `{name}` placeholders are filled from params;
 * an object value picks a form by the `count` param.
 */
export const en = {
  // Shared
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.close': 'Close',
  'common.done': 'Done',
  'common.add': 'Add',
  'common.edit': 'Edit',
  'common.start': 'Start',
  'common.finish': 'Finish',
  'common.remove': 'Remove',
  'common.delete': 'Delete',
  'common.replace': 'Replace',
  'common.discard': 'Discard',
  'common.ok': 'OK',
  'common.noExercises': 'No exercises yet',
  'unit.kg': 'kg',
  'unit.tonne': 't',

  // Counts
  'count.exercise': { one: '{count} exercise', other: '{count} exercises' },
  'count.movement': { one: '{count} movement', other: '{count} movements' },
  'count.set': { one: '{count} set', other: '{count} sets' },
  'count.session': { one: '{count} session', other: '{count} sessions' },

  // Calendar and time
  'date.long': '{weekday}, {month} {day}',
  'date.short': '{month}/{day}',
  'duration.hm': '{h}h {m}m',
  'duration.m': '{m}m',
  'greeting.morning': 'Good morning',
  'greeting.afternoon': 'Good afternoon',
  'greeting.evening': 'Good evening',

  // Tabs and language
  'tab.train': 'Train',
  'tab.history': 'History',
  'tab.library': 'Library',
  'lang.restartTitle': 'Restart to apply',
  'lang.restartMessage':
    'Close the app completely and open it again to switch the layout direction.',
  'lang.reload': 'Reload now',

  // Muscle groups
  'muscle.Chest': 'Chest',
  'muscle.Back': 'Back',
  'muscle.Legs': 'Legs',
  'muscle.Shoulders': 'Shoulders',
  'muscle.Arms': 'Arms',
  'muscle.Core': 'Core',
  'muscle.Other': 'Other',

  // Home
  'home.title': 'Ready to lift?',
  'home.thisWeek': 'This week',
  'home.workouts': 'workouts',
  'home.volume': 'Volume',
  'home.sets': 'Sets',
  'home.allTime': 'All time',
  'home.startDay': 'START {name}',
  'home.startEmpty': 'or start an empty workout',
  'home.startWorkout': 'START WORKOUT',
  'home.lastSession': 'Last session · {date}',
  'home.repeat': '↻  Repeat this workout',
  'workout.nameMorning': 'Morning Workout',
  'workout.nameAfternoon': 'Afternoon Workout',
  'workout.nameEvening': 'Evening Workout',

  // Weekly plan
  'plan.yourPlan': 'Your plan',
  'plan.changeSplit': 'Change split',
  'plan.setupTitle': 'Plan your training week',
  'plan.setupBody':
    'Pick 3–6 days a week and get a split like Push · Pull · Legs. Each day remembers your exercises, sets and weights so you can beat them next time.',
  'plan.setupButton': 'Set up my plan',
  'plan.dayNum': 'DAY {n}',
  'plan.nextUp': 'NEXT UP',
  'plan.thisWeek': '✓ THIS WEEK',
  'plan.last': 'last {date}',
  'plan.addDay': '+  Add a day',
  'plan.day': 'Day {n}',
  'plan.replaceTitle': 'Replace your plan?',
  'plan.replaceBody':
    'Your current training days will be replaced. Logged workouts are kept.',
  'plan.weekly': 'Weekly plan',
  'plan.yourSplit': 'Your split',
  'plan.howMany': 'How many days a week do you train?',
  'plan.daysPerWeek': {
    one: '{count} day per week',
    other: '{count} days per week',
  },
  'plan.days': 'days',
  'plan.recommended': 'Recommended',
  'plan.custom': 'Build my own',
  'plan.emptyDays': {
    one: '{count} empty day. Name it and add your own exercises after.',
    other: '{count} empty days. Name them and add your own exercises after.',
  },
  'plan.use': 'USE THIS PLAN',

  // Training splits and the days inside them
  'split.d3.title': 'Push · Pull · Legs',
  'split.d3.desc': 'Each muscle once a week. Great place to start.',
  'split.d4.title': 'Upper · Lower',
  'split.d4.desc': 'Each muscle twice a week with a simple rotation.',
  'split.d5.title': 'PPL + Upper · Lower',
  'split.d5.desc': 'Push, pull and legs, then a lighter upper/lower pair.',
  'split.d6.title': 'Push · Pull · Legs ×2',
  'split.d6.desc': 'High frequency with two variations of each day.',
  'day.push': 'Push',
  'day.pull': 'Pull',
  'day.legs': 'Legs',
  'day.upper': 'Upper',
  'day.lower': 'Lower',
  'day.pushA': 'Push A',
  'day.pushB': 'Push B',
  'day.pullA': 'Pull A',
  'day.pullB': 'Pull B',
  'day.legsA': 'Legs A',
  'day.legsB': 'Legs B',
  'day.upperA': 'Upper A',
  'day.upperB': 'Upper B',
  'day.lowerA': 'Lower A',
  'day.lowerB': 'Lower B',

  // Day editor
  'editor.newDay': 'New day',
  'editor.editDay': 'Edit day',
  'editor.name': 'Name',
  'editor.namePlaceholder': 'e.g. Push',
  'editor.nameA11y': 'Day name',
  'editor.emptyBody': 'Add the movements you want to train on this day.',
  'editor.sets': 'Sets',
  'editor.targetReps': 'Target reps',
  'editor.fewerSets': 'Fewer sets',
  'editor.moreSets': 'More sets',
  'editor.deleteDay': 'Delete this day',
  'editor.deleteTitle': 'Delete "{name}"?',
  'editor.deleteBody':
    'This day is removed from your plan. Logged workouts are kept.',

  // Active workout
  'workout.live': '● Live',
  'workout.nameA11y': 'Workout name',
  'workout.time': 'Time',
  'workout.restBetween': 'Rest between sets',
  'workout.dragHint': 'Drag ≡ to set your order',
  'workout.exercises': 'Exercises',
  'workout.reorder': '⇅  Reorder',
  'workout.addExercises': '+  Add exercises',
  'workout.discard': 'Discard workout',
  'workout.deletedExercise': 'Deleted exercise',
  'workout.deleted': 'Deleted',
  'workout.setsDone': {
    one: '{done}/{count} set done',
    other: '{done}/{count} sets done',
  },
  'finish.noSetsTitle': 'No completed sets',
  'finish.noSetsBody':
    'Tick off at least one set before finishing, or discard this workout.',
  'finish.title': 'Finish workout?',
  'finish.message': '{sets} · {volume} moved. Nice work.',
  'finish.skipped': {
    one: "{count} unticked set won't be saved.",
    other: "{count} unticked sets won't be saved.",
  },
  'finish.keepGoing': 'Keep going',
  'discard.title': 'Discard workout?',
  'discard.body': 'All logged sets will be lost.',
  'removeExercise.title': 'Remove exercise?',

  // Exercise card and sets
  'exercise.target': 'Target {range}',
  'exercise.best': 'Best {weight} kg',
  'exercise.removeA11y': 'Remove {name}',
  'exercise.removeFallbackA11y': 'Remove exercise',
  'exercise.addSetA11y': 'Add set to {name}',
  'exercise.addSetFallbackA11y': 'Add set to exercise',
  'exercise.hint':
    '↑ You hit {target} reps on every set last time. Try {weight} kg today.',
  'set.colSet': 'SET',
  'set.colPrev': 'PREVIOUS',
  'set.colKg': 'KG',
  'set.colReps': 'REPS',
  'set.add': '+ Add set',
  'set.repsTitle': 'How many reps?',
  'set.repsBody': 'Enter your reps before ticking the set.',
  'set.removeTitle': 'Remove set {n}?',
  'set.removeA11y': 'Set {n}. Tap to remove',
  'set.usePrevious': 'Use previous: {weight} kg, {reps} reps',
  'set.noPrevious': 'No previous set',
  'set.weightA11y': 'Set {n} weight in kilograms',
  'set.repsA11y': 'Set {n} reps',
  'set.completeA11y': 'Complete set {n}',
  'set.pr': '🏆 NEW PERSONAL RECORD',
  'set.line': '{weight} kg × {reps}',

  // Rest timer and reordering
  'rest.label': 'REST',
  'rest.skip': 'Skip',
  'reorder.position': '{title}. Position {index} of {count}',
  'reorder.moveUp': 'Move up',
  'reorder.moveDown': 'Move down',
  'reorder.handleA11y': 'Reorder {name}. Drag to move.',

  // History
  'history.kicker': 'Your journey',
  'history.title': 'History',
  'history.workouts': 'Workouts',
  'history.lifted': 'Lifted',
  'history.emptyTitle': 'Nothing logged yet',
  'history.emptyBody':
    "Finish your first workout and it'll show up here with all its numbers.",
  'history.prs': 'PRs',
  'history.deleteTitle': 'Delete workout?',
  'history.deleteBody': 'This cannot be undone.',
  'history.deleteButton': 'Delete workout',

  // Library
  'library.title': 'Library',
  'library.new': '+ New',
  'library.search': 'Search exercises',
  'library.notLogged': 'Not logged yet',
  'library.bestUnit': 'KG BEST',
  'library.hint': 'Tap for progress · long-press to delete',
  'library.deleteTitle': 'Delete exercise?',
  'library.deleteBody':
    '"{name}" will be removed from your library. Past workouts keep their logged sets.',
  'library.noDataTitle': 'No data yet',
  'library.noDataBody':
    'Log this exercise in a workout and your progress chart will appear here.',
  'library.best': 'Best',
  'library.e1rm': 'Est. 1RM',
  'library.progress': 'Progress',
  'library.topWeight': 'Top weight per session',
  'library.recent': 'Recent sessions',
  'library.top': 'top {weight} kg',

  // Exercise picker and form
  'picker.title': 'Add Exercises',
  'picker.addCount': 'Add ({count})',
  'picker.all': 'All',
  'picker.create': '+ Create new exercise',
  'picker.alreadyAdded': 'already added',
  'form.namePlaceholder': 'Exercise name',
} as const satisfies Record<string, Message>;

export type MessageKey = keyof typeof en;
