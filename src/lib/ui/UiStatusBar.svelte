<script lang="ts">
  import { formatTime } from '../jump';

  export let isParsing = false;
  export let error = '';
  export let status = '';
  export let format: string | undefined = undefined;
  export let fileName = '';
  export let duration = 0;
  export let cueCount = 0;
</script>

<footer class="statusbar">
  <div class="status-main">
    {#if isParsing}
      <div
        class="parse-progress"
        role="progressbar"
        aria-label="Parsing subtitle file"
        aria-valuetext="Parsing locally"
      >
        <span></span>
      </div>
    {/if}
    <span class:has-error={!!error} class="status-message" role="status" aria-live="polite">{error || status}</span>
  </div>
  <div class="status-context">
    {#if format}<span>{format.toUpperCase()}</span>{/if}
    {#if fileName}<span class="status-file" title={fileName}>{fileName}</span>{/if}
  </div>
  {#if cueCount > 0}<span class="status-metrics">{formatTime(duration)} · {cueCount} cues</span>{/if}
</footer>
