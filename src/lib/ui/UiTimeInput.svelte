<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { formatFullTime, parseTimeInput } from '../jump';

  export let id = 'time-input';
  export let label = 'Time';
  export let value = '00:00:00.000';
  export let onEnter: () => void = () => {};

  let inputRef: HTMLInputElement | null = null;

  const SEPARATOR_POSITIONS = new Set([2, 5, 8]);

  function isSeparator(pos: number): boolean {
    return SEPARATOR_POSITIONS.has(pos);
  }

  function ensureMask(val: string): string {
    if (/^\d{2}:\d{2}:\d{2}\.\d{3}$/.test(val)) {
      return val;
    }
    const digits = val.replace(/\D/g, '').slice(0, 9).padEnd(9, '0');
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4, 6)}.${digits.slice(6)}`;
  }

  $: value = ensureMask(value);

  function getNextPos(pos: number): number {
    let next = pos + 1;
    if (isSeparator(next)) next++;
    return Math.min(next, 12);
  }

  function getPrevPos(pos: number): number {
    let prev = pos - 1;
    if (isSeparator(prev)) prev--;
    return Math.max(prev, 0);
  }

  export function focus(): void {
    if (inputRef) {
      inputRef.focus();
      inputRef.setSelectionRange(0, 0);
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      onEnter();
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const input = inputRef;
    if (!input) return;

    const selStart = input.selectionStart ?? 0;
    const selEnd = input.selectionEnd ?? 0;

    // 1. Digits 0-9: In-place overwrite
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      let pos = selStart;
      if (pos >= 12) pos = 11;
      if (isSeparator(pos)) pos++;

      const chars = ensureMask(value).split('');
      chars[pos] = event.key;
      value = chars.join('');

      const nextCursor = getNextPos(pos);
      void tick().then(() => {
        input.setSelectionRange(nextCursor, nextCursor);
      });
      return;
    }

    // 2. Separators ':' and '.' -> jump to next segment
    if (event.key === ':' || event.key === '.' || event.key === ',') {
      event.preventDefault();
      let nextPos = 0;
      if (event.key === ':') {
        if (selStart <= 2) nextPos = 3;
        else if (selStart <= 5) nextPos = 6;
        else nextPos = 9;
      } else {
        nextPos = 9;
      }
      input.setSelectionRange(nextPos, nextPos);
      return;
    }

    // 3. Backspace: clear digit to '0' and move back
    if (event.key === 'Backspace') {
      event.preventDefault();
      const chars = ensureMask(value).split('');
      if (selStart !== selEnd) {
        for (let i = selStart; i < selEnd; i++) {
          if (!isSeparator(i)) chars[i] = '0';
        }
        value = chars.join('');
        const targetPos = isSeparator(selStart) ? selStart + 1 : selStart;
        void tick().then(() => {
          input.setSelectionRange(targetPos, targetPos);
        });
      } else {
        if (selStart === 0) return;
        const targetPos = getPrevPos(selStart);
        chars[targetPos] = '0';
        value = chars.join('');
        void tick().then(() => {
          input.setSelectionRange(targetPos, targetPos);
        });
      }
      return;
    }

    // 4. Delete: clear digit to '0'
    if (event.key === 'Delete') {
      event.preventDefault();
      const chars = ensureMask(value).split('');
      if (selStart !== selEnd) {
        for (let i = selStart; i < selEnd; i++) {
          if (!isSeparator(i)) chars[i] = '0';
        }
        value = chars.join('');
        void tick().then(() => {
          input.setSelectionRange(selStart, selStart);
        });
      } else {
        let targetPos = selStart;
        if (isSeparator(targetPos)) targetPos++;
        if (targetPos < 12) {
          chars[targetPos] = '0';
          value = chars.join('');
          const nextCursor = getNextPos(targetPos);
          void tick().then(() => {
            input.setSelectionRange(nextCursor, nextCursor);
          });
        }
      }
      return;
    }

    // 5. ArrowLeft: skip separators
    if (event.key === 'ArrowLeft' && !event.shiftKey) {
      if (selStart !== selEnd) {
        event.preventDefault();
        const pos = isSeparator(selStart) ? selStart - 1 : selStart;
        input.setSelectionRange(pos, pos);
        return;
      }
      if (selStart > 0) {
        event.preventDefault();
        const prev = getPrevPos(selStart);
        input.setSelectionRange(prev, prev);
      }
      return;
    }

    // 6. ArrowRight: skip separators
    if (event.key === 'ArrowRight' && !event.shiftKey) {
      if (selStart !== selEnd) {
        event.preventDefault();
        const pos = isSeparator(selEnd) ? selEnd + 1 : selEnd;
        input.setSelectionRange(pos, pos);
        return;
      }
      if (selStart < 12) {
        event.preventDefault();
        const next = getNextPos(selStart);
        input.setSelectionRange(next, next);
      }
      return;
    }

    // 7. Home
    if (event.key === 'Home') {
      event.preventDefault();
      input.setSelectionRange(0, 0);
      return;
    }

    // 8. End
    if (event.key === 'End') {
      event.preventDefault();
      input.setSelectionRange(12, 12);
      return;
    }

    // Block any other arbitrary character key from breaking the mask
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
    }
  }

  function handlePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const ms = parseTimeInput(text);
    if (ms !== undefined) {
      value = formatFullTime(ms);
    } else {
      const digits = text.replace(/\D/g, '').slice(0, 9);
      if (digits) {
        const padded = digits.padEnd(9, '0');
        value = `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}.${padded.slice(6)}`;
      }
    }
    void tick().then(() => {
      inputRef?.setSelectionRange(0, 0);
    });
  }

  function handleSelect(): void {
    if (!inputRef) return;
    const start = inputRef.selectionStart ?? 0;
    const end = inputRef.selectionEnd ?? 0;
    if (start === end && isSeparator(start)) {
      inputRef.setSelectionRange(start + 1, start + 1);
    }
  }

  onMount(() => {
    focus();
  });
</script>

<label for={id}>{label}</label>
<input
  bind:this={inputRef}
  {id}
  type="text"
  bind:value
  class="time-mask-input"
  inputmode="numeric"
  autocomplete="off"
  spellcheck="false"
  on:keydown={handleKeydown}
  on:paste={handlePaste}
  on:select={handleSelect}
  on:click={handleSelect}
/>
