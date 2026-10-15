import { AreaWeapon } from "./AreaWeapon";
import { ReconPlane } from "./ReconPlane";
import { Torpedo } from "./Torpedo";
import { Weapon } from "./Weapon";
import { WeaponType } from "./WeaponType";

// D-21: the missile is always available with unlimited ammo.
const UNLIMITED_AMMO = Number.POSITIVE_INFINITY;

// D-17: the recon plane shows the cells for 10 seconds.
const RECON_REVEAL_SECONDS = 10;

// Factory Method: translates a weapon type into its class and size (Armas table,
// D-16). CU-01 uses it to hand out each side's arsenal and CU-09 will reuse it
// when it loads a match.
export class WeaponFactory {
  static create(type: WeaponType, ammo: number): Weapon {
    switch (type) {
      case WeaponType.MISSILE:
        return new AreaWeapon(WeaponType.MISSILE, ammo, 1, 1);
      case WeaponType.BOMB:
        return new AreaWeapon(WeaponType.BOMB, ammo, 2, 2);
      case WeaponType.BOMBER:
        return new AreaWeapon(WeaponType.BOMBER, ammo, 1, 3);
      case WeaponType.TORPEDO:
        return new Torpedo(ammo);
      case WeaponType.RECON_PLANE:
        return new ReconPlane(ammo, RECON_REVEAL_SECONDS);
    }
  }

  // The configured special weapons plus the missile (RF-24). Each call creates
  // new instances, so each side spends its own ammo.
  static arsenal(enabledWeapons: [weapon: WeaponType, ammo: number][]): Weapon[] {
    return [
      WeaponFactory.create(WeaponType.MISSILE, UNLIMITED_AMMO),
      ...enabledWeapons.map(([type, ammo]) => WeaponFactory.create(type, ammo)),
    ];
  }
}
