import { CellState } from "../../application/MatchView";
import { Difficulty } from "../../domain/match/Difficulty";
import { FirstTurn } from "../../domain/match/FirstTurn";
import { MatchConfigRejection } from "../../domain/match/MatchConfigRejection";
import { MatchPhase } from "../../domain/match/MatchPhase";
import { WeaponType } from "../../domain/weapon/WeaponType";

// The HTTP contract. Each schema has an $id so the OpenAPI document names it,
// and any client, in any language, can generate its types from that document.

const weaponType = { type: "string", enum: Object.values(WeaponType) } as const;

// Weapons travel as objects, not tuples, so every client language can map them.
const enabledWeapons = {
  type: "array",
  items: {
    type: "object",
    required: ["type", "ammo"],
    additionalProperties: false,
    properties: { type: weaponType, ammo: { type: "integer" } },
  },
} as const;

export const MatchConfigSchema = {
  $id: "MatchConfig",
  type: "object",
  required: ["boardSize", "shipLengths", "difficulty", "firstTurn", "extraTurnOnHit", "enabledWeapons"],
  properties: {
    boardSize: { type: "integer" },
    shipLengths: { type: "array", items: { type: "integer" } },
    difficulty: { type: "string", enum: Object.values(Difficulty) },
    firstTurn: { type: "string", enum: Object.values(FirstTurn) },
    extraTurnOnHit: { type: "boolean" },
    enabledWeapons,
  },
} as const;

// CU-02, 3a: every field is optional; an omitted one keeps the current value.
export const ConfigureMatchInputSchema = {
  $id: "ConfigureMatchInput",
  type: "object",
  additionalProperties: false,
  properties: MatchConfigSchema.properties,
} as const;

export const ConfigRejectedSchema = {
  $id: "ConfigRejected",
  type: "object",
  required: ["accepted", "rejection"],
  properties: {
    accepted: { type: "boolean", enum: [false] },
    rejection: { type: "string", enum: Object.values(MatchConfigRejection) },
  },
} as const;

export const MatchStartRejectedSchema = {
  $id: "MatchStartRejected",
  type: "object",
  required: ["reason"],
  properties: {
    reason: { type: "string", enum: ["MATCH_IN_PROGRESS"] },
  },
} as const;

export const NoMatchSchema = {
  $id: "NoMatch",
  type: "object",
  required: ["reason"],
  properties: {
    reason: { type: "string", enum: ["NO_MATCH"] },
  },
} as const;

export const BoardViewSchema = {
  $id: "BoardView",
  type: "object",
  required: ["size", "cells"],
  properties: {
    size: { type: "integer" },
    // Row-major: cells[row][column].
    cells: {
      type: "array",
      items: { type: "array", items: { type: "string", enum: Object.values(CellState) } },
    },
  },
} as const;

export const MatchViewSchema = {
  $id: "MatchView",
  type: "object",
  required: ["phase", "ownBoard", "rivalBoard", "fleet", "arsenal"],
  properties: {
    phase: { type: "string", enum: Object.values(MatchPhase) },
    ownBoard: { $ref: "BoardView#" },
    rivalBoard: { $ref: "BoardView#" },
    fleet: {
      type: "array",
      items: {
        type: "object",
        required: ["length", "placed", "sunk"],
        properties: {
          length: { type: "integer" },
          placed: { type: "boolean" },
          sunk: { type: "boolean" },
        },
      },
    },
    arsenal: {
      type: "array",
      items: {
        type: "object",
        required: ["type", "ammo"],
        properties: {
          type: weaponType,
          // null means unlimited ammo (D-21).
          ammo: { type: ["integer", "null"] },
        },
      },
    },
  },
} as const;

export const schemas = [
  MatchConfigSchema,
  ConfigureMatchInputSchema,
  ConfigRejectedSchema,
  MatchStartRejectedSchema,
  NoMatchSchema,
  BoardViewSchema,
  MatchViewSchema,
];
