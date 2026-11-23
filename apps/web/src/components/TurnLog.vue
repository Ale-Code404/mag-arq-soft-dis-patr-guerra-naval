<script setup lang="ts">
import { computed } from "vue";
import type { TurnView } from "../api/client";
import { describeTurn, isHitTurn } from "../game/labels";

const props = defineProps<{ turns: TurnView[] }>();
const recent = computed(() => [...props.turns].reverse().slice(0, 12));
</script>

<template>
  <section class="card log">
    <div class="card-title">
      <h2>Bitácora de combate</h2>
      <span class="chip">{{ turns.length }} turnos</span>
    </div>
    <p v-if="recent.length === 0" class="muted">Aún no hay disparos.</p>
    <TransitionGroup v-else tag="ol" name="fade" class="entries">
      <li v-for="turn in recent" :key="turn.number" :class="[turn.side.toLowerCase(), { hit: isHitTurn(turn) }]">
        <span class="num mono">{{ String(turn.number).padStart(2, "0") }}</span>
        <span class="side">{{ turn.side === "PLAYER" ? "Tú" : "Rival" }}</span>
        <span class="text">{{ describeTurn(turn) }}</span>
      </li>
    </TransitionGroup>
  </section>
</template>

<style scoped>
.entries {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}

.entries li {
  display: grid;
  grid-template-columns: 30px 48px 1fr;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  font-size: 0.86rem;
  border-radius: var(--radius-sm);
  background: rgba(3, 10, 20, 0.45);
  border-left: 2px solid var(--faint);
}

.entries li.player {
  border-left-color: var(--cyan);
}

.entries li.opponent {
  border-left-color: var(--amber);
}

.entries li.hit .text {
  color: var(--hit);
}

.num {
  color: var(--faint);
  font-size: 0.75rem;
}

.side {
  font-weight: 600;
  font-size: 0.78rem;
}

.player .side {
  color: var(--cyan);
}

.opponent .side {
  color: var(--amber);
}
</style>
