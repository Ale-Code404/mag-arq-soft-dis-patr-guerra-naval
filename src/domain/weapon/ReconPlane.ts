import { Weapon } from "./Weapon";

export class ReconPlane extends Weapon {
  revealSeconds: number;

  constructor(name: string, ammo: number, revealSeconds: number) {
    super(name, ammo);

    this.revealSeconds = revealSeconds;
  }
}
