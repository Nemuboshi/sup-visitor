<script lang="ts">
  export let id = 'text-input';
  export let label = '';
  export let value = '';
  export let placeholder = '';
  export let inputmode: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url' = 'text';
  export let onEnter: () => void = () => {};

  let input: HTMLInputElement;

  export function focus(): void {
    input.focus();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      onEnter();
    }
  }
</script>

<label for={id}>{label}</label>
<input
  {id}
  type="text"
  {inputmode}
  autocomplete="off"
  bind:this={input}
  bind:value
  {placeholder}
  on:keydown={handleKeydown}
/>
