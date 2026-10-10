import { Weapon } from "./Weapon";

export class ReconPlane extends Weapon {
  revealSeconds: number;

  constructor(ammo: number, revealSeconds: number) {
    super("Recon plane", ammo);

    this.revealSeconds = revealSeconds;
  }

  attack(): void {}
}
