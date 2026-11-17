<script lang="ts">
  import { onMount } from 'svelte';
  import type { RgbaImage } from '../model/cue';

  let canvas: HTMLCanvasElement;
  export let image: RgbaImage;

  function draw(): void {
    if (!canvas || !image) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.width = image.width;
    canvas.height = image.height;
    context.clearRect(0, 0, image.width, image.height);
    context.putImageData(new ImageData(new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0);
  }

  $: if (image) draw();
  onMount(draw);
</script>

<canvas bind:this={canvas} class="subtitle-canvas" aria-label="Subtitle image"></canvas>
