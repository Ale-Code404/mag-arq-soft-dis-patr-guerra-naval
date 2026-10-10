import { Weapon } from "./Weapon";

export class Torpedo extends Weapon {
  constructor(ammo: number) {
    super("Torpedo", ammo);
  }

  attack(): void {}
}
