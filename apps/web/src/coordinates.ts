import type { Position } from "./api/client";

// Shared with the console: rows are letters (A, B, ...) and columns numbers
// from 1, so "C4" is row 2, column 3 in the API (0-based).
export const rowLabel = (row: number) => String.fromCharCode(65 + row);
export const columnLabel = (column: number) => String(column + 1);
export const cellLabel = ({ row, column }: Position) => `${rowLabel(row)}${columnLabel(column)}`;
export const cellKey = ({ row, column }: Position) => `${row},${column}`;
