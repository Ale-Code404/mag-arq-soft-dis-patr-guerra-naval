<script setup lang="ts">
import { computed } from "vue";
import { weaponArea, weaponGlyph, weaponName } from "../game/labels";
import { useGame } from "../game/useGame";

const game = useGame();
const arsenal = computed(() => game.match.value?.arsenal ?? []);
</script>

<template>
  <section class="card bar">
    <div class="weapons" role="radiogroup" aria-label="Arma (teclas 1 a 5)">
      <label
        v-for="(weapon, index) in arsenal"
        :key="weapon.type"
        class="weapon"
        :class="{ active: game.selectedWeapon.value === weapon.type, empty: weapon.ammo === 0 }"
        :title="`${weaponName[weapon.type]} · ${weaponArea[weapon.type]} (tecla ${index + 1})`"
      >
        <input v-model="game.selectedWeapon.value" type="radio" name="weapon" :value="weapon.type" :disabled="weapon.ammo === 0" />
        <kbd class="key">{{ index + 1 }}</kbd>
        <span class="glyph" aria-hidden="true">{{ weaponGlyph[weapon.type] }}</span>
        <span class="info">
          <strong>{{ weaponName[weapon.type] }}</strong>
          <small>{{ weaponArea[weapon.type] }}</small>
        </span>
        <span class="ammo mono">{{ weapon.ammo ?? "∞" }}</span>
      </label>
    </div>

    <div class="status">
      <div class="enemy">
        <strong class="mono">{{ game.match.value?.rivalShipsAfloat ?? 0 }}</strong>
        <span class="muted">a flote</span>
      </div>
      <button type="button" class="btn btn-ghost btn-danger" @click="game.closeMatch()">Abandonar</button>
    </div>
  </section>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
}

.weapons {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 8px;
  overflow: hidden;
}

.weapon {
  position: relative;
  flex: 0 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 8px 8px;
  overflow: hidden;
  background: rgba(3, 10, 20, 0.5);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    flex-grow 0.3s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}

.weapon:hover:not(.empty),
.weapon.active {
  flex-grow: 1;
}

.weapon:hover:not(.empty) {
  border-color: var(--line-strong);
}

.weapon input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.weapon:has(input:focus-visible) {
  outline: 2px solid var(--cyan);
  outline-offset: -2px;
}

.weapon.active {
  border-color: var(--cyan);
  background: linear-gradient(180deg, var(--cyan-soft), transparent);
  box-shadow: inset 0 -2px 0 var(--cyan);
}

.weapon.empty {
  opacity: 0.35;
  cursor: not-allowed;
}

.key {
  flex: none;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  font: 600 0.7rem var(--font-mono);
  color: var(--muted);
  border: 1px solid var(--line-strong);
  border-radius: 5px;
}

.weapon.active .key {
  color: var(--cyan);
  border-color: var(--cyan);
}

.glyph {
  flex: none;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  font-size: 1rem;
  color: var(--cyan);
  background: var(--cyan-soft);
  border: 1px solid var(--line);
}

.weapon.active .glyph {
  color: #021220;
  background: var(--cyan);
}

.info {
  display: grid;
  gap: 1px;
  min-width: 0;
  max-width: 0;
  overflow: hidden;
  white-space: nowrap;
  opacity: 0;
  transition:
    max-width 0.3s ease,
    opacity 0.2s ease;
}

.weapon:hover:not(.empty) .info,
.weapon.active .info {
  max-width: 220px;
  opacity: 1;
}

.info strong {
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.info small {
  color: var(--muted);
  font-size: 0.72rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ammo {
  flex: none;
  margin-left: auto;
  font-size: 1rem;
  font-weight: 600;
  color: var(--amber);
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.enemy {
  display: grid;
  justify-items: center;
  padding: 4px 14px;
  border-radius: var(--radius-sm);
  background: rgba(255, 61, 85, 0.08);
  border: 1px solid rgba(255, 61, 85, 0.25);
}

.enemy strong {
  font-size: 1.3rem;
  line-height: 1.1;
  color: var(--sunk);
}

.enemy span {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

@media (max-width: 760px) {
  .bar {
    flex-direction: column;
    align-items: stretch;
  }

  .status {
    justify-content: space-between;
  }
}
</style>
