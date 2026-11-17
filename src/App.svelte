<script lang="ts">
  import { onMount, tick } from 'svelte';
  import JumpDialog from './lib/components/JumpDialog.svelte';
  import RgbaCanvas from './lib/components/RgbaCanvas.svelte';
  import UiButton from './lib/ui/UiButton.svelte';
  import UiFilePicker from './lib/ui/UiFilePicker.svelte';
  import UiStatusBar from './lib/ui/UiStatusBar.svelte';
  import UiThemeToggle from './lib/ui/UiThemeToggle.svelte';
  import {
    findCueIndex,
    formatFullTime,
    formatTime,
    formatTimeInput,
    parseCueNumber,
    parseTimeInput,
  } from './lib/jump';
  import type { JumpTarget } from './lib/jump';
  import { mergeAdjacentCues } from './lib/merge/mergeAdjacentCues';
  import type { MergedCue, ParseResult, SubtitleCue } from './lib/model/cue';

  let cues: MergedCue[] = [];
  let sourceCues: SubtitleCue[] = [];
  let format: ParseResult['format'] | undefined;
  let fileName = '';
  let status = 'Drop a .sup file or an .idx + .sub pair to begin.';
  let error = '';
  let activeIndex = 0;
  let showJump = false;
  let jumpTimeValue = '00:00:00.000';
  let jumpCueValue = '';
  let jumpMode: 'time' | 'cue' = 'time';
  let isDragging = false;
  let isParsing = false;
  let primaryPicker: { open: () => void };
  let subtitlePicker: { open: () => void };
  let pendingIdx: File | undefined;
  let lastFocusedElement: HTMLElement | null = null;
  let cueRows: HTMLDivElement[] = [];
  let mergeOnExport = true;
  let isExporting = false;

  $: activeCue = cues[activeIndex];
  $: duration = cues.reduce((longest, cue) => Math.max(longest, cue.endMs), 0);
  $: if (cues.length > 0) void scrollActiveCueIntoView(activeIndex);

  function openPicker(picker: { open: () => void }): void {
    picker.open();
  }

  function handlePrimaryFiles(files: File[]): void {
    void loadFiles(files);
  }

  function handleSubtitleFiles(files: File[]): void {
    if (files.length > 0 && pendingIdx) {
      void loadFiles([pendingIdx, files[0]]);
      pendingIdx = undefined;
    }
  }

  async function loadFiles(files: File[]): Promise<void> {
    if (isParsing) return;
    error = '';
    isParsing = true;
    const sup = files.find((file) => file.name.toLowerCase().endsWith('.sup'));
    const idx = files.find((file) => file.name.toLowerCase().endsWith('.idx'));
    const sub = files.find((file) => file.name.toLowerCase().endsWith('.sub'));
    if (sup) {
      pendingIdx = undefined;
      try {
        await parseWithWorker({ type: 'sup', data: await sup.arrayBuffer() }, sup.name);
      } catch (cause) {
        isParsing = false;
        error = cause instanceof Error ? cause.message : 'Unable to read the subtitle file.';
        status = 'Parsing failed.';
      }
      return;
    }
    if (idx && sub) {
      pendingIdx = undefined;
      try {
        await parseWithWorker(
          { type: 'vobsub', idxText: await idx.text(), subData: await sub.arrayBuffer() },
          `${idx.name} + ${sub.name}`,
        );
      } catch (cause) {
        isParsing = false;
        error = cause instanceof Error ? cause.message : 'Unable to read the subtitle files.';
        status = 'Parsing failed.';
      }
      return;
    }
    if (idx) {
      isParsing = false;
      pendingIdx = idx;
      fileName = idx.name;
      status = 'Choose the matching .sub file to continue.';
      openPicker(subtitlePicker);
      return;
    }
    isParsing = false;
    error = 'Select a .sup file or both an .idx and a .sub file.';
  }

  function parseWithWorker(
    request: { type: 'sup'; data: ArrayBuffer } | { type: 'vobsub'; idxText: string; subData: ArrayBuffer },
    name: string,
  ): Promise<void> {
    return new Promise((resolve) => {
      isParsing = true;
      status = 'Parsing locally…';
      const worker = new Worker(new URL('./lib/worker/parser.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (
        event: MessageEvent<
          { type: 'result'; format: ParseResult['format']; cues: SubtitleCue[] } | { type: 'error'; message: string }
        >,
      ) => {
        worker.terminate();
        isParsing = false;
        if (event.data.type === 'error') {
          error = event.data.message;
          status = 'Parsing failed.';
        } else {
          sourceCues = event.data.cues;
          cues = mergeAdjacentCues(sourceCues);
          format = event.data.format;
          fileName = name;
          activeIndex = 0;
          status = cues.length > 0 ? 'Ready for local preview.' : 'No image cues were found.';
        }
        resolve();
      };
      worker.onerror = (event) => {
        worker.terminate();
        isParsing = false;
        error = event.message || 'The parser worker stopped unexpectedly.';
        status = 'Parsing failed.';
        resolve();
      };
      if (request.type === 'sup') worker.postMessage(request, [request.data]);
      else worker.postMessage(request, [request.subData]);
    });
  }

  async function exportSup(): Promise<void> {
    if (format !== 'sup' || sourceCues.length === 0 || isExporting) return;
    isExporting = true;
    error = '';
    const worker = new Worker(new URL('./lib/worker/parser.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (
      event: MessageEvent<{ type: 'export-result'; data: ArrayBuffer } | { type: 'error'; message: string }>,
    ) => {
      worker.terminate();
      isExporting = false;
      if (event.data.type === 'error') {
        error = event.data.message;
        status = 'Export failed.';
        return;
      }
      const blob = new Blob([event.data.data], { type: 'application/octet-stream' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName.replace(/\.sup$/i, '') || 'subtitle'}${mergeOnExport ? '.merged' : ''}.sup`;
      link.click();
      URL.revokeObjectURL(link.href);
      status = mergeOnExport ? 'Merged SUP exported.' : 'SUP exported.';
    };
    worker.onerror = () => {
      worker.terminate();
      isExporting = false;
      error = 'The export worker stopped unexpectedly.';
      status = 'Export failed.';
    };
    worker.postMessage({ type: 'export-sup', cues: mergeOnExport ? cues : sourceCues });
  }

  function openJump(): void {
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    showJump = true;
    jumpTimeValue = activeCue ? formatFullTime(activeCue.startMs) : '00:00:00.000';
    jumpCueValue = activeCue ? String(activeIndex + 1) : '';
    jumpMode = 'time';
  }

  function closeJump(): void {
    showJump = false;
    lastFocusedElement?.focus();
    lastFocusedElement = null;
  }

  function handleDialogChange(open: boolean): void {
    if (open) {
      showJump = true;
      return;
    }
    closeJump();
  }

  function selectCue(index: number): void {
    if (cues.length === 0) return;
    activeIndex = Math.max(0, Math.min(index, cues.length - 1));
  }

  async function scrollActiveCueIntoView(index: number): Promise<void> {
    await tick();
    cueRows[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function completeJump(target: JumpTarget, message: string): void {
    const index = findCueIndex(cues, target);
    if (index < 0) {
      error = 'Load a subtitle file before jumping.';
      return;
    }
    selectCue(index);
    closeJump();
    error = '';
    status = message;
  }

  function submitTimeJump(): void {
    const milliseconds = parseTimeInput(jumpTimeValue);
    if (milliseconds === undefined) {
      error = 'Enter a valid time (e.g. 00:01:23.500, 12:34, or 85s).';
      return;
    }
    const formattedTime = formatFullTime(milliseconds);
    completeJump({ kind: 'time', milliseconds }, `Jumped to ${formattedTime}.`);
  }

  function submitCueJump(): void {
    const cueNumber = parseCueNumber(jumpCueValue);
    if (cueNumber === undefined) {
      error = 'Enter a positive cue number.';
      return;
    }
    completeJump({ kind: 'cue', cueNumber }, `Jumped to cue ${cueNumber}.`);
  }

  function submitJump(): void {
    if (jumpMode === 'time') submitTimeJump();
    else submitCueJump();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      if (!showJump) openJump();
      return;
    }
    if (showJump) return;
    if (event.key === 'ArrowDown') selectCue(activeIndex + 1);
    if (event.key === 'ArrowUp') selectCue(activeIndex - 1);
  }

  function handleAppDragOver(event: DragEvent): void {
    if (event.dataTransfer) event.dataTransfer.dropEffect = isParsing ? 'none' : 'copy';
  }

  function handleAppDrop(event: DragEvent): void {
    isDragging = false;
    if (isParsing) return;
    if (event.dataTransfer?.files) void loadFiles(Array.from(event.dataTransfer.files));
  }

  function handleDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    isDragging = false;
    if (isParsing) return;
    if (event.dataTransfer?.files) void loadFiles(Array.from(event.dataTransfer.files));
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

<svelte:head>
  <title>Supview · local subtitle preview</title>
  <meta name="description" content="A local, static previewer for PGS SUP and VobSub IDX/SUB subtitles." />
</svelte:head>

<div
  class="app-shell"
  role="region"
  aria-label="Supview workspace"
  on:dragover|preventDefault={handleAppDragOver}
  on:drop|preventDefault={handleAppDrop}
>
  <header class="topbar">
    <a class="brand" href="/" aria-label="Supview home">
      <span class="brand-mark">S</span>
      <span>supview</span>
    </a>
    <div class="topbar-actions">
      <UiThemeToggle />
      <UiButton variant="shortcut" on:click={openJump} aria-label="Open jump dialog">⌘ / Ctrl G</UiButton>
      <UiButton variant="primary" on:click={() => openPicker(primaryPicker)} disabled={isParsing}>Open file</UiButton>
    </div>
  </header>

  <main class="workspace" aria-busy={isParsing}>
    <aside class="sidebar" aria-label="Subtitle cues">
      <div class="sidebar-heading"><h1>Cues</h1></div>
      <div class="cue-list" role="listbox" aria-label="Subtitle cue list">
        {#each cues as cue, index}
          <div class="cue-row-wrap" bind:this={cueRows[index]}>
            <UiButton
              variant="cue"
              active={index === activeIndex}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              on:click={() => selectCue(index)}
            >
              <span class="cue-number">{String(index + 1).padStart(2, '0')}</span>
              <span class="cue-meta"
                ><strong>{formatTime(cue.startMs)}</strong><small>{formatTime(cue.endMs)}</small></span
              >
              {#if cue.sourceIndexes.length > 1}<span class="merge-badge">{cue.sourceIndexes.length}×</span>{/if}
            </UiButton>
          </div>
        {:else}
          <div class="empty-list">
            <span>✦</span>
            <p>Your subtitle cues will appear here.</p>
          </div>
        {/each}
      </div>
    </aside>

    <section class="preview-area" aria-label="Subtitle preview">
      {#if activeCue}
        <div class="preview-header">
          <div>
            <span class="eyebrow">cue {String(activeIndex + 1).padStart(2, '0')}</span>
            <h2>{formatTime(activeCue.startMs)} <span>→</span> {formatTime(activeCue.endMs)}</h2>
          </div>
          <div class="preview-actions">
            {#if format === 'sup'}
              <label class="export-option">
                <input type="checkbox" bind:checked={mergeOnExport} />
                <span>Merge identical cues</span>
              </label>
              <UiButton variant="secondary" on:click={exportSup} disabled={isExporting} aria-label="Export SUP file">
                {isExporting ? 'Exporting…' : 'Export SUP'}
              </UiButton>
            {/if}
            <UiButton
              variant="icon"
              on:click={() => selectCue(activeIndex - 1)}
              disabled={activeIndex === 0}
              aria-label="Previous cue">↑</UiButton
            ><UiButton
              variant="icon"
              on:click={() => selectCue(activeIndex + 1)}
              disabled={activeIndex === cues.length - 1}
              aria-label="Next cue">↓</UiButton
            >
          </div>
        </div>
        <div class="canvas-card">
          <div class="checkerboard"><RgbaCanvas image={activeCue.image} /></div>
          <div class="canvas-caption">
            <span>{activeCue.image.width} × {activeCue.image.height}px</span><span
              >{activeCue.sourceIndexes.length > 1
                ? `Merged from ${activeCue.sourceIndexes.length} adjacent frames`
                : 'Source frame'}</span
            >
          </div>
        </div>
        <div class="info-grid">
          <div><span class="eyebrow">start</span><strong>{formatTime(activeCue.startMs)}</strong></div>
          <div><span class="eyebrow">end</span><strong>{formatTime(activeCue.endMs)}</strong></div>
          <div>
            <span class="eyebrow">duration</span><strong>{formatTime(activeCue.endMs - activeCue.startMs)}</strong>
          </div>
        </div>
      {:else}
        <div
          class:dragging={isDragging}
          class="drop-card"
          role="region"
          aria-label="Subtitle file drop zone"
          on:dragover|preventDefault={() => (isDragging = true)}
          on:dragleave={() => (isDragging = false)}
          on:drop={handleDrop}
        >
          <div class="drop-orbit"><span>↑</span></div>
          <span class="eyebrow">ready when you are</span>
          <h2>Preview subtitles<br /><em>without leaving your browser.</em></h2>
          <p>
            Drop a PGS <code>.sup</code> file or an <code>.idx</code> + <code>.sub</code> pair here. Nothing is uploaded.
          </p>
          <UiButton large on:click={() => openPicker(primaryPicker)} disabled={isParsing}>Choose files</UiButton>
          <div class="drop-hint"><span>⌘ / Ctrl G</span> to jump · ↑ ↓ to browse</div>
        </div>
      {/if}
      <UiStatusBar {isParsing} {error} {status} {format} {fileName} {duration} cueCount={cues.length} />
    </section>
  </main>

  <UiFilePicker
    bind:this={primaryPicker}
    id="primary-file"
    label="Open subtitle file"
    accept=".sup,.idx,.sub"
    multiple
    onFiles={handlePrimaryFiles}
  />
  <UiFilePicker
    bind:this={subtitlePicker}
    id="subtitle-file"
    label="Open matching SUB file"
    accept=".sub"
    onFiles={handleSubtitleFiles}
  />

  <JumpDialog
    bind:open={showJump}
    bind:mode={jumpMode}
    bind:timeValue={jumpTimeValue}
    bind:cueValue={jumpCueValue}
    onSubmit={submitJump}
    onOpenChange={handleDialogChange}
  />
</div>
