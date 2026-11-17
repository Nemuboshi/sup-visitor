<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'shortcut' | 'icon' | 'cue' | 'theme' = 'primary';
  export let large = false;
  export let active = false;
  export let disabled = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';

  const variantClasses = {
    primary: 'primary-button',
    secondary: 'secondary-button',
    shortcut: 'shortcut-button',
    icon: 'icon-button',
    cue: 'cue-row',
    theme: 'theme-toggle',
  } as const;
</script>

<button
  class={variantClasses[variant] + (large ? ' large' : '') + (active ? ' active' : '')}
  {disabled}
  {type}
  on:click
  {...$$restProps}
>
  <slot />
</button>
