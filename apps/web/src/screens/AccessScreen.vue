<script setup lang="ts">
import { ref } from "vue";
import { useGame } from "../game/useGame";

const game = useGame();
const mode = ref<"code" | "new">("code");
const code = ref("");
const name = ref("");
</script>

<template>
  <section class="access">
    <div class="hero">
      <p class="eyebrow">Mando táctico naval</p>
      <h1>Hunde la flota<br />antes de que te encuentren.</h1>
      <p class="muted lead">
        Despliega tus barcos, elige tus armas y barre el radar enemigo. Cinco armas, tres niveles de dificultad y
        cada partida guardada para revivirla turno a turno.
      </p>
      <ul class="features">
        <li><span>◆</span>Misil, bomba, avión de ataque y torpedo</li>
        <li><span>◎</span>Reconocimiento que revela barcos por 10 s</li>
        <li><span>↺</span>Reproduce tus partidas paso a paso</li>
      </ul>
    </div>

    <div class="card panel">
      <div class="segmented" role="tablist">
        <label>
          <input v-model="mode" type="radio" value="code" />
          Tengo código
        </label>
        <label>
          <input v-model="mode" type="radio" value="new" />
          Soy nuevo
        </label>
      </div>

      <form v-if="mode === 'code'" class="stack" @submit.prevent="game.signIn(code)">
        <label class="field">
          <span>Código de acceso</span>
          <input
            v-model="code"
            class="code"
            type="text"
            inputmode="text"
            maxlength="32"
            placeholder="16 caracteres"
            autocomplete="off"
            spellcheck="false"
            required
          />
        </label>
        <button type="submit" class="btn btn-primary btn-lg btn-block" :disabled="game.busy.value">Entrar al puerto</button>
        <p class="muted small">Tu código te lleva a tu partida y a tu bitácora desde cualquier navegador.</p>
      </form>

      <form v-else class="stack" @submit.prevent="game.register(name)">
        <label class="field">
          <span>Nombre de capitán</span>
          <input v-model="name" type="text" maxlength="30" placeholder="Ej. Almirante Ana" autocomplete="nickname" required />
        </label>
        <button type="submit" class="btn btn-amber btn-lg btn-block" :disabled="game.busy.value">Alistar capitán</button>
        <p class="muted small">Recibirás un código único. Guárdalo: es tu única llave de regreso.</p>
      </form>
    </div>
  </section>
</template>

<style scoped>
.access {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 48px;
  align-items: center;
  min-height: calc(100vh - 160px);
}

.hero h1 {
  margin: 14px 0 18px;
  font-size: clamp(2.2rem, 5vw, 3.6rem);
  line-height: 1.05;
  font-weight: 700;
  background: linear-gradient(135deg, #fff 30%, var(--cyan));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.lead {
  max-width: 52ch;
  font-size: 1.05rem;
  line-height: 1.6;
}

.features {
  list-style: none;
  margin: 28px 0 0;
  padding: 0;
  display: grid;
  gap: 12px;
}

.features li {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text);
}

.features span {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  color: var(--cyan);
  background: var(--cyan-soft);
  border: 1px solid var(--line);
}

.panel {
  display: grid;
  gap: 22px;
  padding: 28px;
}

.small {
  font-size: 0.82rem;
  text-align: center;
}

@media (max-width: 860px) {
  .access {
    grid-template-columns: 1fr;
    gap: 28px;
    min-height: auto;
    padding-top: 12px;
  }
}
</style>
