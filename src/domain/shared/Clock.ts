// The time a turn starts and ends (RF-11). Injected like Random, so the
// domain does not read the system clock (D-17).
export type Clock = () => Date;
