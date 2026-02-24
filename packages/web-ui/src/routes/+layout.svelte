<script lang="ts">
  import '../app.css';
  import favicon from '$lib/assets/favicon.svg';
  import { onMount } from 'svelte';
  import { KeyRound, Lock } from 'lucide-svelte';
  import { Button, Card, Input, Label } from '$lib/components/ui';
  import { localSettingStore } from '$lib/local-setting/store';

  let { children } = $props();

  let pendingKey = $state('');
  let isUnlocking = $state(false);
  let unlockError = $state('');

  const isLocked = $derived($localSettingStore.isLocked);

  async function unlock(): Promise<void> {
    unlockError = '';
    isUnlocking = true;
    localSettingStore.setApiKey(pendingKey);
    await localSettingStore.loadConfig();
    isUnlocking = false;
    // If the server rejected the key, loadConfig will have set isLocked back
    // to true. Surface a clear error in the lock screen.
    if ($localSettingStore.isLocked) {
      unlockError = 'Invalid API key. Please try again.';
      localSettingStore.clearApiKey();
      pendingKey = '';
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      void unlock();
    }
  }

  onMount(() => {
    const stored = localSettingStore.resolveStoredApiKey();
    if (stored !== null) {
      // A key was found in sessionStorage — attempt to load immediately
      void localSettingStore.loadConfig();
    }
    // No stored key → stay locked, show lock screen
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

{#if isLocked}
  <div class="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] px-4">
    <Card className="w-full max-w-sm p-8">
      <div class="mb-6 flex flex-col items-center gap-3 text-center">
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--muted))]">
          <Lock class="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
        </div>
        <div>
          <h1 class="text-xl font-semibold">Ode Dashboard</h1>
          <p class="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Enter your API key to continue.<br />
            Leave empty if no key is configured.
          </p>
        </div>
      </div>

      <div class="space-y-4">
        <div class="grid gap-2">
          <Label for="api-key-input">API Key</Label>
          <Input
            id="api-key-input"
            type="password"
            placeholder="Leave empty for local access"
            value={pendingKey}
            on:input={(e) => { pendingKey = (e.currentTarget as HTMLInputElement).value; }}
            on:keydown={onKeydown}
            disabled={isUnlocking}
            autofocus
          />
        </div>

        {#if unlockError}
          <p class="text-sm text-[hsl(var(--destructive))]">{unlockError}</p>
        {/if}

        <Button
          className="w-full"
          on:click={() => void unlock()}
          disabled={isUnlocking}
        >
          <KeyRound class="h-4 w-4" />
          {isUnlocking ? 'Unlocking…' : 'Unlock'}
        </Button>
      </div>
    </Card>
  </div>
{:else}
  {@render children()}
{/if}
