import { Weapon } from "./Weapon";
import { WeaponType } from "./WeaponType";

export class ReconPlane extends Weapon {
  revealSeconds: number;

  constructor(ammo: number, revealSeconds: number) {
    super(WeaponType.RECON_PLANE, ammo);

    this.revealSeconds = revealSeconds;
  }

  attack(): void {}
}
