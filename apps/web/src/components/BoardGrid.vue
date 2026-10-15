<script setup lang="ts">
import type { BoardView, CellState } from "../api/client";

defineProps<{ title: string; board: BoardView }>();

// RNF-03: each cell state has its own look and symbol.
const symbol: Record<CellState, string> = {
  EMPTY: "",
  SHIP: "■",
  MISS: "•",
  HIT: "✕",
  SUNK: "✖",
};

const columnLabel = (index: number) => String.fromCharCode(65 + index);
</script>

<template>
  <section class="board">
    <h2>{{ title }}</h2>
    <div class="grid" :style="{ '--size': board.size }">
      <span class="label"></span>
      <span v-for="(_, column) in board.size" :key="`c${column}`" class="label">
        {{ columnLabel(column) }}
      </span>
      <template v-for="(row, rowIndex) in board.cells" :key="`r${rowIndex}`">
        <span class="label">{{ rowIndex + 1 }}</span>
        <span
          v-for="(state, column) in row"
          :key="`${rowIndex}-${column}`"
          class="cell"
          :class="state.toLowerCase()"
          :title="`${columnLabel(column)}${rowIndex + 1}`"
        >
          {{ symbol[state] }}
        </span>
      </template>
    </div>
  </section>
</template>
