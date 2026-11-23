<script setup lang="ts">
import { computed } from "vue";
import type { BoardView, CellState, OutcomeType } from "../api/client";
import { cellKey, cellLabel, columnLabel, rowLabel } from "../coordinates";
import type { CellEffect } from "../effects";
import type { ShipShape } from "../game/ships";
import ShipHull from "./ShipHull.vue";

const props = withDefaults(
  defineProps<{
    title: string;
    caption?: string;
    board: BoardView;
    clickable?: boolean;
    active?: boolean;
    alert?: boolean;
    radar?: boolean;
    highlight?: Set<string>;
    overlay?: Map<string, OutcomeType>;
    effects?: Map<string, CellEffect>;
    preview?: Set<string>;
    previewInvalid?: boolean;
    ships?: ShipShape[];
  }>(),
  {
    clickable: false,
    active: false,
    alert: false,
    radar: false,
    highlight: () => new Set(),
    overlay: () => new Map(),
    effects: () => new Map(),
    preview: () => new Set(),
    previewInvalid: false,
    ships: () => [],
  },
);

const emit = defineEmits<{
  cellClick: [row: number, column: number];
  cellHover: [row: number, column: number];
  hoverEnd: [];
}>();

// RNF-03: each cell state has its own look and symbol.
const symbol: Record<CellState, string> = { EMPTY: "", SHIP: "", MISS: "", HIT: "✕", SUNK: "✖" };

const keyOf = (row: number, column: number) => cellKey({ row, column });
const overlayOf = (row: number, column: number) => props.overlay.get(keyOf(row, column));
const effectOf = (row: number, column: number) => props.effects.get(keyOf(row, column));

function effectClasses(effect: CellEffect | undefined) {
  return effect ? ["fx", `fx-${effect.weapon.toLowerCase().replace("_", "-")}`, `fx-${effect.result}`] : [];
}

const covered = computed(() => {
  const keys = new Set<string>();
  for (const ship of props.ships) {
    for (let i = 0; i < ship.length; i++) {
      keys.add(ship.orientation === "VERTICAL" ? keyOf(ship.row + i, ship.column) : keyOf(ship.row, ship.column + i));
    }
  }
  return keys;
});

const isSelected = (ship: ShipShape) => props.highlight.has(keyOf(ship.row, ship.column));

function onClick(row: number, column: number) {
  if (props.clickable) emit("cellClick", row, column);
}
</script>

<template>
  <section class="board" :style="{ '--size': board.size }">
    <header class="board-head">
      <div>
        <p class="eyebrow">{{ title }}</p>
        <p v-if="caption" class="muted caption">{{ caption }}</p>
      </div>
      <slot name="aside" />
    </header>
    <div class="board-frame" :class="{ radar, active, alert }">
      <div class="grid" :class="{ clickable }" role="grid" :aria-label="title" @mouseleave="emit('hoverEnd')">
        <div class="ships-layer" aria-hidden="true">
          <ShipHull v-for="ship in ships" :key="`${ship.row}-${ship.column}`" :ship="ship" :selected="isSelected(ship)" />
        </div>
        <span class="label top"></span>
        <span v-for="(_, column) in board.size" :key="`c${column}`" class="label top">{{ columnLabel(column) }}</span>
        <template v-for="(row, rowIndex) in board.cells" :key="`r${rowIndex}`">
          <span class="label">{{ rowLabel(rowIndex) }}</span>
          <span
            v-for="(state, column) in row"
            :key="`${rowIndex}-${column}`"
            class="cell"
            role="gridcell"
            :class="[
              state.toLowerCase(),
              overlayOf(rowIndex, column)?.toLowerCase(),
              {
                hull: covered.has(keyOf(rowIndex, column)),
                selected: highlight.has(keyOf(rowIndex, column)),
                preview: preview.has(keyOf(rowIndex, column)),
                invalid: previewInvalid && preview.has(keyOf(rowIndex, column)),
              },
              ...effectClasses(effectOf(rowIndex, column)),
            ]"
            :style="effectOf(rowIndex, column) ? { '--fx-delay': `${effectOf(rowIndex, column)!.delay}ms` } : undefined"
            :title="cellLabel({ row: rowIndex, column })"
            :aria-label="`${cellLabel({ row: rowIndex, column })} ${state.toLowerCase()}`"
            @click="onClick(rowIndex, column)"
            @mouseenter="emit('cellHover', rowIndex, column)"
          >
            {{ overlayOf(rowIndex, column) === "SPOTTED" ? "?" : symbol[state] }}
          </span>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.caption {
  font-size: 0.82rem;
  margin-top: 2px;
}
</style>
