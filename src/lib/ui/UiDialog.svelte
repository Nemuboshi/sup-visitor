<script lang="ts">
  import { Dialog } from 'bits-ui';

  export let open = false;
  export let title = '';
  export let description = '';
  export let eyebrow = '';
  export let closeLabel = 'Close dialog';
  export let onOpenChange: (open: boolean) => void = () => {};

  function handleOpenChange(nextOpen: boolean): void {
    onOpenChange(nextOpen);
  }
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
  {#if open}
    <Dialog.Portal>
      <div class="dialog-backdrop">
        <Dialog.Overlay class="dialog-overlay" />
        <Dialog.Content class="ui-dialog">
          <div class="dialog-heading">
            <div>
              {#if eyebrow}<span class="eyebrow">{eyebrow}</span>{/if}
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description class="visually-hidden">{description}</Dialog.Description>
            </div>
            <Dialog.Close class="close-button" type="button" aria-label={closeLabel}>×</Dialog.Close>
          </div>
          <slot />
        </Dialog.Content>
      </div>
    </Dialog.Portal>
  {/if}
</Dialog.Root>
