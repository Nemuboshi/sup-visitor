<script lang="ts">
  import { theme, toggleTheme } from '../theme/theme';
  import UiButton from './UiButton.svelte';

  $: nextTheme = $theme === 'dark' ? 'light' : 'dark';
</script>

<UiButton
  variant="theme"
  on:click={toggleTheme}
  aria-label={`Switch to ${nextTheme} theme`}
  title={`Switch to ${nextTheme} theme`}
>
  <span aria-hidden="true">{$theme === 'dark' ? '☼' : '☾'}</span>
</UiButton>
