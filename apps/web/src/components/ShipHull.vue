<script setup lang="ts">
import { computed } from "vue";
import type { ShipShape } from "../game/ships";

const props = defineProps<{ ship: ShipShape; selected?: boolean }>();

const UNIT = 100;
const length = computed(() => props.ship.length * UNIT);
const vertical = computed(() => props.ship.orientation === "VERTICAL");
const viewBox = computed(() => (vertical.value ? `0 0 ${UNIT} ${length.value}` : `0 0 ${length.value} ${UNIT}`));
const placement = computed(() => ({
  gridRow: `${props.ship.row + 2} / span ${vertical.value ? props.ship.length : 1}`,
  gridColumn: `${props.ship.column + 2} / span ${vertical.value ? 1 : props.ship.length}`,
}));

const hull = computed(() => {
  const l = length.value;
  return `M 8 50 Q 10 12 38 10 L ${l - 70} 10 Q ${l - 16} 16 ${l - 4} 50 Q ${l - 16} 84 ${l - 70} 90 L 38 90 Q 10 88 8 50 Z`;
});
const deck = computed(() => `M 40 50 L ${length.value - 60} 50`);
const turrets = computed(() =>
  Array.from({ length: Math.max(0, props.ship.length - 1) }, (_, i) => (i + 1) * UNIT - (i === 0 ? 10 : 0)),
);
const bridge = computed(() => ({ x: Math.max(30, length.value / 2 - 45), width: 70 }));
</script>

<template>
  <div class="vessel" :class="{ sunk: ship.sunk, selected }" :style="placement" aria-hidden="true">
    <svg :viewBox="viewBox" preserveAspectRatio="none">
      <defs>
        <linearGradient :id="`steel-${ship.row}-${ship.column}`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--hull-top)" />
          <stop offset="1" stop-color="var(--hull-bottom)" />
        </linearGradient>
      </defs>
      <g :transform="vertical ? `rotate(90) translate(0 -${UNIT})` : undefined">
        <path :d="hull" :fill="`url(#steel-${ship.row}-${ship.column})`" class="hull" />
        <path :d="deck" class="deck" />
        <rect :x="bridge.x" y="30" :width="bridge.width" height="40" rx="9" class="bridge" />
        <circle v-for="x in turrets" :key="x" :cx="x" cy="50" r="13" class="turret" />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.vessel {
  --hull-top: #9bb4cf;
  --hull-bottom: #4d6886;
  position: relative;
  pointer-events: none;
  filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.55));
}

.vessel svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}

.hull {
  stroke: rgba(255, 255, 255, 0.25);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.deck {
  stroke: rgba(10, 24, 40, 0.45);
  stroke-width: 2;
  stroke-dasharray: 6 6;
  vector-effect: non-scaling-stroke;
}

.bridge {
  fill: #c9d8e8;
  opacity: 0.85;
}

.turret {
  fill: #2c435c;
  stroke: rgba(255, 255, 255, 0.3);
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
}

.selected {
  --hull-top: #ffd08a;
  --hull-bottom: #c8822b;
  filter: drop-shadow(0 0 8px rgba(255, 179, 71, 0.75));
}

.sunk {
  --hull-top: #6b3340;
  --hull-bottom: #2e1219;
  filter: grayscale(0.3) drop-shadow(0 0 6px rgba(255, 61, 85, 0.45));
  opacity: 0.9;
}

.sunk .bridge {
  fill: #5a2a33;
}
</style>
