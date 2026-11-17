<script lang="ts">
  export let id = 'file-input';
  export let label = 'Open file';
  export let accept = '';
  export let multiple = false;
  export let onFiles: (files: File[]) => void = () => {};

  let input: HTMLInputElement;

  export function open(): void {
    input.value = '';
    input.click();
  }

  function handleChange(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    if (target.files) onFiles(Array.from(target.files));
  }
</script>

<label class="visually-hidden" for={id}>{label}</label>
<input {id} bind:this={input} class="visually-hidden" type="file" {accept} {multiple} on:change={handleChange} />
