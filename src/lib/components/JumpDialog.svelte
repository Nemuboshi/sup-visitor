<script lang="ts">
  import { RadioGroup } from 'bits-ui';
  import UiButton from '../ui/UiButton.svelte';
  import UiDialog from '../ui/UiDialog.svelte';
  import UiTextInput from '../ui/UiTextInput.svelte';
  import UiTimeInput from '../ui/UiTimeInput.svelte';

  type JumpMode = 'time' | 'cue';

  export let open = false;
  export let mode: JumpMode = 'time';
  export let timeValue = '00:00:00.000';
  export let cueValue = '';
  export let onSubmit: () => void = () => {};
  export let onOpenChange: (open: boolean) => void = () => {};

  let timeInput: { focus: () => void };
  let cueInput: { focus: () => void };

  $: if (open) {
    setTimeout(() => {
      if (mode === 'time') {
        timeInput?.focus();
      } else {
        cueInput?.focus();
      }
    }, 0);
  }
</script>

<UiDialog
  bind:open
  title="Jump to a cue"
  description="Choose a time or cue number, then enter its value."
  eyebrow="quick navigation"
  closeLabel="Close jump dialog"
  {onOpenChange}
>
  <RadioGroup.Root bind:value={mode} class="jump-mode" aria-label="Jump target">
    <RadioGroup.Item value="time" class="jump-mode-item">Time</RadioGroup.Item>
    <RadioGroup.Item value="cue" class="jump-mode-item">Cue number</RadioGroup.Item>
  </RadioGroup.Root>

  <div class="jump-field">
    {#if mode === 'time'}
      <UiTimeInput bind:this={timeInput} id="jump-time-input" label="Time" bind:value={timeValue} onEnter={onSubmit} />
      <div class="dialog-help">
        <span>Type digits to overwrite</span><code>00:00:00.000</code>
      </div>
    {:else}
      <UiTextInput
        bind:this={cueInput}
        id="jump-cue-input"
        label="Cue number"
        bind:value={cueValue}
        inputmode="numeric"
        placeholder="e.g. 42"
        onEnter={onSubmit}
      />
    {/if}
    <UiButton large on:click={onSubmit}>Jump <span>↵</span></UiButton>
  </div>
</UiDialog>
