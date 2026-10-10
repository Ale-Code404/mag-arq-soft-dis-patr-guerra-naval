export abstract class Weapon {
  private name: string;
  private ammo: number;
  private uses: number;

  constructor(name: string, ammo: number) {
    this.name = name;
    this.ammo = ammo;
    this.uses = 0;
  }

  use(): void {
    if (this.ammo === 0) {
      return;
    }

    this.attack();
    this.reduceAmmo();
  }

  abstract attack(): void;

  private reduceAmmo(): void {
    this.ammo--;
    this.uses++;
  }
}
