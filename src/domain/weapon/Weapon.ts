export abstract class Weapon {
  name: string;
  ammo: number;

  constructor(name: string, ammo: number) {
    this.name = name;
    this.ammo = ammo;
  }
}
