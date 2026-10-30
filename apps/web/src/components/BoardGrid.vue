<script setup lang="ts">
import type { BoardView, CellState, OutcomeType } from "../api/client";
import { cellKey, cellLabel, columnLabel, rowLabel } from "../coordinates";

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
  }>(),
  { clickable: false, highlight: () => new Set(), overlay: () => new Map() },
);

const emit = defineEmits<{ cellClick: [row: number, column: number] }>();

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

function onClick(row: number, column: number) {
  if (props.clickable) emit("cellClick", row, column);
}
</script>

<template>
  <section class="board">
    <h2>{{ title }}</h2>
    <div class="grid" :class="{ clickable }" :style="{ '--size': board.size }">
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
            { selected: highlight.has(cellKey({ row: rowIndex, column })) },
          ]"
          :title="cellLabel({ row: rowIndex, column })"
          @click="onClick(rowIndex, column)"
        >
          {{ overlayOf(rowIndex, column) === "SPOTTED" ? "?" : symbol[state] }}
        </span>
      </template>
    </div>
  </section>
</template>
