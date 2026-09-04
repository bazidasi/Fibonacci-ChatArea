// The input box surface, shared with PendingActionBar so a pause can take over
// the same slot without the frame or the height shifting.
// Matches the reference composer: large 24px-radius well, no hard border,
// soft lift shadow; a magenta focus glow is added by .chatbox-input-surface
// in globals.css.
export const INPUT_SURFACE_CLASS_NAME =
  'chatbox-input-surface relative flex flex-col justify-between gap-xs rounded-[24px] bg-chatbox-background-secondary px-3.5 pt-3 pb-2 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.45)]'

/** Desktop only: keeps the swap between input and pause from jumping. */
export const INPUT_SURFACE_MIN_HEIGHT_CLASS_NAME = 'min-h-[104px]'

export const INPUT_SURFACE_STYLE = {}
