<script setup lang="ts">
import type { BoardView, CellState, OutcomeType } from "../api/client";
import { cellKey, cellLabel, columnLabel, rowLabel } from "../coordinates";
import type { CellEffect } from "../effects";

const props = withDefaults(
  defineProps<{
    title: string;
    board: BoardView;
    // Cells take clicks only when the phase allows an action on this board.
    clickable?: boolean;
    // Keys "row,column" drawn with an outline (the selected ship).
    highlight?: Set<string>;
    // Recon results drawn over the cells while they are visible (D-17).
    overlay?: Map<string, OutcomeType>;
    // Animation of the last attack on this board, by cell key.
    effects?: Map<string, CellEffect>;
    // Area the selected weapon would cover; invalid when the API would reject it.
    preview?: Set<string>;
    previewInvalid?: boolean;
  }>(),
  {
    clickable: false,
    highlight: () => new Set(),
    overlay: () => new Map(),
    effects: () => new Map(),
    preview: () => new Set(),
    previewInvalid: false,
  },
);

const emit = defineEmits<{
  cellClick: [row: number, column: number];
  cellHover: [row: number, column: number];
  hoverEnd: [];
}>();

// RNF-03: each cell state has its own look and symbol.
const symbol: Record<CellState, string> = {
  EMPTY: "",
  SHIP: "■",
  MISS: "•",
  HIT: "✕",
  SUNK: "✖",
};

function overlayOf(row: number, column: number) {
  return props.overlay.get(cellKey({ row, column }));
}

function effectOf(row: number, column: number) {
  return props.effects.get(cellKey({ row, column }));
}

function effectClasses(effect: CellEffect | undefined) {
  return effect ? ["fx", `fx-${effect.weapon.toLowerCase().replace("_", "-")}`, `fx-${effect.result}`] : [];
}

function onClick(row: number, column: number) {
  if (props.clickable) emit("cellClick", row, column);
}
</script>

<template>
  <section class="board">
    <h2>{{ title }}</h2>
    <div
      class="grid"
      :class="{ clickable }"
      :style="{ '--size': board.size }"
      @mouseleave="emit('hoverEnd')"
    >
      <span class="label"></span>
      <span v-for="(_, column) in board.size" :key="`c${column}`" class="label">
        {{ columnLabel(column) }}
      </span>
      <template v-for="(row, rowIndex) in board.cells" :key="`r${rowIndex}`">
        <span class="label">{{ rowLabel(rowIndex) }}</span>
        <span
          v-for="(state, column) in row"
          :key="`${rowIndex}-${column}`"
          class="cell"
          :class="[
            state.toLowerCase(),
            overlayOf(rowIndex, column)?.toLowerCase(),
            {
              selected: highlight.has(cellKey({ row: rowIndex, column })),
              preview: preview.has(cellKey({ row: rowIndex, column })),
              invalid: previewInvalid && preview.has(cellKey({ row: rowIndex, column })),
            },
            ...effectClasses(effectOf(rowIndex, column)),
          ]"
          :style="effectOf(rowIndex, column) ? { '--fx-delay': `${effectOf(rowIndex, column)!.delay}ms` } : undefined"
          :title="cellLabel({ row: rowIndex, column })"
          @click="onClick(rowIndex, column)"
          @mouseenter="emit('cellHover', rowIndex, column)"
        >
          {{ overlayOf(rowIndex, column) === "SPOTTED" ? "?" : symbol[state] }}
        </span>
      </template>
    </div>
  </section>
</template>
