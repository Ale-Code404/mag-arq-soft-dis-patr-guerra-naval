import type { Difficulty, FirstTurn, MatchStatistics, Rejection, TurnView, WeaponType } from "../api/client";
import { cellLabel } from "../coordinates";

export const rejectionText: Record<Rejection, string> = {
  BOARD_SIZE_OUT_OF_LIMITS: "El tamaño del tablero está fuera de los límites.",
  FLEET_SIZE_OUT_OF_LIMITS: "La flota no tiene el número de barcos permitido.",
  FLEET_DOES_NOT_FIT:
    "La flota ocupa más del 30 % del tablero, no deja sitio para separar los barcos o tiene un barco más largo que el tablero.",
  ARSENAL_AMMO_OUT_OF_LIMITS: "Cada arma debe tener al menos una unidad de munición.",
  ARSENAL_WEAPONS_NOT_CONFIGURABLE_WEAPONS: "El misil no es configurable: siempre está disponible.",
  MATCH_IN_PROGRESS: "Ya hay una partida en curso.",
  INVALID_VALUE: "Hay un valor no válido en la configuración.",
  NO_MATCH: "No hay ninguna partida.",
  WRONG_PHASE: "Esa acción no está permitida en esta fase de la partida.",
  OUT_OF_BOARD: "El barco se sale del tablero.",
  OVERLAP: "El barco se superpone con otro.",
  TOO_CLOSE: "El barco debe quedar a una casilla de los demás, también en diagonal.",
  UNKNOWN_SHIP: "Ese barco no existe.",
  UNKNOWN_ORIENTATION: "Orientación desconocida.",
  FLEET_NOT_PLACED: "Faltan barcos por ubicar.",
  OPPONENT_PLACEMENT_FAILED: "El oponente no pudo ubicar su flota; la partida se descartó.",
  UNKNOWN_WEAPON: "Esa arma no está en tu arsenal.",
  NO_SHOT: "No es tu turno.",
  NO_AMMO: "No queda munición para esa arma.",
  AREA_OUT_OF_BOARD: "El área de ataque se sale del tablero.",
  AREA_ALREADY_ATTACKED: "Toda esa área ya fue atacada.",
  NOT_FOUND: "Esa partida guardada ya no existe.",
  INVALID_MATCH: "La partida guardada no se puede leer o su contenido no es válido.",
  NO_REPLAY: "No hay ninguna partida cargada.",
  NO_SUCH_TURN: "Ese turno no existe.",
  NO_SESSION: "Tu sesión terminó; vuelve a entrar con tu código.",
  INVALID_CODE: "Ese código no corresponde a ningún jugador.",
  TOO_MANY_REQUESTS: "Demasiados intentos seguidos; espera un momento y vuelve a intentarlo.",
  INVALID_NAME: "El nombre debe tener entre 1 y 30 caracteres.",
};

export const weaponName: Record<WeaponType, string> = {
  MISSILE: "Misil",
  BOMB: "Bomba",
  BOMBER: "Avión de ataque",
  TORPEDO: "Torpedo",
  RECON_PLANE: "Reconocimiento",
  NUKE: "Bomba nuclear",
};

export const weaponArea: Record<WeaponType, string> = {
  MISSILE: "1 casilla",
  BOMB: "2 × 2",
  BOMBER: "1 × 3 horizontal",
  TORPEDO: "Fila completa, primer barco",
  RECON_PLANE: "3 × 3, sin daño",
  NUKE: "3 × 3",
};

export const weaponGlyph: Record<WeaponType, string> = {
  MISSILE: "◆",
  BOMB: "✹",
  BOMBER: "✈",
  TORPEDO: "➤",
  RECON_PLANE: "◎",
  NUKE: "☢",
};

export const difficultyName: Record<Difficulty, string> = { EASY: "Fácil", NORMAL: "Normal", HARD: "Difícil" };

export const firstTurnName: Record<FirstTurn, string> = { HUMAN: "Tú", BOT: "Oponente", RANDOM: "Al azar" };

export function describeTurn(turn: TurnView): string {
  const where = `${weaponName[turn.weapon]} en ${cellLabel(turn.target)}`;
  if (turn.weapon === "RECON_PLANE") {
    const spotted = turn.outcomes.filter((o) => o.result === "SPOTTED").length;
    return `${where} → ${spotted} ${spotted === 1 ? "casilla con barco" : "casillas con barco"}`;
  }
  const hits = turn.outcomes.filter((o) => o.result === "HIT").length;
  return `${where} → ${hits === 0 ? "agua" : `${hits} ${hits === 1 ? "impacto" : "impactos"}`}`;
}

export const isHitTurn = (turn: TurnView) => turn.outcomes.some((o) => o.result === "HIT");

export const precisionText = (stats: MatchStatistics) =>
  stats.precision === null ? "Sin disparos" : `${Math.round(stats.precision * 100)} %`;

export const winnerName = (winner: string | null) =>
  winner === "PLAYER" ? "Tú" : winner === "OPPONENT" ? "Oponente" : "Desconocido";

export const formatDate = (iso: string | null) =>
  iso === null
    ? "No se puede leer"
    : new Date(iso).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" });
