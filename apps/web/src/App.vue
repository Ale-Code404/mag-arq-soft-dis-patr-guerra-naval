<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import AppHeader from "./components/AppHeader.vue";
import CodeNotice from "./components/CodeNotice.vue";
import StatusToast from "./components/StatusToast.vue";
import { provideGame } from "./game/useGame";
import AccessScreen from "./screens/AccessScreen.vue";
import BattleScreen from "./screens/BattleScreen.vue";
import HarborScreen from "./screens/HarborScreen.vue";
import ReplayScreen from "./screens/ReplayScreen.vue";

const game = provideGame();

onMounted(() => game.boot());
onUnmounted(() => game.dispose());
</script>

<template>
  <AppHeader />
  <main class="shell">
    <div v-if="!game.ready.value" class="boot">
      <span class="sonar-lg" aria-hidden="true"></span>
      <p class="mono muted">Estableciendo enlace…</p>
    </div>
    <Transition v-else name="fade" mode="out-in">
      <AccessScreen v-if="!game.player.value" key="access" />
      <div v-else key="in" class="stack">
        <CodeNotice />
        <Transition name="fade" mode="out-in">
          <ReplayScreen v-if="game.replay.value" key="replay" />
          <BattleScreen v-else-if="game.match.value" key="battle" />
          <HarborScreen v-else key="harbor" />
        </Transition>
      </div>
    </Transition>
  </main>
  <StatusToast />
</template>

<style scoped>
.boot {
  display: grid;
  justify-items: center;
  gap: 18px;
  padding-top: 18vh;
}

.sonar-lg {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 1.5px solid var(--cyan);
  overflow: hidden;
  box-shadow: 0 0 40px rgba(63, 208, 255, 0.3);
}

.sonar-lg::after {
  content: "";
  position: absolute;
  inset: 0;
  background: conic-gradient(from 0deg, transparent 0 280deg, rgba(63, 208, 255, 0.8) 360deg);
  animation: sweep 1.6s linear infinite;
}
</style>
