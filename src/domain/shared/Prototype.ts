// Prototype: an object that can copy itself without the caller knowing how it
// is built. CU-10 keeps the initial boards of a replay as prototypes and clones
// them to rebuild any turn.
export interface Prototype<T> {
  clone(): T;
}
